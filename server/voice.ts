import { ReplitConnectors } from "@replit/connectors-sdk";
import { storage } from "./storage";
import { buildSystemPrompt, stripThinkTags, windowMessages } from "./chat-engine";
import { getClientForModel, MODEL_REGISTRY, replitOpenai } from "./providers";
import type { Request, Response } from "express";

const connectors = new ReplitConnectors();

const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

async function speechToText(audioBase64: string): Promise<string> {
  const audioBuffer = Buffer.from(audioBase64, "base64");

  const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);
  const parts: Buffer[] = [];

  const fieldHeader = `--${boundary}\r\nContent-Disposition: form-data; name="model_id"\r\n\r\nscribe_v1\r\n`;
  parts.push(Buffer.from(fieldHeader));

  const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.webm"\r\nContent-Type: audio/webm\r\n\r\n`;
  parts.push(Buffer.from(fileHeader));
  parts.push(audioBuffer);
  parts.push(Buffer.from("\r\n"));

  const ending = `--${boundary}--\r\n`;
  parts.push(Buffer.from(ending));

  const body = Buffer.concat(parts);

  const response = await connectors.proxy("elevenlabs", "/v1/speech-to-text", {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`STT failed (${response.status}): ${errText}`);
  }

  const result = await response.json() as any;
  return result.text || "";
}

async function textToSpeechStream(text: string, voiceId: string): Promise<Buffer> {
  const response = await connectors.proxy("elevenlabs", `/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_flash_v2_5",
      output_format: "pcm_24000",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`TTS failed (${response.status}): ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function handleVoiceMessage(req: Request, res: Response) {
  const conversationId = parseInt(req.params.id);
  const { audio } = req.body;

  if (!audio) {
    return res.status(400).json({ error: "Audio data required" });
  }

  const conv = await storage.getConversation(conversationId);
  if (!conv) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const transcript = await speechToText(audio);

    if (!transcript.trim()) {
      res.write(`data: ${JSON.stringify({ type: "error", error: "Could not understand audio" })}\n\n`);
      res.end();
      return;
    }

    res.write(`data: ${JSON.stringify({ type: "user_transcript", data: transcript })}\n\n`);

    await storage.createMessage({ conversationId, role: "user", content: transcript });
    const allMessages = await storage.getMessages(conversationId);
    const settings = await storage.getSettings();
    const persona = conv.personaId ? await storage.getPersona(conv.personaId) : await storage.getActivePersona();

    const [memResult, enabledSkills, knResult] = await Promise.all([
      storage.getMemoryEntries(persona?.id),
      storage.getEnabledSkillsWithPrompts(),
      storage.getKnowledge(persona?.id),
    ]);

    const model = conv.model || "gpt-5.1";
    const { prompt: systemPrompt, injectedMemoryIds } = await buildSystemPrompt(
      persona, memResult.data, settings, enabledSkills, knResult.data, false, transcript
    );
    storage.touchMemoryEntries(injectedMemoryIds).catch(() => {});

    const chatMessages = windowMessages(
      allMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: stripThinkTags(m.content),
      }))
    );

    const { client, actualModelId } = await getClientForModel(model);
    const completion = await client.chat.completions.create({
      model: actualModelId,
      messages: [{ role: "system", content: systemPrompt + "\n\nIMPORTANT: Keep your response concise and conversational since this is a voice conversation. Aim for 1-3 sentences unless more detail is specifically needed." }, ...chatMessages],
      max_completion_tokens: 1000,
    });

    const aiResponse = completion.choices[0]?.message?.content || "(no response)";
    await storage.createMessage({ conversationId, role: "assistant", content: aiResponse });

    res.write(`data: ${JSON.stringify({ type: "transcript", data: aiResponse })}\n\n`);

    const needsTitle = conv.title === "New Chat" || allMessages.length <= 2;
    if (needsTitle) {
      try {
        const titleResp = await replitOpenai.chat.completions.create({
          model: "gpt-5-nano",
          messages: [
            { role: "user", content: `Generate a concise 3-7 word title.\n\nUser: "${transcript.slice(0, 200)}"\nAssistant: "${aiResponse.slice(0, 200)}"\n\nReply with ONLY the title.` }
          ],
          max_completion_tokens: 30,
        });
        let newTitle = titleResp.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, "").replace(/\.+$/, "") || transcript.slice(0, 50);
        await storage.updateConversation(conversationId, { title: newTitle });
        res.write(`data: ${JSON.stringify({ type: "titleUpdate", data: newTitle })}\n\n`);
      } catch {
        const fallback = transcript.slice(0, 50);
        await storage.updateConversation(conversationId, { title: fallback }).catch(() => {});
      }
    }

    try {
      const voiceId = DEFAULT_VOICE_ID;
      const pcmBuffer = await textToSpeechStream(aiResponse, voiceId);

      const CHUNK_SIZE = 4800;
      for (let i = 0; i < pcmBuffer.length; i += CHUNK_SIZE) {
        const chunk = pcmBuffer.subarray(i, Math.min(i + CHUNK_SIZE, pcmBuffer.length));
        const b64 = chunk.toString("base64");
        res.write(`data: ${JSON.stringify({ type: "audio", data: b64 })}\n\n`);
      }
    } catch (ttsErr: any) {
      console.error("TTS error:", ttsErr.message);
    }

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error("Voice error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
      res.end();
    }
  }
}

export async function handleListVoices(_req: Request, res: Response) {
  try {
    const response = await connectors.proxy("elevenlabs", "/v1/voices", {
      method: "GET",
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to fetch voices" });
    }

    const data = await response.json() as any;
    const voices = (data.voices || []).map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category,
      labels: v.labels,
    }));

    res.json({ voices, defaultVoiceId: DEFAULT_VOICE_ID });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { seedDatabase } from "./seed";
import { insertConversationSchema, insertSettingsSchema, insertPersonaSchema, insertMemoryEntrySchema, insertProviderKeySchema, insertHeartbeatTaskSchema, insertKnowledgeSchema, insertSkillSchema, insertDailyNoteSchema, conversations, messages } from "@shared/schema";
import { getClientForModel, getAvailableModels, clearClientCache, MODEL_REGISTRY, PROVIDER_CONFIG, replitOpenai } from "./providers";
import { startHeartbeat, stopHeartbeat, isHeartbeatRunning, delegateTaskFromChat } from "./heartbeat";
import { buildSystemPrompt, stripThinkTags, windowMessages, extractMemory, updateDailyLog } from "./chat-engine";
import { authMiddleware, handleLogin, handleAuthStatus, setAccessPin, clearAllSessions, isValidSession } from "./auth";
import { startDiscordBot, stopDiscordBot, getDiscordStatus, initDiscordFromSettings } from "./discord";
import { generateEmbedding, generateAndStoreEmbeddings } from "./embeddings";
import { TOOL_DEFINITIONS, executeTool, PROVIDERS_SUPPORTING_TOOLS } from "./tools";
import { handleVoiceMessage, handleListVoices } from "./voice";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/pdf",
]);

const SAFE_EXTENSIONS: Record<string, string> = {
  "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp",
  "text/plain": ".txt", "text/markdown": ".md", "text/csv": ".csv",
  "application/json": ".json", "application/pdf": ".pdf",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = SAFE_EXTENSIONS[file.mimetype] || ".bin";
      const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

function getRecencyTier(lastAccessed: Date | string): "hot" | "warm" | "cold" {
  const now = Date.now();
  const accessed = new Date(lastAccessed).getTime();
  const daysSince = (now - accessed) / (1000 * 60 * 60 * 24);
  if (daysSince <= 7) return "hot";
  if (daysSince <= 30) return "warm";
  return "cold";
}

const MAX_MEMORY_CHARS = 3000;
const MAX_MEMORY_FACT_CHARS = 300;

function truncateFact(fact: string): string {
  return fact.length > MAX_MEMORY_FACT_CHARS ? fact.slice(0, MAX_MEMORY_FACT_CHARS) + "..." : fact;
}

function buildMemorySection(memories: any[]): { text: string; injectedIds: number[] } {
  if (memories.length === 0) return { text: "", injectedIds: [] };

  const hot = memories.filter((m) => getRecencyTier(m.lastAccessed) === "hot");
  const warm = memories.filter((m) => getRecencyTier(m.lastAccessed) === "warm");
  const cold = memories.filter((m) => getRecencyTier(m.lastAccessed) === "cold");

  const candidates = [
    ...hot.slice(0, 10).map((m) => ({ ...m, tier: "hot" })),
    ...warm.slice(0, 8).map((m) => ({ ...m, tier: "warm" })),
    ...((hot.length + warm.length < 15) ? cold.slice(0, 5).map((m) => ({ ...m, tier: "cold" })) : []),
  ];

  const injected: typeof candidates = [];
  let totalChars = 0;
  for (const mem of candidates) {
    const factText = truncateFact(mem.fact);
    if (totalChars + factText.length > MAX_MEMORY_CHARS && injected.length > 0) break;
    totalChars += factText.length;
    injected.push({ ...mem, fact: factText });
  }

  const lines: string[] = [];
  const hotItems = injected.filter((m) => m.tier === "hot");
  const warmItems = injected.filter((m) => m.tier === "warm");
  const coldItems = injected.filter((m) => m.tier === "cold");

  if (hotItems.length > 0) {
    lines.push("### Hot (accessed this week)");
    hotItems.forEach((m) => lines.push(`- [${m.category}] ${m.fact}`));
  }
  if (warmItems.length > 0) {
    lines.push("### Warm (accessed this month)");
    warmItems.forEach((m) => lines.push(`- [${m.category}] ${m.fact}`));
  }
  if (coldItems.length > 0) {
    lines.push("### Cold (older)");
    coldItems.forEach((m) => lines.push(`- [${m.category}] ${m.fact}`));
  }

  return {
    text: `## ACTIVE MEMORY - Three-Tier Recall\nDurable facts organized by recency (${injected.length} of ${memories.length} total):\n${lines.join("\n")}`,
    injectedIds: injected.map((m) => m.id),
  };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await seedDatabase();
  startHeartbeat();
  initDiscordFromSettings().catch(() => {});

  app.post("/api/auth/login", handleLogin);
  app.get("/api/auth/status", handleAuthStatus);

  app.use("/api", authMiddleware);

  app.get("/uploads/:filename", async (req: Request, res: Response) => {
    const settings = await storage.getSettings();
    if (settings?.accessPin) {
      const token = req.headers.authorization?.replace("Bearer ", "") || (req.query.token as string) || "";
      if (!isValidSession(token)) {
        return res.status(401).json({ error: "Authentication required" });
      }
    }
    const filename = path.basename(req.params.filename);
    const filePath = path.join(UPLOADS_DIR, filename);
    try {
      const realPath = fs.realpathSync(filePath).replace(/\\/g, "/");
      const uploadsReal = fs.realpathSync(UPLOADS_DIR).replace(/\\/g, "/");
      if (!realPath.startsWith(uploadsReal + "/")) {
        return res.status(403).json({ error: "Forbidden" });
      }
    } catch {
      return res.status(404).json({ error: "Not found" });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Not found" });
    }
    res.sendFile(filePath);
  });

  app.post("/api/voice/conversations/:id/messages", handleVoiceMessage);
  app.get("/api/voice/voices", handleListVoices);

  app.post("/api/upload", (req: Request, res: Response) => {
    upload.single("file")(req, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ error: "File too large (max 10MB)" });
        }
        if (err.message?.includes("File type not allowed")) {
          return res.status(400).json({ error: "File type not allowed" });
        }
        return res.status(400).json({ error: err.message || "Upload failed" });
      }
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file provided" });
      }
      const url = `/uploads/${file.filename}`;
      res.json({
        url,
        filename: file.originalname,
        type: file.mimetype,
        size: file.size,
      });
    });
  });

  // ─── Discord ────────────────────────────────────────────
  app.get("/api/discord/status", async (_req, res) => {
    res.json(getDiscordStatus());
  });

  // ─── Conversations ───────────────────────────────────────
  app.get("/api/conversations", async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    res.json(await storage.getConversations(limit, offset));
  });

  app.post("/api/conversations", async (req, res) => {
    const parsed = insertConversationSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const activePersona = await storage.getActivePersona();
    const settings = await storage.getSettings();
    const conv = await storage.createConversation({
      title: parsed.data.title || "New Chat",
      model: parsed.data.model || settings?.defaultModel || "gpt-5.1",
      thinking: parsed.data.thinking ?? settings?.thinkingEnabled ?? false,
      personaId: activePersona?.id ?? null,
    });
    res.status(201).json(conv);
  });

  app.get("/api/conversations/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const conv = await storage.getConversation(id);
    if (!conv) return res.status(404).json({ error: "Not found" });
    const msgs = await storage.getMessages(id);
    res.json({ ...conv, messages: msgs });
  });

  app.patch("/api/conversations/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const parsed = insertConversationSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const conv = await storage.updateConversation(id, parsed.data);
    if (!conv) return res.status(404).json({ error: "Not found" });
    res.json(conv);
  });

  app.delete("/api/conversations/:id", async (req, res) => {
    await storage.deleteConversation(parseInt(req.params.id));
    res.status(204).send();
  });

  // ─── Messages (streaming SSE) ────────────────────────────
  app.post("/api/conversations/:id/messages", async (req, res) => {
    const conversationId = parseInt(req.params.id);
    const { content, attachments } = req.body;
    if (!content?.trim() && (!attachments || attachments.length === 0)) return res.status(400).json({ error: "Content required" });

    const conv = await storage.getConversation(conversationId);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    let storedContent = (content || "").trim();
    const parsedAttachments: { url: string; name: string; type: string }[] = Array.isArray(attachments) ? attachments : [];
    if (parsedAttachments.length > 0) {
      storedContent = `<!-- attachments:${JSON.stringify(parsedAttachments)} -->\n${storedContent}`;
    }

    await storage.createMessage({ conversationId, role: "user", content: storedContent });
    const allMessages = await storage.getMessages(conversationId);
    const settings = await storage.getSettings();

    const persona = conv.personaId ? await storage.getPersona(conv.personaId) : await storage.getActivePersona();
    const [memResult, enabledSkills, knResult] = await Promise.all([
      storage.getMemoryEntries(persona?.id),
      storage.getEnabledSkillsWithPrompts(),
      storage.getKnowledge(persona?.id),
    ]);
    const model = conv.model || "gpt-5.1";
    const isThinkingMode = !!conv.thinking;
    const { prompt: systemPrompt, injectedMemoryIds } = await buildSystemPrompt(persona, memResult.data, settings, enabledSkills, knResult.data, isThinkingMode, content.trim());

    const registeredModel = MODEL_REGISTRY.find((m) => m.id === model);
    if (!registeredModel) {
      return res.status(400).json({ error: `Unknown model: ${model}. Update the model in conversation settings.` });
    }

    storage.touchMemoryEntries(injectedMemoryIds).catch(() => {});

    const chatMessages = windowMessages(
      allMessages.map((m) => {
        if (m.role === "assistant") {
          return { role: "assistant" as const, content: stripThinkTags(m.content) };
        }
        const attachMatch = m.content.match(/^<!-- attachments:(\[[\s\S]*?\]) -->\n?/);
        if (!attachMatch) {
          return { role: "user" as const, content: m.content };
        }
        const textContent = m.content.slice(attachMatch[0].length);
        try {
          const atts: { url: string; name: string; type: string }[] = JSON.parse(attachMatch[1]);
          const imageAtts = atts.filter((a) => a.type.startsWith("image/"));
          const fileAtts = atts.filter((a) => !a.type.startsWith("image/"));
          const parts: any[] = [];
          if (textContent.trim()) {
            let textPart = textContent.trim();
            if (fileAtts.length > 0) {
              textPart += "\n\n[Attached files: " + fileAtts.map((f) => f.name).join(", ") + "]";
            }
            parts.push({ type: "text", text: textPart });
          } else if (fileAtts.length > 0) {
            parts.push({ type: "text", text: "[Attached files: " + fileAtts.map((f) => f.name).join(", ") + "]" });
          }
          for (const img of imageAtts) {
            let imgUrl = img.url;
            if (img.url.startsWith("/uploads/")) {
              const safeName = path.basename(img.url);
              const filePath = path.join(UPLOADS_DIR, safeName);
              try {
                const realPath = fs.realpathSync(filePath);
                const uploadsReal = fs.realpathSync(UPLOADS_DIR);
                if (realPath.startsWith(uploadsReal + path.sep) && fs.existsSync(filePath)) {
                  const b64 = fs.readFileSync(filePath).toString("base64");
                  const mimeType = img.type || "image/png";
                  imgUrl = `data:${mimeType};base64,${b64}`;
                }
              } catch {}
            }
            parts.push({ type: "image_url", image_url: { url: imgUrl } });
          }
          if (parts.length === 0) {
            parts.push({ type: "text", text: textContent || "(attachment)" });
          }
          return { role: "user" as const, content: parts };
        } catch {
          return { role: "user" as const, content: m.content.slice(attachMatch[0].length) || m.content };
        }
      })
    );

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const { client, actualModelId } = await getClientForModel(model);
      const providerSupportsTools = PROVIDERS_SUPPORTING_TOOLS.has(registeredModel.provider);
      const useTools = providerSupportsTools && !isThinkingMode;

      const apiMessages: any[] = [{ role: "system", content: systemPrompt }, ...chatMessages];
      let fullResponse = "";
      const MAX_TOOL_ROUNDS = 5;
      const executedTools: { id: string; name: string; input: any; output: any }[] = [];

      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const createParams: any = {
          model: actualModelId,
          messages: apiMessages,
          stream: true,
          max_completion_tokens: 8192,
        };
        if (useTools && round < MAX_TOOL_ROUNDS) {
          createParams.tools = TOOL_DEFINITIONS;
          createParams.tool_choice = "auto";
        }

        const stream = await client.chat.completions.create(createParams);

        let roundContent = "";
        let inThinkBlock = false;
        let thinkBuffer = "";
        const toolCallBuffers: Record<number, { id: string; name: string; args: string }> = {};
        let hasToolCalls = false;

        for await (const chunk of stream) {
          const choice = chunk.choices[0];
          if (!choice) continue;
          const delta = choice.delta as any;

          if (delta?.tool_calls) {
            hasToolCalls = true;
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallBuffers[idx]) {
                toolCallBuffers[idx] = { id: tc.id || `call_${idx}_${round}`, name: "", args: "" };
              }
              if (tc.function?.name) toolCallBuffers[idx].name += tc.function.name;
              if (tc.function?.arguments) toolCallBuffers[idx].args += tc.function.arguments;
            }
          }

          const contentDelta = delta?.content || "";
          if (!contentDelta) continue;
          roundContent += contentDelta;
          fullResponse += contentDelta;

          if (isThinkingMode) {
            thinkBuffer += contentDelta;
            while (thinkBuffer.length > 0) {
              if (!inThinkBlock) {
                const openIdx = thinkBuffer.indexOf("<think>");
                if (openIdx === -1) {
                  if (thinkBuffer.length > 7) {
                    const safe = thinkBuffer.slice(0, thinkBuffer.length - 7);
                    res.write(`data: ${JSON.stringify({ content: safe })}\n\n`);
                    thinkBuffer = thinkBuffer.slice(safe.length);
                  }
                  break;
                } else {
                  if (openIdx > 0) {
                    res.write(`data: ${JSON.stringify({ content: thinkBuffer.slice(0, openIdx) })}\n\n`);
                  }
                  res.write(`data: ${JSON.stringify({ thinkStart: true })}\n\n`);
                  thinkBuffer = thinkBuffer.slice(openIdx + 7);
                  inThinkBlock = true;
                }
              } else {
                const closeIdx = thinkBuffer.indexOf("</think>");
                if (closeIdx === -1) {
                  if (thinkBuffer.length > 8) {
                    const safe = thinkBuffer.slice(0, thinkBuffer.length - 8);
                    res.write(`data: ${JSON.stringify({ thinking: safe })}\n\n`);
                    thinkBuffer = thinkBuffer.slice(safe.length);
                  }
                  break;
                } else {
                  if (closeIdx > 0) {
                    res.write(`data: ${JSON.stringify({ thinking: thinkBuffer.slice(0, closeIdx) })}\n\n`);
                  }
                  res.write(`data: ${JSON.stringify({ thinkEnd: true })}\n\n`);
                  thinkBuffer = thinkBuffer.slice(closeIdx + 8);
                  inThinkBlock = false;
                }
              }
            }
          } else {
            res.write(`data: ${JSON.stringify({ content: contentDelta })}\n\n`);
          }
        }

        if (isThinkingMode && thinkBuffer.length > 0) {
          if (inThinkBlock) {
            res.write(`data: ${JSON.stringify({ thinking: thinkBuffer })}\n\n`);
            res.write(`data: ${JSON.stringify({ thinkEnd: true })}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify({ content: thinkBuffer })}\n\n`);
          }
        }

        const toolCallCount = Object.keys(toolCallBuffers).length;
        if (!hasToolCalls || toolCallCount === 0) {
          break;
        }

        if (toolCallCount > 5) {
          console.log(`[tools] Capping tool calls from ${toolCallCount} to 5 in round ${round}`);
          const keys = Object.keys(toolCallBuffers).slice(5);
          for (const k of keys) delete toolCallBuffers[parseInt(k)];
        }

        const assistantMsg: any = { role: "assistant", content: roundContent || null, tool_calls: [] };
        for (const [, tc] of Object.entries(toolCallBuffers)) {
          assistantMsg.tool_calls.push({ id: tc.id, type: "function", function: { name: tc.name, arguments: tc.args } });
        }
        apiMessages.push(assistantMsg);

        for (const [, tc] of Object.entries(toolCallBuffers)) {
          let parsedArgs: Record<string, any> = {};
          try { parsedArgs = JSON.parse(tc.args || "{}"); } catch {}

          res.write(`data: ${JSON.stringify({ tool_call: { id: tc.id, name: tc.name, input: parsedArgs } })}\n\n`);
          console.log(`[tools] Executing: ${tc.name}(${JSON.stringify(parsedArgs).slice(0, 100)})`);

          let result: any;
          try {
            result = await executeTool(tc.name, parsedArgs);
          } catch (err: any) {
            result = { error: err.message || "Tool execution failed" };
          }

          const resultStr = JSON.stringify(result).slice(0, 4000);
          res.write(`data: ${JSON.stringify({ tool_result: { id: tc.id, name: tc.name, output: result } })}\n\n`);
          executedTools.push({ id: tc.id, name: tc.name, input: parsedArgs, output: result });

          apiMessages.push({ role: "tool", tool_call_id: tc.id, content: resultStr });
        }
      }

      const toolMeta = executedTools.length > 0
        ? `<!-- tools:${JSON.stringify(executedTools.map(t => ({ id: t.id, name: t.name, input: t.input, output: t.output })))} -->\n`
        : "";
      await storage.createMessage({ conversationId, role: "assistant", content: toolMeta + fullResponse });

      let titleForLog = conv.title;
      const needsTitle = conv.title === "New Chat" || allMessages.length <= 2;
      if (needsTitle) {
        try {
          const contextSnippet = content.slice(0, 200);
          const responseSnippet = fullResponse.slice(0, 200);
          const titleResp = await replitOpenai.chat.completions.create({
            model: "gpt-5-nano",
            messages: [
              { role: "user", content: `Generate a concise, descriptive 3-7 word title summarizing this conversation.\n\nUser said: "${contextSnippet}"\nAssistant replied about: "${responseSnippet}"\n\nReply with ONLY the title text, no quotes, no punctuation at the end.` }
            ],
            max_completion_tokens: 30,
          });
          let newTitle = titleResp.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, "").replace(/\.+$/, "") || "";
          if (!newTitle || newTitle.toLowerCase() === "new chat") {
            newTitle = content.slice(0, 60).replace(/\n/g, " ").trim();
            if (newTitle.length > 50) newTitle = newTitle.slice(0, 50) + "...";
          }
          await storage.updateConversation(conversationId, { title: newTitle });
          titleForLog = newTitle;
          res.write(`data: ${JSON.stringify({ titleUpdate: newTitle })}\n\n`);
        } catch (titleErr) {
          console.error("Auto-title failed:", titleErr);
          const fallbackTitle = content.slice(0, 60).replace(/\n/g, " ").trim();
          if (fallbackTitle && conv.title === "New Chat") {
            const truncated = fallbackTitle.length > 50 ? fallbackTitle.slice(0, 50) + "..." : fallbackTitle;
            await storage.updateConversation(conversationId, { title: truncated }).catch(() => {});
            titleForLog = truncated;
            res.write(`data: ${JSON.stringify({ titleUpdate: truncated })}\n\n`);
          } else {
            await storage.updateConversation(conversationId, {}).catch(() => {});
          }
        }
      } else {
        await storage.updateConversation(conversationId, {});
      }

      extractMemory(fullResponse, content.trim(), persona?.id).catch(() => {});
      updateDailyLog(titleForLog, persona?.id).catch(() => {});

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err: any) {
      const errMsg = err?.message || "Stream failed";
      console.error("Stream error:", errMsg);
      if (!res.headersSent) {
        res.status(500).json({ error: errMsg });
      } else {
        res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
        res.end();
      }
    }
  });

  // ─── Settings ─────────────────────────────────────────────
  app.get("/api/settings", async (_req, res) => {
    const s = await storage.getSettings();
    if (!s) {
      return res.json({ agentName: "VisionClaw", personality: "You are VisionClaw, a helpful personal AI assistant.", defaultModel: "gpt-5.1", thinkingEnabled: false, discordBotToken: null, accessPin: null });
    }
    const response = { ...s };
    if (response.discordBotToken) {
      response.discordBotToken = response.discordBotToken.slice(0, 8) + "...";
    }
    if (response.accessPin) {
      response.accessPin = "***configured***";
    }
    res.json(response);
  });

  app.put("/api/settings", async (req, res) => {
    const parsed = insertSettingsSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const existingSettings = await storage.getSettings();
    const defaults = {
      agentName: "VisionClaw",
      personality: "You are VisionClaw, a helpful personal AI assistant.",
      defaultModel: "gpt-5.1",
      thinkingEnabled: false,
    };

    const updateData: any = {
      agentName: parsed.data.agentName ?? existingSettings?.agentName ?? defaults.agentName,
      personality: parsed.data.personality ?? existingSettings?.personality ?? defaults.personality,
      defaultModel: parsed.data.defaultModel ?? existingSettings?.defaultModel ?? defaults.defaultModel,
      thinkingEnabled: parsed.data.thinkingEnabled ?? existingSettings?.thinkingEnabled ?? defaults.thinkingEnabled,
    };

    if (parsed.data.discordBotToken !== undefined) {
      updateData.discordBotToken = parsed.data.discordBotToken || null;
      const oldToken = existingSettings?.discordBotToken;
      const newToken = parsed.data.discordBotToken;
      if (newToken && newToken !== oldToken) {
        startDiscordBot(newToken).catch((err: any) => {
          console.error("[discord] Failed to start bot:", err.message);
        });
      } else if (!newToken && oldToken) {
        stopDiscordBot().catch(() => {});
      }
    }

    if (parsed.data.accessPin !== undefined) {
      if (parsed.data.accessPin) {
        updateData.accessPin = await setAccessPin(parsed.data.accessPin);
      } else {
        updateData.accessPin = null;
      }
      clearAllSessions();
    }

    const s = await storage.upsertSettings(updateData);
    const response = { ...s };
    if (response.discordBotToken) {
      response.discordBotToken = response.discordBotToken.slice(0, 8) + "...";
    }
    if (response.accessPin) {
      response.accessPin = "***configured***";
    }
    res.json(response);
  });

  // ─── Provider Keys & Models ──────────────────────────────
  app.get("/api/models", async (_req, res) => {
    const available = await getAvailableModels();
    res.json({ models: available, providers: PROVIDER_CONFIG });
  });

  app.get("/api/provider-keys", async (_req, res) => {
    const keys = await storage.getProviderKeys();
    const masked = keys.map((k) => ({
      ...k,
      apiKey: k.apiKey.slice(0, 8) + "..." + k.apiKey.slice(-4),
    }));
    res.json(masked);
  });

  app.put("/api/provider-keys/:provider", async (req, res) => {
    const { provider } = req.params;
    const validProviders = Object.keys(PROVIDER_CONFIG).filter((p) => p !== "replit");
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ error: "Invalid provider" });
    }
    const existing = await storage.getProviderKey(provider);
    const rawKey = typeof req.body.apiKey === "string" ? req.body.apiKey.trim() : "";
    const sanitizedKey = rawKey
      .replace(/\u2014/g, "-")  // em-dash → hyphen
      .replace(/\u2013/g, "-")  // en-dash → hyphen
      .replace(/\u2018|\u2019/g, "'")  // curly single quotes
      .replace(/\u201C|\u201D/g, '"')  // curly double quotes
      .replace(/[^\x20-\x7E]/g, "");   // strip any remaining non-ASCII
    const apiKey = sanitizedKey || existing?.apiKey;
    if (!apiKey) return res.status(400).json({ error: "API key required" });
    const enabled = typeof req.body.enabled === "boolean" ? req.body.enabled : true;
    clearClientCache();
    const key = await storage.upsertProviderKey({ provider, apiKey, enabled, baseUrl: null });
    res.json({ ...key, apiKey: key.apiKey.slice(0, 8) + "..." + key.apiKey.slice(-4) });
  });

  app.delete("/api/provider-keys/:provider", async (req, res) => {
    clearClientCache();
    await storage.deleteProviderKey(req.params.provider);
    res.json({ ok: true });
  });

  app.post("/api/provider-keys/test", async (_req, res) => {
    clearClientCache();
    const keys = await storage.getProviderKeys();
    const results: Record<string, { connected: boolean; provider: string; detail: string; latencyMs?: number }> = {};

    results["replit"] = { connected: true, provider: "Replit AI (Built-in)", detail: "Always available - no API key needed" };

    const testModels: Record<string, string> = {
      openai: "gpt-4o-mini",
      anthropic: "claude-sonnet-4-6",
      xai: "grok-3-mini",
      google: "gemini-2.5-flash",
      perplexity: "sonar",
      openrouter: "openrouter/auto",
    };

    for (const key of keys) {
      if (!key.enabled) {
        results[key.provider] = { connected: false, provider: PROVIDER_CONFIG[key.provider]?.name || key.provider, detail: "Key disabled" };
        continue;
      }

      const modelId = testModels[key.provider];
      if (!modelId) {
        results[key.provider] = { connected: false, provider: PROVIDER_CONFIG[key.provider]?.name || key.provider, detail: "Unknown provider" };
        continue;
      }

      const start = Date.now();
      try {
        const { client, actualModelId } = await getClientForModel(modelId);
        const response = await client.chat.completions.create({
          model: actualModelId,
          messages: [{ role: "user", content: "Reply with only the word: connected" }],
          max_tokens: 10,
        });
        const latencyMs = Date.now() - start;
        const reply = response.choices?.[0]?.message?.content?.trim() || "";
        results[key.provider] = {
          connected: true,
          provider: PROVIDER_CONFIG[key.provider]?.name || key.provider,
          detail: `OK - replied "${reply}" (${actualModelId})`,
          latencyMs,
        };
      } catch (err: any) {
        const latencyMs = Date.now() - start;
        results[key.provider] = {
          connected: false,
          provider: PROVIDER_CONFIG[key.provider]?.name || key.provider,
          detail: err.message?.slice(0, 200) || "Unknown error",
          latencyMs,
        };
      }
    }

    res.json(results);
  });

  // ─── Skills ────────────────────────────────────────────────
  app.get("/api/skills", async (_req, res) => res.json(await storage.getSkills()));

  app.patch("/api/skills/:id", async (req, res) => {
    const parsed = insertSkillSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const skill = await storage.updateSkill(parseInt(req.params.id), parsed.data);
    if (!skill) return res.status(404).json({ error: "Skill not found" });
    res.json(skill);
  });

  // ─── Personas ─────────────────────────────────────────────
  app.get("/api/personas", async (_req, res) => res.json(await storage.getPersonas()));

  app.get("/api/personas/active", async (_req, res) => {
    const p = await storage.getActivePersona();
    res.json(p || null);
  });

  app.post("/api/personas", async (req, res) => {
    const parsed = insertPersonaSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const p = await storage.createPersona(parsed.data);
    res.status(201).json(p);
  });

  app.get("/api/personas/:id", async (req, res) => {
    const p = await storage.getPersona(parseInt(req.params.id));
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(p);
  });

  app.patch("/api/personas/:id", async (req, res) => {
    const parsed = insertPersonaSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const p = await storage.updatePersona(parseInt(req.params.id), parsed.data);
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(p);
  });

  app.delete("/api/personas/:id", async (req, res) => {
    await storage.deletePersona(parseInt(req.params.id));
    res.status(204).send();
  });

  app.post("/api/personas/:id/activate", async (req, res) => {
    try {
      await storage.setActivePersona(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(404).json({ error: err.message || "Persona not found" });
    }
  });

  // ─── Memory ───────────────────────────────────────────────
  app.get("/api/memory", async (req, res) => {
    const personaId = req.query.personaId ? parseInt(req.query.personaId as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    res.json(await storage.getMemoryEntries(personaId, limit, offset));
  });

  app.post("/api/memory", async (req, res) => {
    const parsed = insertMemoryEntrySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const entry = await storage.createMemoryEntry(parsed.data);
    generateEmbedding(entry.fact).then((emb) => {
      if (emb) storage.updateMemoryEmbedding(entry.id, emb).catch(() => {});
    }).catch(() => {});
    res.status(201).json(entry);
  });

  app.patch("/api/memory/:id", async (req, res) => {
    const parsed = insertMemoryEntrySchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const entry = await storage.updateMemoryEntry(parseInt(req.params.id), parsed.data);
    if (!entry) return res.status(404).json({ error: "Not found" });
    res.json(entry);
  });

  app.delete("/api/memory/:id", async (req, res) => {
    await storage.deleteMemoryEntry(parseInt(req.params.id));
    res.status(204).send();
  });

  // ─── Daily Notes ──────────────────────────────────────────
  app.get("/api/daily-notes", async (req, res) => {
    const personaId = req.query.personaId ? parseInt(req.query.personaId as string) : undefined;
    res.json(await storage.getDailyNotes(personaId));
  });

  app.get("/api/daily-notes/:date", async (req, res) => {
    const personaId = req.query.personaId ? parseInt(req.query.personaId as string) : undefined;
    const note = await storage.getDailyNote(req.params.date, personaId);
    res.json(note || { date: req.params.date, content: "", personaId: null });
  });

  app.put("/api/daily-notes/:date", async (req, res) => {
    const parsed = insertDailyNoteSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const note = await storage.upsertDailyNote({ date: req.params.date, content: parsed.data.content || "", personaId: parsed.data.personaId || null });
    res.json(note);
  });

  // ─── Knowledge Base ─────────────────────────────────────────
  app.get("/api/knowledge", async (req, res) => {
    const personaId = req.query.personaId ? parseInt(req.query.personaId as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    res.json(await storage.getKnowledge(personaId, limit, offset));
  });

  app.post("/api/knowledge", async (req, res) => {
    const parsed = insertKnowledgeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const entry = await storage.createKnowledge(parsed.data);
    generateEmbedding(`${entry.title} ${entry.content}`).then((emb) => {
      if (emb) storage.updateKnowledgeEmbedding(entry.id, emb).catch(() => {});
    }).catch(() => {});
    res.json(entry);
  });

  app.patch("/api/knowledge/:id", async (req, res) => {
    const partial = insertKnowledgeSchema.partial().safeParse(req.body);
    if (!partial.success) return res.status(400).json({ error: partial.error.message });
    const entry = await storage.updateKnowledge(parseInt(req.params.id), partial.data);
    if (!entry) return res.status(404).json({ error: "Not found" });
    res.json(entry);
  });

  app.delete("/api/knowledge/:id", async (req, res) => {
    await storage.deleteKnowledge(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ─── Memory Stats ─────────────────────────────────────────
  app.get("/api/memory/stats", async (req, res) => {
    const personaId = req.query.personaId ? parseInt(req.query.personaId as string) : undefined;
    const stats = await storage.getMemoryStats(personaId);
    res.json(stats);
  });

  // ─── Embedding Backfill ───────────────────────────────────
  app.post("/api/memory/backfill-embeddings", async (_req, res) => {
    try {
      const memoriesWithout = await storage.getMemoriesWithoutEmbeddings(100);
      const knowledgeWithout = await storage.getKnowledgeWithoutEmbeddings(100);

      const memCount = await generateAndStoreEmbeddings(
        memoriesWithout.map((m) => ({ id: m.id, text: m.fact })),
        (id, emb) => storage.updateMemoryEmbedding(id, emb),
      );
      const kCount = await generateAndStoreEmbeddings(
        knowledgeWithout.map((k) => ({ id: k.id, text: `${k.title} ${k.content}` })),
        (id, emb) => storage.updateKnowledgeEmbedding(id, emb),
      );

      res.json({
        memoriesProcessed: memCount,
        knowledgeProcessed: kCount,
        memoriesRemaining: Math.max(0, memoriesWithout.length - memCount),
        knowledgeRemaining: Math.max(0, knowledgeWithout.length - kCount),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Heartbeat ──────────────────────────────────────────────
  app.get("/api/heartbeat/tasks", async (req, res) => {
    const personaId = req.query.personaId ? parseInt(req.query.personaId as string) : undefined;
    res.json(await storage.getHeartbeatTasks(personaId));
  });

  app.post("/api/heartbeat/tasks", async (req, res) => {
    const parsed = insertHeartbeatTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const task = await storage.createHeartbeatTask(parsed.data);
    res.status(201).json(task);
  });

  app.patch("/api/heartbeat/tasks/:id", async (req, res) => {
    const parsed = insertHeartbeatTaskSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const task = await storage.updateHeartbeatTask(parseInt(req.params.id), parsed.data);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  });

  app.delete("/api/heartbeat/tasks/:id", async (req, res) => {
    await storage.deleteHeartbeatTask(parseInt(req.params.id));
    res.status(204).send();
  });

  app.get("/api/heartbeat/logs", async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const personaId = req.query.personaId ? parseInt(req.query.personaId as string) : undefined;
    res.json(await storage.getHeartbeatLogs(limit, personaId));
  });

  app.get("/api/heartbeat/status", async (_req, res) => {
    const [tasks, recentLogs, personas] = await Promise.all([
      storage.getHeartbeatTasks(),
      storage.getHeartbeatLogs(5),
      storage.getPersonas(),
    ]);
    const enabledCount = tasks.filter((t) => t.enabled).length;
    const tasksByPersona = new Map<number, { total: number; enabled: number }>();
    for (const t of tasks) {
      if (t.personaId) {
        const entry = tasksByPersona.get(t.personaId) || { total: 0, enabled: 0 };
        entry.total++;
        if (t.enabled) entry.enabled++;
        tasksByPersona.set(t.personaId, entry);
      }
    }
    const agentSummary = personas.map((p) => {
      const entry = tasksByPersona.get(p.id) || { total: 0, enabled: 0 };
      return {
        id: p.id,
        name: p.name,
        role: p.role,
        icon: p.icon,
        totalTasks: entry.total,
        enabledTasks: entry.enabled,
        isActive: p.isActive,
      };
    });
    const systemTasks = tasks.filter(t => !t.personaId);
    res.json({
      running: isHeartbeatRunning(),
      totalTasks: tasks.length,
      enabledTasks: enabledCount,
      systemTasks: systemTasks.length,
      agents: agentSummary,
      recentLogs,
    });
  });

  app.post("/api/heartbeat/start", async (_req, res) => {
    startHeartbeat();
    res.json({ running: true });
  });

  app.post("/api/heartbeat/stop", async (_req, res) => {
    stopHeartbeat();
    res.json({ running: false });
  });

  app.post("/api/heartbeat/delegate", async (req, res) => {
    const { fromPersonaId, targetPersona, taskName, description, prompt, schedule, model } = req.body;
    if (!targetPersona || !taskName || !prompt) {
      return res.status(400).json({ error: "targetPersona, taskName, and prompt are required" });
    }
    const result = await delegateTaskFromChat(
      fromPersonaId || null,
      targetPersona,
      taskName,
      description || "",
      prompt,
      schedule || "once",
      model || "gpt-5-nano"
    );
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  });

  // ─── Search ────────────────────────────────────────────────
  app.get("/api/search", async (req, res) => {
    const q = (req.query.q as string || "").trim();
    if (!q) return res.json([]);
    const results = await storage.searchConversations(q);
    res.json(results);
  });

  // ─── Cloud Backup ──────────────────────────────────────
  app.post("/api/backup/cloud", async (_req, res) => {
    try {
      const { runBackupToGoogleDrive } = await import("./backup");
      const summary = await runBackupToGoogleDrive();
      res.json({ success: true, summary });
    } catch (err: any) {
      console.error("[backup] Manual backup failed:", err.message);
      res.status(500).json({ error: "Backup failed: " + err.message });
    }
  });

  // ─── Export / Import ──────────────────────────────────────
  app.get("/api/export", async (_req, res) => {
    try {
      const data = await storage.getAllDataForExport();
      res.setHeader("Content-Disposition", `attachment; filename="visionclaw-export-${new Date().toISOString().split("T")[0]}.json"`);
      res.setHeader("Content-Type", "application/json");
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/import", async (req, res) => {
    try {
      const data = req.body;
      if (!data || !data.version) {
        return res.status(400).json({ error: "Invalid export file format" });
      }
      let imported = { conversations: 0, messages: 0, personas: 0, memories: 0, knowledge: 0, tasks: 0 };

      if (data.personas?.length) {
        for (const p of data.personas) {
          try {
            const { id, isActive, createdAt, ...rest } = p;
            await storage.createPersona(rest);
            imported.personas++;
          } catch {}
        }
      }

      if (data.memoryEntries?.length) {
        for (const m of data.memoryEntries) {
          try {
            const { id, createdAt, ...rest } = m;
            await storage.createMemoryEntry({ ...rest, personaId: rest.personaId || null });
            imported.memories++;
          } catch {}
        }
      }

      if (data.knowledge?.length) {
        for (const k of data.knowledge) {
          try {
            const { id, createdAt, updatedAt, ...rest } = k;
            await storage.createKnowledge({ ...rest, personaId: rest.personaId || null });
            imported.knowledge++;
          } catch {}
        }
      }

      if (data.conversations?.length) {
        for (const conv of data.conversations) {
          try {
            const { id: oldId, createdAt, updatedAt, ...rest } = conv;
            const newConv = await storage.createConversation(rest);
            imported.conversations++;
            const convMessages = (data.messages || []).filter((m: any) => m.conversationId === oldId);
            for (const msg of convMessages) {
              try {
                const { id, createdAt, ...msgRest } = msg;
                await storage.createMessage({ ...msgRest, conversationId: newConv.id });
                imported.messages++;
              } catch {}
            }
          } catch {}
        }
      }

      if (data.heartbeatTasks?.length) {
        for (const t of data.heartbeatTasks) {
          try {
            const { id, createdAt, lastRunAt, nextRunAt, ...rest } = t;
            await storage.createHeartbeatTask(rest);
            imported.tasks++;
          } catch {}
        }
      }

      res.json({ success: true, imported });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Stats ─────────────────────────────────────────────────
  app.get("/api/stats", async (_req, res) => {
    const { db } = await import("./db");
    const { sql: s } = await import("drizzle-orm");
    const [[convCount], [msgCount], activePersona] = await Promise.all([
      db.select({ count: s<number>`count(*)::int` }).from(conversations),
      db.select({ count: s<number>`count(*)::int` }).from(messages),
      storage.getActivePersona(),
    ]);
    const memResult = await storage.getMemoryEntries(activePersona?.id, 1, 0);
    res.json({
      totalConversations: convCount.count,
      totalMessages: msgCount.count,
      totalMemories: memResult.total,
      activePersona: activePersona?.name || null,
      status: "online",
      uptime: process.uptime(),
    });
  });

  app.get("/api/stripe/publishable-key", async (_req: Request, res: Response) => {
    try {
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to get Stripe key" });
    }
  });

  app.get("/api/stripe/products", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`
        SELECT 
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.active as product_active,
          p.metadata as product_metadata,
          p.images as product_images,
          pr.id as price_id,
          pr.unit_amount,
          pr.currency,
          pr.recurring,
          pr.active as price_active
        FROM stripe.products p
        LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        WHERE p.active = true
        ORDER BY p.name, pr.unit_amount
      `);

      const productsMap = new Map<string, any>();
      for (const row of result.rows) {
        const r = row as any;
        if (!productsMap.has(r.product_id)) {
          productsMap.set(r.product_id, {
            id: r.product_id,
            name: r.product_name,
            description: r.product_description,
            active: r.product_active,
            metadata: r.product_metadata,
            images: r.product_images,
            prices: [],
          });
        }
        if (r.price_id) {
          productsMap.get(r.product_id).prices.push({
            id: r.price_id,
            unit_amount: r.unit_amount,
            currency: r.currency,
            recurring: r.recurring,
            active: r.price_active,
          });
        }
      }

      res.json({ products: Array.from(productsMap.values()) });
    } catch (err: any) {
      console.error("[stripe] Products list error:", err.message);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.post("/api/stripe/checkout", async (req: Request, res: Response) => {
    try {
      const { priceId, mode, customerEmail } = req.body;
      if (!priceId || typeof priceId !== "string") return res.status(400).json({ error: "priceId required" });
      if (mode && !["payment", "subscription"].includes(mode)) return res.status(400).json({ error: "mode must be 'payment' or 'subscription'" });
      if (customerEmail && (typeof customerEmail !== "string" || !customerEmail.includes("@"))) return res.status(400).json({ error: "Invalid email" });

      const domains = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || "";
      const primaryDomain = domains.split(",")[0]?.trim();
      const baseUrl = primaryDomain ? `https://${primaryDomain}` : `${req.protocol}://${req.get('host')}`;

      const stripe = await getUncachableStripeClient();
      const sessionData: any = {
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: mode || 'payment',
        success_url: `${baseUrl}/payments?status=success`,
        cancel_url: `${baseUrl}/payments?status=cancelled`,
      };
      if (customerEmail) sessionData.customer_email = customerEmail;

      const session = await stripe.checkout.sessions.create(sessionData);
      res.json({ url: session.url, sessionId: session.id });
    } catch (err: any) {
      console.error("[stripe] Checkout error:", err.message);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.post("/api/stripe/create-product", async (req: Request, res: Response) => {
    try {
      const { name, description, price, currency, recurring, metadata } = req.body;
      if (!name || typeof name !== "string") return res.status(400).json({ error: "name required" });
      if (!price || typeof price !== "number" || price <= 0) return res.status(400).json({ error: "price must be a positive number" });
      const allowedCurrencies = ["usd", "eur", "gbp", "cad", "aud"];
      if (currency && !allowedCurrencies.includes(currency)) return res.status(400).json({ error: "unsupported currency" });
      if (recurring && !["month", "year"].includes(recurring)) return res.status(400).json({ error: "recurring must be 'month' or 'year'" });

      const stripe = await getUncachableStripeClient();
      const product = await stripe.products.create({
        name,
        description: description || undefined,
        metadata: metadata || {},
      });

      const priceData: any = {
        product: product.id,
        unit_amount: Math.round(price * 100),
        currency: currency || 'usd',
      };
      if (recurring) {
        priceData.recurring = { interval: recurring };
      }

      const stripePrice = await stripe.prices.create(priceData);

      res.json({
        product: { id: product.id, name: product.name },
        price: { id: stripePrice.id, unit_amount: stripePrice.unit_amount, currency: stripePrice.currency },
      });
    } catch (err: any) {
      console.error("[stripe] Create product error:", err.message);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.get("/api/stripe/payments", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`
        SELECT id, amount, currency, status, created
        FROM stripe.payment_intents
        ORDER BY created DESC
        LIMIT 50
      `);
      res.json({ payments: result.rows });
    } catch (err: any) {
      console.error("[stripe] Payments list error:", err.message);
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  // ─── Analytics ─────────────────────────────────────────
  app.get("/api/analytics", async (_req: Request, res: Response) => {
    try {
      const analytics = await storage.getAnalytics();
      res.json(analytics);
    } catch (err: any) {
      console.error("[analytics] Error:", err.message);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // ─── Context Summary ─────────────────────────────────────
  app.get("/api/context/summary", async (_req: Request, res: Response) => {
    try {
      const summary = await storage.getContextSummary();
      res.json(summary);
    } catch (err: any) {
      console.error("[context] Error:", err.message);
      res.status(500).json({ error: "Failed to fetch context" });
    }
  });

  // ─── Conversation Templates ───────────────────────────────
  app.get("/api/templates", async (_req: Request, res: Response) => {
    res.json(await storage.getConversationTemplates());
  });

  app.post("/api/templates", async (req: Request, res: Response) => {
    try {
      const { insertConversationTemplateSchema } = await import("@shared/schema");
      const parsed = insertConversationTemplateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const template = await storage.createConversationTemplate(parsed.data);
      res.status(201).json(template);
    } catch (err: any) {
      console.error("[templates] Error:", err.message);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.patch("/api/templates/:id", async (req: Request, res: Response) => {
    try {
      const { insertConversationTemplateSchema } = await import("@shared/schema");
      const parsed = insertConversationTemplateSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const updated = await storage.updateConversationTemplate(parseInt(req.params.id), parsed.data);
      res.json(updated);
    } catch (err: any) {
      console.error("[templates] Update error:", err.message);
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  app.delete("/api/templates/:id", async (req: Request, res: Response) => {
    await storage.deleteConversationTemplate(parseInt(req.params.id));
    res.status(204).send();
  });

  app.post("/api/templates/:id/start", async (req: Request, res: Response) => {
    try {
      const templates = await storage.getConversationTemplates();
      const template = templates.find(t => t.id === parseInt(req.params.id));
      if (!template) return res.status(404).json({ error: "Template not found" });

      const activePersona = await storage.getActivePersona();
      const settings = await storage.getSettings();
      const conv = await storage.createConversation({
        title: template.name,
        model: template.model || settings?.defaultModel || "gpt-5.1",
        thinking: settings?.thinkingEnabled ?? false,
        personaId: template.personaId || activePersona?.id || null,
      });

      if (template.systemPromptPrefix) {
        await storage.createMessage({ conversationId: conv.id, role: "system", content: template.systemPromptPrefix });
      }

      if (template.starterMessages && template.starterMessages.length > 0) {
        for (const msg of template.starterMessages) {
          await storage.createMessage({ conversationId: conv.id, role: "user", content: msg });
        }
      }

      res.status(201).json(conv);
    } catch (err: any) {
      console.error("[templates] Start error:", err.message);
      res.status(500).json({ error: "Failed to start from template" });
    }
  });

  return httpServer;
}

import OpenAI from "openai";
import { storage } from "./storage";

const EMBEDDING_MODEL = "text-embedding-3-small";

let cachedOpenaiClient: OpenAI | null = null;
let lastKeyCheck = 0;

async function getOpenAIClient(): Promise<OpenAI | null> {
  const now = Date.now();
  if (cachedOpenaiClient && now - lastKeyCheck < 60_000) return cachedOpenaiClient;

  try {
    const key = await storage.getProviderKey("openai");
    if (key?.apiKey && key.enabled) {
      cachedOpenaiClient = new OpenAI({ apiKey: key.apiKey, baseURL: "https://api.openai.com/v1" });
      lastKeyCheck = now;
      return cachedOpenaiClient;
    }
  } catch {}
  cachedOpenaiClient = null;
  lastKeyCheck = now;
  return null;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
}

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her",
  "was", "one", "our", "out", "has", "have", "been", "from", "this", "that",
  "with", "they", "will", "each", "make", "like", "just", "into", "over",
  "also", "some", "than", "them", "very", "when", "what", "your", "how",
  "about", "which", "their", "there", "would", "other", "more", "these",
  "then", "could", "does", "should",
]);

function buildBagOfWords(text: string): Map<string, number> {
  const tokens = tokenize(text).filter((t) => !STOP_WORDS.has(t));
  const bag = new Map<string, number>();
  for (const t of tokens) {
    bag.set(t, (bag.get(t) || 0) + 1);
  }
  return bag;
}

function bagCosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, normA = 0, normB = 0;
  for (const [word, count] of a) {
    normA += count * count;
    if (b.has(word)) dot += count * b.get(word)!;
  }
  for (const [, count] of b) normB += count * count;
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const cleaned = text.slice(0, 8000).replace(/\n+/g, " ").trim();
    if (!cleaned) return null;

    const client = await getOpenAIClient();
    if (!client) return null;

    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: cleaned,
    });

    return response.data[0]?.embedding ?? null;
  } catch (err: any) {
    console.error("[embeddings] Failed to generate:", err.message);
    return null;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export interface EmbeddedItem {
  id: number;
  embedding: number[] | null;
}

export function keywordSimilarity(query: string, text: string): number {
  const qBag = buildBagOfWords(query);
  const tBag = buildBagOfWords(text);
  return bagCosineSimilarity(qBag, tBag);
}

export async function rankBySimilarity<T extends EmbeddedItem & { text?: string }>(
  query: string,
  items: T[],
  topK: number = 10,
): Promise<(T & { similarity: number })[]> {
  const queryEmbedding = await generateEmbedding(query);

  const scored = items.map((item) => {
    let similarity = 0;
    if (queryEmbedding && item.embedding) {
      similarity = cosineSimilarity(queryEmbedding, item.embedding);
    } else if (item.text) {
      similarity = keywordSimilarity(query, item.text);
    }
    return { ...item, similarity };
  });

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}

export async function generateAndStoreEmbeddings(
  items: { id: number; text: string }[],
  updateFn: (id: number, embedding: number[]) => Promise<void>,
): Promise<number> {
  let count = 0;
  for (const item of items) {
    const embedding = await generateEmbedding(item.text);
    if (embedding) {
      await updateFn(item.id, embedding);
      count++;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return count;
}

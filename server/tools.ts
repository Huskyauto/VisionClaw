import { storage } from "./storage";
import { getAvailableModels, PROVIDER_CONFIG, getClientForModel } from "./providers";
import { isHeartbeatRunning, delegateTaskFromChat } from "./heartbeat";
import { generateEmbedding } from "./embeddings";
import { db } from "./db";
import { messages as messagesTable } from "@shared/schema";
import { sql } from "drizzle-orm";

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "test_api_keys",
      description: "Test all configured AI provider API keys for connectivity. Returns status, latency, and details for each provider (OpenAI, Anthropic, xAI, Google, Perplexity, OpenRouter, Replit).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "check_system_status",
      description: "Get full system health: uptime, conversation count, message count, memory stats, heartbeat status, and active persona info.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_models",
      description: "List all currently available AI models based on configured API keys. Shows model name, provider, tier, and description.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_memory",
      description: "Search the agent's long-term memory for facts about the user. Use when the user asks 'do you remember...' or when you need to recall stored information.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query - keywords or phrase to match against stored memories" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_memory",
      description: "Store a new fact about the user in long-term memory. Use for important preferences, personal details, or things the user explicitly asks you to remember.",
      parameters: {
        type: "object",
        properties: {
          fact: { type: "string", description: "The fact to remember (concise, specific)" },
          category: { type: "string", enum: ["preference", "relationship", "milestone", "status"], description: "Category of the memory" },
        },
        required: ["fact", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_knowledge",
      description: "Search the permanent knowledge base for reference material, guides, or documentation the agent has stored.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query to match against knowledge entries" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_knowledge",
      description: "Add a new entry to the permanent knowledge base. Use for storing reference material, guides, or important documentation.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Title of the knowledge entry" },
          content: { type: "string", description: "The knowledge content" },
          category: { type: "string", description: "Category (e.g. 'reference', 'guide', 'skill')" },
          priority: { type: "number", description: "Priority 1-5 (5=highest)" },
        },
        required: ["title", "content", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_daily_notes",
      description: "Retrieve the agent's activity log and notes for a specific date or recent days. Useful for recalling what happened on a given day.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date in YYYY-MM-DD format. If omitted, returns last 7 days." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_conversations",
      description: "List recent conversations with titles, dates, and models used. Useful for finding past discussions.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max conversations to return (default 20)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_fetch",
      description: "Fetch and read content from a URL. Uses Jina AI reader to extract clean text from web pages. Use for looking up documentation, news, or any web content.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to fetch content from" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for information using Wikipedia and Jina AI. Use when the user asks a factual question, needs current information, or you need to research a topic before responding.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query — keywords or question to search for" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_daily_note",
      description: "Write or append to today's daily notes. Use to log important events, decisions, lessons learned, or anything worth recording during the conversation. Memory rule: if you want to remember it, write it down NOW.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Content to write — events, decisions, lessons, or notes" },
          section: { type: "string", enum: ["events", "decisions", "lessons", "tomorrow"], description: "Which section to write to (default: events)" },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_memory",
      description: "Update an existing memory entry — change the fact text, category, or archive it. Use when information about the user changes or becomes outdated.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "ID of the memory entry to update" },
          fact: { type: "string", description: "Updated fact text (optional — omit to keep current)" },
          category: { type: "string", enum: ["preference", "relationship", "milestone", "status"], description: "Updated category (optional)" },
          status: { type: "string", enum: ["active", "archived"], description: "Set to 'archived' to retire outdated memories" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_chart",
      description: "Generate an interactive chart that will be rendered inline in the chat. Use when the user asks for data visualization, comparisons, trends, or any visual representation of data.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["bar", "line", "pie", "area"], description: "Type of chart to generate" },
          title: { type: "string", description: "Chart title" },
          data: {
            type: "array",
            items: { type: "object" },
            description: "Array of data objects. Each object should have keys matching xKey and yKey. For pie charts, use 'name' and 'value' keys.",
          },
          xKey: { type: "string", description: "Key in data objects for x-axis (or 'name' for pie charts)" },
          yKey: { type: "string", description: "Key in data objects for y-axis values (or 'value' for pie charts). Can be comma-separated for multiple series." },
          colors: { type: "array", items: { type: "string" }, description: "Optional array of hex color codes for the chart" },
        },
        required: ["type", "title", "data"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delegate_task",
      description: "Delegate a task to another agent (persona) for autonomous execution via the heartbeat system. Use when a task should be handled by a specialist agent or needs to run independently.",
      parameters: {
        type: "object",
        properties: {
          targetAgent: { type: "string", description: "Name of the agent to delegate to (must match an existing persona name)" },
          taskName: { type: "string", description: "Short name for the task" },
          description: { type: "string", description: "What needs to be done" },
          prompt: { type: "string", description: "Detailed instructions for the agent" },
          schedule: { type: "string", description: "'once' for one-shot tasks, or a cron expression like '0 8 * * *' for recurring" },
        },
        required: ["targetAgent", "taskName", "prompt"],
      },
    },
  },
];

const testModels: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-6",
  xai: "grok-3-mini",
  google: "gemini-2.5-flash",
  perplexity: "sonar",
  openrouter: "openrouter/auto",
};

async function testApiKeys() {
  const keys = await storage.getProviderKeys();
  const results: Record<string, any> = {};
  results["replit"] = { connected: true, provider: "Replit AI (Built-in)", detail: "Always available" };

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
      results[key.provider] = { connected: true, provider: PROVIDER_CONFIG[key.provider]?.name || key.provider, detail: `OK - "${reply}" (${latencyMs}ms)`, latencyMs };
    } catch (err: any) {
      results[key.provider] = { connected: false, provider: PROVIDER_CONFIG[key.provider]?.name || key.provider, detail: err.message?.slice(0, 200) || "Error", latencyMs: Date.now() - start };
    }
  }
  return results;
}

async function checkSystemStatus() {
  const [convResult, settings, persona, memStats, heartbeatRunning, tasks, logs] = await Promise.all([
    storage.getConversations(),
    storage.getSettings(),
    storage.getActivePersona(),
    storage.getMemoryStats(),
    Promise.resolve(isHeartbeatRunning()),
    storage.getHeartbeatTasks(),
    storage.getHeartbeatLogs(5),
  ]);
  const conversations = convResult.data;
  const [msgCountResult] = await db.select({ count: sql<number>`count(*)::int` }).from(messagesTable);

  return {
    uptime: process.uptime(),
    totalConversations: convResult.total,
    totalMessages: msgCountResult.count,
    activePersona: persona ? { name: persona.name, role: persona.role } : null,
    memory: memStats,
    heartbeat: {
      running: heartbeatRunning,
      totalTasks: tasks.length,
      enabledTasks: tasks.filter((t) => t.enabled).length,
      recentLogs: logs.map((l) => ({ task: l.taskName, status: l.status, ranAt: l.createdAt })),
    },
    agentName: settings?.agentName || "VisionClaw",
  };
}

async function searchMemory(query: string) {
  const persona = await storage.getActivePersona();
  const memResult = await storage.getMemoryEntries(persona?.id);
  const q = query.toLowerCase();
  const matches = memResult.data
    .filter((m) => m.status === "active" && (m.fact.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)))
    .slice(0, 20);
  return { count: matches.length, total: memResult.total, results: matches.map((m) => ({ id: m.id, fact: m.fact, category: m.category, lastAccessed: m.lastAccessed })) };
}

async function createMemory(fact: string, category: string) {
  const persona = await storage.getActivePersona();
  const entry = await storage.createMemoryEntry({ fact, category, source: "tool", status: "active", personaId: persona?.id ?? null });
  return { created: true, id: entry.id, fact: entry.fact, category: entry.category };
}

async function searchKnowledge(query: string) {
  const persona = await storage.getActivePersona();
  const knResult = await storage.getKnowledge(persona?.id);
  const q = query.toLowerCase();
  const matches = knResult.data
    .filter((k) => k.title.toLowerCase().includes(q) || k.content.toLowerCase().includes(q) || k.category.toLowerCase().includes(q))
    .slice(0, 10);
  return { count: matches.length, results: matches.map((k) => ({ id: k.id, title: k.title, category: k.category, content: k.content.slice(0, 500), priority: k.priority })) };
}

async function createKnowledge(title: string, content: string, category: string, priority?: number) {
  const persona = await storage.getActivePersona();
  const entry = await storage.createKnowledge({ title, content, category, priority: priority ?? 3, personaId: persona?.id ?? null });
  return { created: true, id: entry.id, title: entry.title };
}

async function getDailyNotes(date?: string) {
  const persona = await storage.getActivePersona();
  if (date) {
    const note = await storage.getDailyNote(date, persona?.id);
    return note ? { date, content: note.content } : { date, content: null, message: "No notes for this date" };
  }
  const notes = await storage.getRecentDailyNotes(7, persona?.id);
  return { days: notes.length, notes: notes.map((n) => ({ date: n.date, content: n.content?.slice(0, 500) })) };
}

async function listConversations(limit?: number) {
  const convResult = await storage.getConversations(limit || 20);
  return { total: convResult.total, conversations: convResult.data.map((c) => ({ id: c.id, title: c.title, model: c.model, thinking: c.thinking, updatedAt: c.updatedAt })) };
}

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254", "[::1]", "metadata.google.internal"]);

function isUrlSafe(urlStr: string): { safe: boolean; error?: string } {
  try {
    const parsed = new URL(urlStr);
    if (!["http:", "https:"].includes(parsed.protocol)) return { safe: false, error: "Only http/https URLs allowed" };
    const host = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(host)) return { safe: false, error: "Blocked host" };
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(host)) return { safe: false, error: "Private IP range blocked" };
    if (host.endsWith(".local") || host.endsWith(".internal")) return { safe: false, error: "Internal hostname blocked" };
    return { safe: true };
  } catch {
    return { safe: false, error: "Invalid URL" };
  }
}

async function webFetch(url: string) {
  const check = isUrlSafe(url);
  if (!check.safe) return { success: false, url, error: check.error };

  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const resp = await fetch(jinaUrl, {
      headers: { "Accept": "text/plain", "X-Return-Format": "text" },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    return { success: true, url, content: text.slice(0, 8000), truncated: text.length > 8000 };
  } catch (err: any) {
    return { success: false, url, error: err.message || "Fetch failed" };
  }
}

async function webSearch(query: string) {
  const results: { source: string; content: string }[] = [];

  try {
    const wikiQuery = encodeURIComponent(query);
    const wikiResp = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${wikiQuery}&format=json&srlimit=3&utf8=`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (wikiResp.ok) {
      const wikiData = await wikiResp.json();
      const wikiResults = wikiData?.query?.search || [];
      for (const r of wikiResults) {
        const snippet = r.snippet?.replace(/<[^>]*>/g, "") || "";
        results.push({ source: `Wikipedia: ${r.title}`, content: `${snippet} — https://en.wikipedia.org/wiki/${encodeURIComponent(r.title)}` });
      }
    }
  } catch {}

  try {
    const jinaUrl = `https://s.jina.ai/${encodeURIComponent(query)}`;
    const jinaResp = await fetch(jinaUrl, {
      headers: { "Accept": "text/plain", "X-Return-Format": "text" },
      signal: AbortSignal.timeout(12000),
    });
    if (jinaResp.ok) {
      const text = await jinaResp.text();
      results.push({ source: "Web Search", content: text.slice(0, 5000) });
    }
  } catch {}

  if (results.length === 0) {
    return { success: false, query, error: "No results found" };
  }
  return { success: true, query, resultCount: results.length, results };
}

async function writeDailyNote(content: string, section?: string) {
  const persona = await storage.getActivePersona();
  const today = new Date().toISOString().split("T")[0];
  const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const existing = await storage.getDailyNote(today, persona?.id);

  const sectionHeader = section === "decisions" ? "## Decisions Made"
    : section === "lessons" ? "## Lessons Learned"
    : section === "tomorrow" ? "## Tomorrow"
    : "## What Happened";

  const entry = `- ${time}: ${content}`;
  let newContent: string;

  if (existing?.content) {
    if (existing.content.includes(sectionHeader)) {
      const idx = existing.content.indexOf(sectionHeader);
      const nextSection = existing.content.indexOf("\n## ", idx + sectionHeader.length);
      if (nextSection > -1) {
        newContent = existing.content.slice(0, nextSection) + `\n${entry}` + existing.content.slice(nextSection);
      } else {
        newContent = existing.content + `\n${entry}`;
      }
    } else {
      newContent = existing.content + `\n\n${sectionHeader}\n${entry}`;
    }
  } else {
    newContent = `# ${today}\n\n${sectionHeader}\n${entry}`;
  }

  await storage.upsertDailyNote({ date: today, content: newContent.slice(0, 10000), personaId: persona?.id ?? null });
  return { written: true, date: today, section: section || "events" };
}

async function updateMemory(id: number, fact?: string, category?: string, status?: string) {
  const persona = await storage.getActivePersona();
  const memResult = await storage.getMemoryEntries(persona?.id);
  const target = memResult.data.find((m) => m.id === id);
  if (!target) {
    return { updated: false, error: `Memory entry ${id} not found or does not belong to the active persona` };
  }

  const updates: Record<string, any> = {};
  if (fact) updates.fact = fact;
  if (category) updates.category = category;
  if (status) updates.status = status;

  if (Object.keys(updates).length === 0) {
    return { updated: false, error: "No fields to update" };
  }

  await storage.updateMemoryEntry(id, updates);

  if (fact) {
    generateEmbedding(fact).then((emb) => {
      if (emb) storage.updateMemoryEmbedding(id, emb).catch(() => {});
    }).catch(() => {});
  }

  return { updated: true, id, changes: Object.keys(updates) };
}

async function delegateTask(targetAgent: string, taskName: string, description: string, prompt: string, schedule: string) {
  const persona = await storage.getActivePersona();
  const result = await delegateTaskFromChat(
    persona?.id ?? null,
    targetAgent,
    taskName,
    description || `Delegated from chat`,
    prompt,
    schedule || "once",
    "gpt-5-nano"
  );
  return result;
}

export async function executeTool(name: string, params: Record<string, any>): Promise<any> {
  switch (name) {
    case "test_api_keys":
      return testApiKeys();
    case "check_system_status":
      return checkSystemStatus();
    case "list_models":
      return { models: await getAvailableModels() };
    case "search_memory":
      return searchMemory(params.query || "");
    case "create_memory":
      return createMemory(params.fact, params.category || "preference");
    case "search_knowledge":
      return searchKnowledge(params.query || "");
    case "create_knowledge":
      return createKnowledge(params.title, params.content, params.category || "reference", params.priority);
    case "get_daily_notes":
      return getDailyNotes(params.date);
    case "list_conversations":
      return listConversations(params.limit);
    case "web_fetch":
      return webFetch(params.url);
    case "web_search":
      return webSearch(params.query || "");
    case "write_daily_note":
      return writeDailyNote(params.content, params.section);
    case "update_memory":
      return updateMemory(params.id, params.fact, params.category, params.status);
    case "generate_chart":
      return { chartData: { type: params.type, title: params.title, data: params.data, xKey: params.xKey || "name", yKey: params.yKey || "value", colors: params.colors } };
    case "delegate_task":
      return delegateTask(params.targetAgent, params.taskName, params.description || "", params.prompt, params.schedule || "once");
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export const PROVIDERS_SUPPORTING_TOOLS = new Set(["replit", "openai", "google", "xai", "openrouter"]);

import OpenAI from "openai";
import { storage } from "./storage";

export const replitOpenai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface ModelInfo {
  id: string;
  label: string;
  provider: string;
  tier: "fast" | "balanced" | "powerful" | "reasoning";
  description: string;
}

export const MODEL_REGISTRY: ModelInfo[] = [
  { id: "gpt-5.1", label: "GPT-5.1", provider: "replit", tier: "powerful", description: "Recommended default - powerful and versatile" },
  { id: "gpt-5", label: "GPT-5", provider: "replit", tier: "powerful", description: "Capable general-purpose model" },
  { id: "gpt-5-mini", label: "GPT-5 Mini", provider: "replit", tier: "balanced", description: "Fast and cost-effective" },
  { id: "gpt-5-nano", label: "GPT-5 Nano", provider: "replit", tier: "fast", description: "Fastest, lightweight tasks" },
  { id: "o4-mini", label: "o4 Mini", provider: "replit", tier: "reasoning", description: "Reasoning/thinking model" },

  { id: "gpt-4o", label: "GPT-4o", provider: "openai", tier: "powerful", description: "OpenAI flagship multimodal" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai", tier: "balanced", description: "Fast and affordable" },
  { id: "gpt-4.1", label: "GPT-4.1", provider: "openai", tier: "powerful", description: "Coding & instruction following" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", provider: "openai", tier: "balanced", description: "Balanced speed and intelligence" },
  { id: "gpt-4.1-nano", label: "GPT-4.1 Nano", provider: "openai", tier: "fast", description: "Fastest OpenAI model" },
  { id: "o4-mini-openai", label: "o4 Mini (OpenAI)", provider: "openai", tier: "reasoning", description: "OpenAI reasoning model" },

  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4", provider: "anthropic", tier: "powerful", description: "Anthropic's best balanced model" },
  { id: "claude-opus-4-6", label: "Claude Opus 4", provider: "anthropic", tier: "powerful", description: "Most capable, complex reasoning and coding" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "anthropic", tier: "fast", description: "Fastest and most compact" },

  { id: "grok-3", label: "Grok 3", provider: "xai", tier: "powerful", description: "xAI flagship model" },
  { id: "grok-3-mini", label: "Grok 3 Mini", provider: "xai", tier: "balanced", description: "Fast reasoning model" },
  { id: "grok-3-fast", label: "Grok 3 Fast", provider: "xai", tier: "fast", description: "Low-latency responses" },

  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash", provider: "google", tier: "powerful", description: "Latest hybrid reasoning, good for daily use" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", provider: "google", tier: "powerful", description: "Most powerful - agentic workflows and complex reasoning" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "google", tier: "powerful", description: "Strong reasoning, large context" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google", tier: "balanced", description: "Fast and very cheap - great default for cost control" },

  { id: "sonar-pro", label: "Sonar Pro", provider: "perplexity", tier: "powerful", description: "Deep web research with citations" },
  { id: "sonar", label: "Sonar", provider: "perplexity", tier: "balanced", description: "Fast web search with citations" },
  { id: "sonar-reasoning-pro", label: "Sonar Reasoning Pro", provider: "perplexity", tier: "reasoning", description: "Multi-step research with reasoning" },
  { id: "sonar-reasoning", label: "Sonar Reasoning", provider: "perplexity", tier: "reasoning", description: "Fast reasoning with web search" },
  { id: "sonar-deep-research", label: "Sonar Deep Research", provider: "perplexity", tier: "powerful", description: "Exhaustive multi-source research" },

  { id: "openrouter/auto", label: "Auto (Best)", provider: "openrouter", tier: "powerful", description: "OpenRouter picks the best model" },
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", provider: "openrouter", tier: "powerful", description: "Google's latest frontier model" },
  { id: "google/gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite", provider: "openrouter", tier: "fast", description: "Cheapest & fastest Google model" },
  { id: "qwen/qwen3.5-flash", label: "Qwen 3.5 Flash", provider: "openrouter", tier: "fast", description: "Ultra-cheap - $0.10/M in, $0.40/M out, 1M context" },
  { id: "qwen/qwen3.5-plus-02-15", label: "Qwen 3.5 Plus", provider: "openrouter", tier: "balanced", description: "Multimodal, 1M context - $0.26/M in, $2.08/M out" },
  { id: "qwen/qwen3-coder-next", label: "Qwen3 Coder", provider: "openrouter", tier: "balanced", description: "Coding agent, 256K context - $0.12/M in" },
  { id: "moonshotai/kimi-k2.5", label: "Kimi K2.5", provider: "openrouter", tier: "powerful", description: "1T params, 32B active MoE - 5x cheaper than Claude" },
  { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick", provider: "openrouter", tier: "powerful", description: "Meta's open-source flagship" },
  { id: "deepseek/deepseek-r1", label: "DeepSeek R1", provider: "openrouter", tier: "reasoning", description: "Deep reasoning model" },
  { id: "deepseek/deepseek-chat-v3-0324", label: "DeepSeek V3", provider: "openrouter", tier: "balanced", description: "Strong general-purpose model" },
  { id: "mistralai/mistral-large-2411", label: "Mistral Large", provider: "openrouter", tier: "powerful", description: "Mistral flagship" },
];

export const PROVIDER_CONFIG: Record<string, { name: string; baseUrl: string; description: string }> = {
  replit: { name: "Replit AI (Built-in)", baseUrl: "", description: "Built-in - no API key needed" },
  openai: { name: "OpenAI", baseUrl: "https://api.openai.com/v1", description: "GPT-4o, GPT-4.1, o4-mini" },
  anthropic: { name: "Anthropic", baseUrl: "https://api.anthropic.com/v1", description: "Claude Sonnet 4, Claude 3.5 Haiku" },
  xai: { name: "xAI (Grok)", baseUrl: "https://api.x.ai/v1", description: "Grok 3, Grok 3 Mini" },
  google: { name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", description: "Gemini 3 Flash, 3.1 Flash Lite, 2.5 Pro - cheapest & fastest" },
  perplexity: { name: "Perplexity", baseUrl: "https://api.perplexity.ai", description: "Web research - Sonar, Sonar Pro, Deep Research" },
  openrouter: { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", description: "Qwen, Kimi, Llama, DeepSeek, Mistral & more - one key, many models" },
};

const INTEGRATION_ENV: Record<string, { apiKeyEnv: string; baseUrlEnv: string }> = {
  anthropic: { apiKeyEnv: "AI_INTEGRATIONS_ANTHROPIC_API_KEY", baseUrlEnv: "AI_INTEGRATIONS_ANTHROPIC_BASE_URL" },
  google: { apiKeyEnv: "AI_INTEGRATIONS_GEMINI_API_KEY", baseUrlEnv: "AI_INTEGRATIONS_GEMINI_BASE_URL" },
};

function getIntegrationClient(provider: string): OpenAI | null {
  const env = INTEGRATION_ENV[provider];
  if (!env) return null;
  const apiKey = process.env[env.apiKeyEnv];
  const baseURL = process.env[env.baseUrlEnv];
  if (!apiKey || !baseURL) return null;
  const cacheKey = `integration-${provider}`;
  if (!clientCache.has(cacheKey)) {
    clientCache.set(cacheKey, new OpenAI({ apiKey, baseURL }));
  }
  return clientCache.get(cacheKey)!;
}

export function hasIntegrationFallback(provider: string): boolean {
  const env = INTEGRATION_ENV[provider];
  if (!env) return false;
  return !!(process.env[env.apiKeyEnv] && process.env[env.baseUrlEnv]);
}

const clientCache = new Map<string, OpenAI>();

function getReplit(): OpenAI {
  if (!clientCache.has("replit")) {
    clientCache.set("replit", new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    }));
  }
  return clientCache.get("replit")!;
}

export async function getClientForModel(modelId: string): Promise<{ client: OpenAI; actualModelId: string }> {
  const model = MODEL_REGISTRY.find((m) => m.id === modelId);
  if (!model || model.provider === "replit") {
    return { client: getReplit(), actualModelId: modelId };
  }

  let actualModelId = modelId;
  if (modelId === "o4-mini-openai") actualModelId = "o4-mini";

  const providerKey = await storage.getProviderKey(model.provider);
  const hasUserKey = providerKey && providerKey.enabled && providerKey.apiKey;

  if (!hasUserKey) {
    const fallbackClient = getIntegrationClient(model.provider);
    if (fallbackClient) {
      return { client: fallbackClient, actualModelId };
    }
    throw new Error(`No API key configured for ${PROVIDER_CONFIG[model.provider]?.name || model.provider}. Add it in Settings > API Keys.`);
  }

  const cleanKey = providerKey.apiKey.replace(/[^\x20-\x7E]/g, (ch) => {
    const c = ch.charCodeAt(0);
    if (c === 0x2014 || c === 0x2013) return "-";
    return "";
  });
  const cacheKey = `${model.provider}-${cleanKey.slice(-8)}`;
  if (!clientCache.has(cacheKey)) {
    const baseUrl = PROVIDER_CONFIG[model.provider].baseUrl;
    
    clientCache.set(cacheKey, new OpenAI({
      apiKey: cleanKey,
      baseURL: baseUrl,
    }));
  }

  return { client: clientCache.get(cacheKey)!, actualModelId };
}

export function clearClientCache() {
  clientCache.delete("replit");
  for (const key of clientCache.keys()) {
    if (key !== "replit") clientCache.delete(key);
  }
}

export async function getAvailableModels(): Promise<ModelInfo[]> {
  const keys = await storage.getProviderKeys();
  const enabledProviders = new Set(keys.filter((k) => k.enabled).map((k) => k.provider));
  enabledProviders.add("replit");
  for (const provider of Object.keys(INTEGRATION_ENV)) {
    if (hasIntegrationFallback(provider)) {
      enabledProviders.add(provider);
    }
  }
  return MODEL_REGISTRY.filter((m) => enabledProviders.has(m.provider));
}

import { useState, useRef, useEffect, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send, Brain, Bot, User, Copy, Check, Loader2, Sparkles, ChevronDown, Settings2, ChevronRight, Wrench, ChevronUp, Paperclip, X, FileText, Image as ImageIcon, Users, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Conversation, Message, Persona } from "@shared/schema";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area,
} from "recharts";

const CHART_COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

interface ChartData {
  type: "bar" | "line" | "pie" | "area";
  title: string;
  data: Record<string, any>[];
  xKey?: string;
  yKey?: string;
  colors?: string[];
}

function ChartRenderer({ chart }: { chart: ChartData }) {
  const colors = chart.colors || CHART_COLORS;
  const xKey = chart.xKey || "name";
  const yKeys = (chart.yKey || "value").split(",").map(k => k.trim());

  return (
    <div className="my-3 p-3 rounded-lg bg-muted/30 border border-border" data-testid="inline-chart">
      <div className="text-xs font-medium text-foreground mb-2">{chart.title}</div>
      <ResponsiveContainer width="100%" height={200}>
        {chart.type === "pie" ? (
          <PieChart>
            <Pie data={chart.data} cx="50%" cy="50%" outerRadius={70} dataKey={yKeys[0]} nameKey={xKey}
              label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
              {chart.data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 11 }} />
          </PieChart>
        ) : chart.type === "area" ? (
          <AreaChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 11 }} />
            {yKeys.map((key, i) => <Area key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.3} />)}
          </AreaChart>
        ) : chart.type === "line" ? (
          <LineChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 11 }} />
            {yKeys.map((key, i) => <Line key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} />)}
          </LineChart>
        ) : (
          <BarChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 11 }} />
            {yKeys.map((key, i) => <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[2, 2, 0, 0]} />)}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function parseChartBlocks(content: string): { charts: ChartData[]; cleanContent: string } {
  const charts: ChartData[] = [];
  const cleaned = content.replace(/```chart\s*\n([\s\S]*?)```/g, (_, json) => {
    try {
      const parsed = JSON.parse(json.trim());
      if (parsed.chartData) charts.push(parsed.chartData);
      else if (parsed.type && parsed.data) charts.push(parsed);
    } catch {}
    return "";
  });
  return { charts, cleanContent: cleaned.trim() };
}

function extractChartsFromTools(tools: ToolCallInfo[]): ChartData[] {
  const charts: ChartData[] = [];
  for (const tool of tools) {
    if (tool.name === "generate_chart" && tool.output) {
      const out = typeof tool.output === "string" ? (() => { try { return JSON.parse(tool.output); } catch { return null; } })() : tool.output;
      if (out?.chartData) charts.push(out.chartData);
    }
  }
  return charts;
}

const getAuthUrl = (url: string) => {
  const token = localStorage.getItem("auth_token");
  return token && url.startsWith("/uploads/") ? url + "?token=" + token : url;
};

interface Attachment {
  url: string;
  name: string;
  type: string;
  preview?: string;
}

interface ModelInfo {
  id: string;
  label: string;
  provider: string;
  tier: string;
  description: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-foreground"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function parseToolsMeta(content: string): { tools: ToolCallInfo[]; cleanContent: string } {
  const match = content.match(/^<!-- tools:(\[[\s\S]*?\]) -->\n?/);
  if (!match) return { tools: [], cleanContent: content };
  try {
    const parsed = JSON.parse(match[1]);
    const tools: ToolCallInfo[] = parsed.map((t: any) => ({ name: t.name, input: t.input || {}, output: t.output, done: true }));
    return { tools, cleanContent: content.slice(match[0].length) };
  } catch {
    return { tools: [], cleanContent: content };
  }
}

function parseAttachmentsMeta(content: string): { attachments: Attachment[]; cleanContent: string } {
  const match = content.match(/^<!-- attachments:(\[[\s\S]*?\]) -->\n?/);
  if (!match) return { attachments: [], cleanContent: content };
  try {
    const parsed = JSON.parse(match[1]);
    return { attachments: parsed, cleanContent: content.slice(match[0].length) };
  } catch {
    return { attachments: [], cleanContent: content };
  }
}

function parseThinkBlocks(content: string): { thinking: string | null; response: string } {
  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
  if (!thinkMatch) return { thinking: null, response: content };
  const thinking = thinkMatch[1].trim();
  const response = content.replace(/<think>[\s\S]*?<\/think>/, "").trim();
  return { thinking, response };
}

function ThinkingBlock({ content, defaultOpen = false }: { content: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-2" data-testid="thinking-block">
      <button
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen(!open)}
        data-testid="button-toggle-thinking-block"
      >
        <ChevronRight className={cn("w-3 h-3 transition-transform", open && "rotate-90")} />
        <Brain className="w-3 h-3" />
        <span>Reasoning</span>
      </button>
      {open && (
        <div className="mt-1.5 ml-5 pl-3 border-l-2 border-muted-foreground/20 text-xs text-muted-foreground italic leading-relaxed whitespace-pre-wrap" data-testid="thinking-content">
          {content}
        </div>
      )}
    </div>
  );
}

const markdownComponents = {
  code({ node, className, children, ...props }: any) {
    const isInline = !className;
    return isInline ? (
      <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>
    ) : (
      <pre className="bg-muted rounded-md p-3 overflow-x-auto my-2">
        <code className="text-xs font-mono" {...props}>{children}</code>
      </pre>
    );
  },
  p({ children }: any) { return <p className="mb-2 last:mb-0">{children}</p>; },
  ul({ children }: any) { return <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>; },
  ol({ children }: any) { return <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>; },
};

function MessageBubble({ msg, agentName, streamThinking, streamThinkingDone, toolCalls }: { msg: Message; agentName: string; streamThinking?: string; streamThinkingDone?: boolean; toolCalls?: ToolCallInfo[] }) {
  const isUser = msg.role === "user";
  const { attachments: userAttachments, cleanContent: contentAfterAttachments } = isUser ? parseAttachmentsMeta(msg.content) : { attachments: [], cleanContent: msg.content };
  const { tools: storedTools, cleanContent } = !isUser ? parseToolsMeta(msg.content) : { tools: [], cleanContent: contentAfterAttachments };
  const { thinking, response: rawResponse } = !isUser ? parseThinkBlocks(cleanContent) : { thinking: null, response: cleanContent };
  const { charts, cleanContent: response } = !isUser ? parseChartBlocks(rawResponse) : { charts: [], cleanContent: rawResponse };
  const chartDataFromTools = !isUser ? extractChartsFromTools(toolCalls || storedTools) : [];
  const allCharts = [...charts, ...chartDataFromTools];
  const showStreamThinking = !isUser && streamThinking !== undefined;
  const allToolCalls = toolCalls && toolCalls.length > 0 ? toolCalls : storedTools.length > 0 ? storedTools : null;
  const imageAttachments = userAttachments.filter((a) => a.type.startsWith("image/"));
  const fileAttachments = userAttachments.filter((a) => !a.type.startsWith("image/"));

  return (
    <div className={cn("flex gap-3 group", isUser ? "flex-row-reverse" : "flex-row")} data-testid={`message-${msg.id}`}>
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm mt-0.5",
        isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      )}>
        {isUser ? <User className="w-3.5 h-3.5" /> : <span>🦞</span>}
      </div>
      <div className={cn("flex flex-col gap-1 max-w-[75%]", isUser ? "items-end" : "items-start")}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground">
            {isUser ? "You" : agentName}
          </span>
          <span className="text-xs text-muted-foreground/60">
            {format(new Date(msg.createdAt), "h:mm a")}
          </span>
          {!isUser && <CopyButton text={response || msg.content} />}
        </div>
        {isUser && imageAttachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-end" data-testid="message-image-attachments">
            {imageAttachments.map((att, idx) => (
              <img
                key={idx}
                src={getAuthUrl(att.url)}
                alt={att.name}
                className="rounded-lg max-w-[200px] max-h-[200px] object-cover border border-border"
                data-testid={`img-attachment-${idx}`}
              />
            ))}
          </div>
        )}
        {isUser && fileAttachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-end" data-testid="message-file-attachments">
            {fileAttachments.map((att, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-xs bg-primary/80 text-primary-foreground rounded-lg px-2 py-1">
                <FileText className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{att.name}</span>
              </div>
            ))}
          </div>
        )}
        <div className={cn(
          "rounded-xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-card border border-card-border text-card-foreground rounded-tl-sm prose prose-sm dark:prose-invert max-w-none"
        )}>
          {isUser ? response : (
            <>
              {showStreamThinking && streamThinking && (
                <ThinkingBlock content={streamThinking} defaultOpen={!streamThinkingDone} />
              )}
              {!showStreamThinking && thinking && (
                <ThinkingBlock content={thinking} defaultOpen={false} />
              )}
              {allToolCalls && (
                <ToolCallsBlock calls={allToolCalls} />
              )}
              {response ? (
                <ReactMarkdown components={markdownComponents}>
                  {response}
                </ReactMarkdown>
              ) : showStreamThinking && !streamThinkingDone ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Reasoning...</span>
                </div>
              ) : null}
              {allCharts.map((chart, i) => (
                <ChartRenderer key={i} chart={chart} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface ToolCallInfo {
  id?: string;
  name: string;
  input: Record<string, any>;
  output?: any;
  done: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  test_api_keys: "Testing API Keys",
  check_system_status: "Checking System Status",
  list_models: "Listing Models",
  search_memory: "Searching Memory",
  create_memory: "Storing Memory",
  search_knowledge: "Searching Knowledge",
  create_knowledge: "Storing Knowledge",
  get_daily_notes: "Reading Daily Notes",
  list_conversations: "Listing Conversations",
  web_fetch: "Fetching Web Content",
  web_search: "Searching the Web",
  write_daily_note: "Writing Daily Note",
  update_memory: "Updating Memory",
  delegate_task: "Delegating Task",
  generate_chart: "Generating Chart",
};

function ToolCallsBlock({ calls }: { calls: ToolCallInfo[] }) {
  const [expanded, setExpanded] = useState(false);
  const completedCount = calls.filter((c) => c.done).length;
  const allDone = completedCount === calls.length;

  return (
    <div className="mb-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 overflow-hidden" data-testid="tool-calls-block">
      <button
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary/80 hover:bg-primary/10 transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-toggle-tools"
      >
        {allDone ? (
          <Check className="w-3 h-3 shrink-0" />
        ) : (
          <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
        )}
        <Wrench className="w-3 h-3 shrink-0" />
        <span className="font-medium">
          {allDone ? `Used ${calls.length} tool${calls.length > 1 ? "s" : ""}` : `Running tools (${completedCount}/${calls.length})...`}
        </span>
        {expanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
      </button>
      {expanded && (
        <div className="px-3 pb-2 space-y-2 border-t border-primary/10">
          {calls.map((call, i) => (
            <div key={i} className="text-xs mt-1.5">
              <div className="flex items-center gap-1.5 text-primary/70">
                {call.done ? <Check className="w-3 h-3 text-green-500" /> : <Loader2 className="w-3 h-3 animate-spin" />}
                <span className="font-medium">{TOOL_LABELS[call.name] || call.name}</span>
                {Object.keys(call.input).length > 0 && (
                  <span className="text-muted-foreground truncate max-w-[200px]">
                    ({Object.values(call.input).map(String).join(", ")})
                  </span>
                )}
              </div>
              {call.done && call.output && (
                <pre className="mt-1 p-2 rounded bg-muted/50 text-[10px] text-muted-foreground overflow-x-auto max-h-[120px] overflow-y-auto whitespace-pre-wrap break-words">
                  {typeof call.output === "string" ? call.output : JSON.stringify(call.output, null, 2).slice(0, 1000)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ThinkingIndicator({ name }: { name: string }) {
  return (
    <div className="flex gap-3" data-testid="thinking-indicator">
      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5 text-sm">🦞</div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{name}</span>
        <div className="bg-card border border-card-border rounded-xl rounded-tl-sm px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">Thinking...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [, params] = useRoute("/chat/:id");
  const [location] = useLocation();
  const conversationId = params ? parseInt(params.id) : null;
  const { toast } = useToast();

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamThinking, setStreamThinking] = useState("");
  const [streamThinkingDone, setStreamThinkingDone] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCallInfo[]>([]);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(() => localStorage.getItem("vc_tts_enabled") === "true");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioReadyRef = useRef(false);

  const { data: conv, isLoading } = useQuery<Conversation & { messages: Message[] }>({
    queryKey: ["/api/conversations", conversationId],
    enabled: !!conversationId,
  });

  const { data: modelsData } = useQuery<{ models: ModelInfo[] }>({
    queryKey: ["/api/models"],
  });
  const availableModels = modelsData?.models || [];

  const { data: settings } = useQuery<{ agentName: string; defaultModel: string; thinkingEnabled: boolean }>({
    queryKey: ["/api/settings"],
  });

  const { data: personasList } = useQuery<Persona[]>({
    queryKey: ["/api/personas"],
  });

  const activePersona = personasList?.find((p) => p.isActive);

  const [contextDismissed, setContextDismissed] = useState(false);

  const activatePersonaMutation = useMutation({
    mutationFn: (personaId: number) => apiRequest("POST", `/api/personas/${personaId}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });

  const agentName = activePersona?.name || settings?.agentName || "VisionClaw";
  const messages: Message[] = conv?.messages || [];

  interface ContextSummary {
    greeting: string;
    lastConversations: { title: string; updatedAt: string }[];
    activePersona: { name: string; role: string } | null;
    recentMemories: { fact: string; category: string }[];
    todayNotes: string | null;
  }
  const { data: contextSummary } = useQuery<ContextSummary>({
    queryKey: ["/api/context/summary"],
    enabled: !!conversationId && messages.length === 0,
  });

  const updateConvMutation = useMutation({
    mutationFn: (data: Partial<Conversation>) => apiRequest("PATCH", `/api/conversations/${conversationId}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId] }),
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages.length, streamingContent, streamThinking, toolCalls.length]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await authFetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          toast({ description: `Failed to upload ${file.name}`, variant: "destructive" });
          continue;
        }
        const data = await res.json();
        const isImage = file.type.startsWith("image/");
        const preview = isImage ? URL.createObjectURL(file) : undefined;
        setPendingAttachments((prev) => [...prev, { url: data.url, name: data.filename, type: file.type, preview }]);
      }
    } catch {
      toast({ description: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [toast]);

  const initAudioPlayback = useCallback(async () => {
    if (audioReadyRef.current) return;
    try {
      const ctx = new AudioContext({ sampleRate: 24000 });
      await ctx.audioWorklet.addModule("/audio-playback-worklet.js");
      const worklet = new AudioWorkletNode(ctx, "audio-playback-processor");
      worklet.connect(ctx.destination);
      audioContextRef.current = ctx;
      workletNodeRef.current = worklet;
      audioReadyRef.current = true;
    } catch (err) {
      console.error("Audio playback init failed:", err);
    }
  }, []);

  const playAudioChunk = useCallback((base64Audio: string) => {
    if (!workletNodeRef.current) return;
    const raw = atob(base64Audio);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;
    workletNodeRef.current.port.postMessage({ type: "audio", samples: float32 });
  }, []);

  const toggleTts = useCallback(() => {
    setTtsEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("vc_tts_enabled", String(next));
      return next;
    });
  }, []);

  const startVoiceRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start(100);
      setVoiceRecording(true);
      setVoiceTranscript("");
    } catch (err: any) {
      toast({ description: "Microphone access denied", variant: "destructive" });
    }
  }, [toast]);

  const stopVoiceRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const b = new Blob(audioChunksRef.current, { type: "audio/webm" });
        recorder.stream.getTracks().forEach((t) => t.stop());
        resolve(b);
      };
      recorder.stop();
    });

    setVoiceRecording(false);
    setVoiceProcessing(true);

    try {
      if (ttsEnabled) await initAudioPlayback();

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(blob);
      });

      const response = await authFetch(`/api/voice/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64 }),
      });

      if (!response.ok) throw new Error("Voice request failed");

      const streamReader = response.body?.getReader();
      if (!streamReader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await streamReader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            switch (event.type) {
              case "user_transcript":
                setVoiceTranscript(event.data);
                break;
              case "transcript":
                setStreamingContent(event.data);
                break;
              case "audio":
                if (ttsEnabled) playAudioChunk(event.data);
                break;
              case "titleUpdate":
                queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
                break;
              case "done":
                if (ttsEnabled && workletNodeRef.current) {
                  workletNodeRef.current.port.postMessage({ type: "streamComplete" });
                }
                queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId] });
                break;
              case "error":
                toast({ description: event.error, variant: "destructive" });
                break;
            }
          } catch (e) {
            if (!(e instanceof SyntaxError)) console.error("Voice stream parse error:", e);
          }
        }
      }
    } catch (err: any) {
      toast({ description: err.message || "Voice failed", variant: "destructive" });
    } finally {
      setVoiceProcessing(false);
      setStreamingContent("");
      setVoiceTranscript("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId] });
    }
  }, [conversationId, ttsEnabled, toast, initAudioPlayback, playAudioChunk]);

  const removeAttachment = useCallback((index: number) => {
    setPendingAttachments((prev) => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const urlParams = new URLSearchParams(location.split("?")[1] || "");
  const promptParam = urlParams.get("prompt");
  const hasAutoSent = useRef(false);

  useEffect(() => {
    if (promptParam && !hasAutoSent.current && conv && conv.messages.length === 0) {
      hasAutoSent.current = true;
      setInput(promptParam);
      setTimeout(() => sendMessage(promptParam), 100);
    }
  }, [promptParam, conv]);

  async function sendMessage(overrideContent?: string) {
    const content = overrideContent || input.trim();
    if ((!content && pendingAttachments.length === 0) || !conversationId || streaming) return;
    const attachments = [...pendingAttachments];
    setInput("");
    setPendingAttachments([]);
    setStreaming(true);
    setStreamingContent("");
    setStreamThinking("");
    setStreamThinkingDone(false);
    setToolCalls([]);

    abortRef.current = new AbortController();

    try {
      const body: any = { content: content || "" };
      if (attachments.length > 0) {
        body.attachments = attachments.map((a) => ({ url: a.url, name: a.name, type: a.type }));
      }
      const res = await authFetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error("Failed to send");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";

      const optimisticContent = attachments.length > 0
        ? `<!-- attachments:${JSON.stringify(attachments.map(a => ({ url: a.url, name: a.name, type: a.type })))} -->\n${content || ""}`
        : content;
      queryClient.setQueryData(
        ["/api/conversations", conversationId],
        (old: any) => old ? { ...old, messages: [...old.messages, { id: Date.now(), conversationId, role: "user", content: optimisticContent, createdAt: new Date().toISOString() }] } : old
      );

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.thinking) {
              setStreamThinking((prev) => prev + data.thinking);
            }
            if (data.thinkEnd) {
              setStreamThinkingDone(true);
            }
            if (data.tool_call) {
              setToolCalls((prev) => [...prev, { id: data.tool_call.id, name: data.tool_call.name, input: data.tool_call.input || {}, done: false }]);
            }
            if (data.tool_result) {
              setToolCalls((prev) => prev.map((tc) =>
                tc.id === data.tool_result.id && !tc.done
                  ? { ...tc, output: data.tool_result.output, done: true }
                  : tc
              ));
            }
            if (data.content) setStreamingContent((prev) => prev + data.content);
            if (data.titleUpdate) {
              queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
            }
            if (data.done) {
              await queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId] });
              await queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
              setStreamingContent("");
              setStreamThinking("");
              setStreamThinkingDone(false);
              setToolCalls([]);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        toast({ description: "Failed to send message", variant: "destructive" });
      }
    } finally {
      setStreaming(false);
      setStreamingContent("");
      setStreamThinking("");
      setStreamThinkingDone(false);
      setToolCalls([]);
    }
  }

  if (!conversationId) return null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {isLoading ? (
            <Skeleton className="h-5 w-40" />
          ) : (
            <h2 className="text-sm font-medium truncate" data-testid="text-conversation-title">{conv?.title || "New Chat"}</h2>
          )}
          {conv?.thinking && (
            <Badge variant="secondary" className="gap-1 text-xs shrink-0">
              <Brain className="w-3 h-3" /> Thinking
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {personasList && personasList.length > 0 && (
            <Select
              value={activePersona ? String(activePersona.id) : "none"}
              onValueChange={(v) => {
                if (v !== "none") {
                  activatePersonaMutation.mutate(parseInt(v));
                }
              }}
            >
              <SelectTrigger className="h-7 text-xs w-auto max-w-[160px] gap-1" data-testid="select-persona">
                <Users className="w-3 h-3 shrink-0" />
                <SelectValue placeholder="Persona" />
              </SelectTrigger>
              <SelectContent>
                {personasList.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)} className="text-xs" data-testid={`select-persona-option-${p.id}`}>
                    <span className="flex items-center gap-1.5">
                      <span className="truncate">{p.name}</span>
                      {p.isActive && <Check className="w-3 h-3 text-green-500 shrink-0" />}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={conv?.thinking ? "default" : "ghost"}
                data-testid="button-toggle-thinking"
                onClick={() => updateConvMutation.mutate({ thinking: !conv?.thinking })}
              >
                <Brain className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{conv?.thinking ? "Disable thinking mode" : "Enable thinking mode — visible reasoning"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                data-testid="button-toggle-model-select"
                onClick={() => setShowModelSelect((v) => !v)}
              >
                <Settings2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Change model</TooltipContent>
          </Tooltip>
          {showModelSelect && (
            <Select
              value={conv?.model || "gpt-5.1"}
              onValueChange={(v) => { updateConvMutation.mutate({ model: v }); setShowModelSelect(false); }}
            >
              <SelectTrigger className="h-7 text-xs w-32" data-testid="select-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    <span className="flex items-center gap-1.5">
                      {m.label}
                      <span className={cn(
                        "text-[10px] px-1 rounded",
                        m.tier === "fast" && "bg-green-500/15 text-green-600 dark:text-green-400",
                        m.tier === "balanced" && "bg-blue-500/15 text-blue-600 dark:text-blue-400",
                        m.tier === "powerful" && "bg-purple-500/15 text-purple-600 dark:text-purple-400",
                        m.tier === "reasoning" && "bg-orange-500/15 text-orange-600 dark:text-orange-400",
                      )}>
                        {m.tier === "fast" ? "$" : m.tier === "balanced" ? "$$" : m.tier === "reasoning" ? "$$$" : "$$$"}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" data-testid="messages-container">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                <Skeleton className="h-16 flex-1 rounded-xl" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 && !streaming ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-16">
            {contextSummary && !contextDismissed && (
              <div className="w-full max-w-md mx-auto mb-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-left relative" data-testid="context-card">
                <button
                  onClick={() => setContextDismissed(true)}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                  data-testid="button-dismiss-context"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="text-sm font-medium text-foreground mb-1">{contextSummary.greeting}</div>
                {contextSummary.activePersona && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <Users className="w-3 h-3" /> Active: {contextSummary.activePersona.name} — {contextSummary.activePersona.role}
                  </div>
                )}
                {contextSummary.lastConversations.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    <span className="font-medium">Recent:</span> {contextSummary.lastConversations.map(c => c.title).join(", ")}
                  </div>
                )}
                {contextSummary.recentMemories.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    <span className="font-medium">Remembered:</span> {contextSummary.recentMemories.slice(0, 2).map(m => m.fact).join("; ")}
                  </div>
                )}
              </div>
            )}
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-4xl">🦞</div>
            <div>
              <h3 className="text-lg font-semibold">{agentName}</h3>
              <p className="text-muted-foreground text-sm mt-1">How can I help you today?</p>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 max-w-sm w-full">
              {["Help me write something", "Explain a concept", "Analyze this code", "Make a plan"].map((s) => (
                <button
                  key={s}
                  className="text-sm text-left px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} agentName={agentName} />
            ))}
            {streaming && streamingContent === "" && !streamThinking && toolCalls.length === 0 && <ThinkingIndicator name={agentName} />}
            {streaming && (streamingContent !== "" || streamThinking !== "" || toolCalls.length > 0) && (
              <MessageBubble
                msg={{ id: -1, conversationId: conversationId!, role: "assistant", content: streamingContent, createdAt: new Date().toISOString() } as any}
                agentName={agentName}
                streamThinking={streamThinking || undefined}
                streamThinkingDone={streamThinkingDone}
                toolCalls={toolCalls.length > 0 ? toolCalls : undefined}
              />
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-background/95 backdrop-blur-sm shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,.txt,.md,.csv,.json,.pdf"
          onChange={handleFileSelect}
          data-testid="input-file-upload"
        />
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2" data-testid="pending-attachments">
            {pendingAttachments.map((att, idx) => (
              <div key={idx} className="relative group/att" data-testid={`attachment-preview-${idx}`}>
                {att.type.startsWith("image/") && att.preview ? (
                  <img
                    src={att.preview}
                    alt={att.name}
                    className="w-16 h-16 object-cover rounded-lg border border-border"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg border border-border bg-muted flex flex-col items-center justify-center gap-1">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground truncate max-w-[56px] px-1">{att.name}</span>
                  </div>
                )}
                <button
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  onClick={() => removeAttachment(idx)}
                  data-testid={`button-remove-attachment-${idx}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <Button
            size="icon"
            variant="ghost"
            data-testid="button-attach-file"
            onClick={() => fileInputRef.current?.click()}
            disabled={streaming || uploading}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </Button>
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={`Message ${agentName}...`}
              className="resize-none min-h-[44px] max-h-[200px] pr-10 text-sm"
              rows={1}
              data-testid="input-message"
              disabled={streaming}
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={voiceRecording ? "destructive" : "ghost"}
                data-testid="button-voice-record"
                onClick={voiceRecording ? stopVoiceRecording : startVoiceRecording}
                disabled={streaming || voiceProcessing}
                className={cn(voiceRecording && "animate-pulse")}
              >
                {voiceProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : voiceRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{voiceRecording ? "Stop recording" : voiceProcessing ? "Processing..." : "Voice message"}</TooltipContent>
          </Tooltip>
          <Button
            size="icon"
            data-testid="button-send-message"
            onClick={() => sendMessage()}
            disabled={(!input.trim() && pendingAttachments.length === 0) || streaming || voiceProcessing}
          >
            {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        {(voiceRecording || voiceProcessing || voiceTranscript) && (
          <div className="flex items-center gap-2 mt-2 px-1" data-testid="voice-status">
            {voiceRecording && (
              <Badge variant="destructive" className="text-xs gap-1 py-0.5 animate-pulse">
                <Mic className="w-3 h-3" /> Recording...
              </Badge>
            )}
            {voiceProcessing && (
              <Badge variant="secondary" className="text-xs gap-1 py-0.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Processing voice...
              </Badge>
            )}
            {voiceTranscript && (
              <span className="text-xs text-muted-foreground italic truncate max-w-[300px]">"{voiceTranscript}"</span>
            )}
          </div>
        )}
        <div className="flex items-center justify-between mt-1.5 px-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground/60">
              {activePersona ? `${activePersona.name} • ` : ""}{conv?.thinking ? `Thinking mode • ${conv?.model || "gpt-5.1"}` : `${conv?.model || "gpt-5.1"}`}
            </span>
            {streaming && (
              <Badge variant="secondary" className="text-xs gap-1 py-0 h-4">
                <Sparkles className="w-2.5 h-2.5 animate-pulse" /> Streaming
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-1 text-xs transition-colors",
                    ttsEnabled ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"
                  )}
                  onClick={toggleTts}
                  data-testid="button-toggle-tts"
                >
                  {ttsEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                  <span>{ttsEnabled ? "TTS on" : "TTS off"}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{ttsEnabled ? "Disable voice responses" : "Enable voice responses"}</TooltipContent>
            </Tooltip>
            <span className="text-xs text-muted-foreground/40">Shift+Enter for newline</span>
          </div>
        </div>
      </div>
    </div>
  );
}

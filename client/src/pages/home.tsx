import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bot, MessageSquare, Zap, Clock, TrendingUp, Plus, ArrowRight, Brain, Users, BookOpen, Database, Activity, CheckCircle2, XCircle, FileText, Code, Mail, Lightbulb, Car, Search, CalendarDays, BarChart3, Wrench, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Conversation, Skill, HeartbeatLog, ConversationTemplate } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ErrorState } from "@/components/error-state";

const TEMPLATE_ICONS: Record<string, any> = {
  FileText, Code, Mail, Lightbulb, Car, Search, CalendarDays, BarChart3, Wrench, Sparkles, Bot, Brain, MessageSquare, BookOpen, Users,
};

interface Stats { totalConversations: number; totalMessages: number; totalMemories: number; activePersona: string | null; status: string; uptime: number; }

export default function HomePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const statsQuery = useQuery<Stats>({ queryKey: ["/api/stats"] });
  const stats = statsQuery.data;
  const { data: memoryStats } = useQuery<{ active: number; archived: number; total: number; byCategory: Record<string, number>; knowledgeCount: number }>({ queryKey: ["/api/memory/stats"] });
  const { data: convResult, isLoading: convsLoading } = useQuery<{ data: Conversation[]; total: number; hasMore: boolean }>({ queryKey: ["/api/conversations"] });
  const conversations = convResult?.data ?? [];
  const { data: skills = [] } = useQuery<Skill[]>({ queryKey: ["/api/skills"] });
  const { data: settings } = useQuery<{ agentName: string; defaultModel: string }>({ queryKey: ["/api/settings"] });
  const { data: templates = [] } = useQuery<ConversationTemplate[]>({ queryKey: ["/api/templates"] });

  const startTemplateMutation = useMutation({
    mutationFn: (templateId: number) => apiRequest("POST", `/api/templates/${templateId}/start`),
    onSuccess: async (res) => {
      const conv = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      navigate(`/chat/${conv.id}`);
    },
    onError: () => {
      toast({ title: "Failed to start template", variant: "destructive" });
    },
  });

  interface HeartbeatLogEntry {
    id: number;
    taskName: string;
    status: string;
    personaName: string | null;
    durationMs: number | null;
    createdAt: string;
  }
  const { data: recentLogs = [] } = useQuery<HeartbeatLogEntry[]>({
    queryKey: ["/api/heartbeat/logs?limit=10"],
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/conversations", { title: "New Chat" }),
    onSuccess: async (res) => {
      const conv = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      navigate(`/chat/${conv.id}`);
    },
  });

  if (statsQuery.isError) return <ErrorState title="Dashboard Error" message="Failed to load dashboard data. Please try again." onRetry={() => statsQuery.refetch()} />;

  const recentConvs = conversations.slice(0, 5);
  const enabledSkills = skills.filter((s) => s.enabled).slice(0, 4);
  const uptimeHours = stats ? Math.floor(stats.uptime / 3600) : 0;
  const uptimeMins = stats ? Math.floor((stats.uptime % 3600) / 60) : 0;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Hero */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-2xl">🦞</div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {settings?.agentName || "VisionClaw"}
              </h1>
              <p className="text-muted-foreground text-sm">Your personal AI assistant</p>
            </div>
            <Badge variant="secondary" className="ml-2 gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Online
            </Badge>
          </div>
        </div>

        {/* Active Persona */}
        {stats?.activePersona && (
          <button
            className="w-full text-left"
            onClick={() => navigate("/personas")}
            data-testid="button-active-persona"
          >
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-3 pb-3 px-4">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-primary" />
                  <div>
                    <div className="text-sm font-medium">Active Persona: {stats.activePersona}</div>
                    <div className="text-xs text-muted-foreground">Click to manage personas</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: MessageSquare, label: "Conversations", value: stats?.totalConversations ?? "—", color: "text-primary" },
            { icon: TrendingUp, label: "Messages", value: stats?.totalMessages ?? "—", color: "text-primary" },
            { icon: Brain, label: "Memories", value: stats?.totalMemories ?? "—", color: "text-primary" },
            { icon: Clock, label: "Uptime", value: stats ? `${uptimeHours}h ${uptimeMins}m` : "—", color: "text-primary" },
          ].map(({ icon: Icon, label, value, color }) => (
            <Card key={label} data-testid={`card-stat-${label.toLowerCase()}`}>
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick start + Recent */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" /> Quick Start
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                "Help me write an email",
                "Explain a complex topic",
                "Brainstorm ideas",
                "Debug my code",
              ].map((prompt) => (
                <button
                  key={prompt}
                  data-testid={`button-quick-prompt-${prompt.replace(/\s+/g, "-").toLowerCase()}`}
                  className="w-full text-left text-sm px-3 py-2 rounded-md bg-muted/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex items-center justify-between group"
                  onClick={async () => {
                    const res = await apiRequest("POST", "/api/conversations", { title: "New Chat" });
                    const conv = await res.json();
                    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
                    navigate(`/chat/${conv.id}?prompt=${encodeURIComponent(prompt)}`);
                  }}
                >
                  {prompt}
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
              <Button
                size="sm"
                className="w-full mt-2"
                data-testid="button-start-new-chat"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                <Plus className="w-4 h-4 mr-1" />
                Start New Chat
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Recent Conversations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {convsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : recentConvs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No conversations yet</p>
              ) : (
                <div className="space-y-1">
                  {recentConvs.map((conv) => (
                    <button
                      key={conv.id}
                      data-testid={`link-recent-conversation-${conv.id}`}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 transition-colors group"
                      onClick={() => navigate(`/chat/${conv.id}`)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <MessageSquare className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                          <span className="text-sm truncate">{conv.title}</span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Conversation Templates */}
        {templates.length > 0 && (
          <Card data-testid="card-templates">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" /> Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {templates.map((tmpl) => {
                  const IconComp = TEMPLATE_ICONS[tmpl.icon] || MessageSquare;
                  return (
                    <button
                      key={tmpl.id}
                      data-testid={`button-template-${tmpl.id}`}
                      className="flex flex-col items-start gap-1.5 p-3 rounded-lg bg-muted/30 border border-border hover:bg-muted/60 hover:border-primary/30 transition-all text-left group"
                      onClick={() => startTemplateMutation.mutate(tmpl.id)}
                      disabled={startTemplateMutation.isPending}
                    >
                      <div className="flex items-center gap-2">
                        <IconComp className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-medium truncate">{tmpl.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground line-clamp-2">{tmpl.description}</span>
                      <Badge variant="outline" className="text-[10px] py-0 h-4 mt-auto">{tmpl.category}</Badge>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Memory Health */}
        {memoryStats && (
          <Card data-testid="card-memory-health">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" /> Memory Health
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => navigate("/memory")} data-testid="button-view-memory">
                    Memory <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/knowledge")} data-testid="button-view-knowledge">
                    Knowledge <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20">
                  <div className="text-xs text-muted-foreground">Active</div>
                  <div className="text-lg font-bold text-green-600 dark:text-green-400" data-testid="text-memory-active">{memoryStats.active}</div>
                </div>
                <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                  <div className="text-xs text-muted-foreground">Archived</div>
                  <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400" data-testid="text-memory-archived">{memoryStats.archived}</div>
                </div>
                <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
                  <div className="text-xs text-muted-foreground">Knowledge</div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400" data-testid="text-memory-knowledge">{memoryStats.knowledgeCount}</div>
                </div>
                <div className="p-3 rounded-md bg-muted/50 border border-border">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="text-lg font-bold text-foreground" data-testid="text-memory-total">{memoryStats.total}</div>
                </div>
              </div>
              {Object.keys(memoryStats.byCategory).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(memoryStats.byCategory).map(([cat, count]) => (
                    <Badge key={cat} variant="outline" className="text-xs" data-testid={`badge-category-${cat}`}>
                      {cat}: {count}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Agent Activity Feed */}
        {recentLogs.length > 0 && (
          <Card data-testid="card-agent-activity">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Agent Activity
                </span>
                <Button variant="ghost" size="sm" onClick={() => navigate("/heartbeat")} data-testid="button-view-heartbeat">
                  View all <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 p-2 rounded-md bg-muted/30 border border-border"
                    data-testid={`activity-log-${log.id}`}
                  >
                    {log.status === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{log.taskName}</span>
                        {log.personaName && (
                          <Badge variant="outline" className="text-xs py-0 h-5 shrink-0">
                            {log.personaName}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}</span>
                        {log.durationMs != null && <span>{(log.durationMs / 1000).toFixed(1)}s</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active skills */}
        {enabledSkills.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" /> Active Skills
                </span>
                <Button variant="ghost" size="sm" onClick={() => navigate("/skills")}>
                  View all
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {enabledSkills.map((skill) => (
                  <div
                    key={skill.id}
                    data-testid={`card-skill-${skill.id}`}
                    className="flex items-start gap-2 p-3 rounded-md bg-muted/30 border border-border"
                  >
                    <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{skill.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{skill.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

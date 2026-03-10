import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bot, Crown, Wrench, PenTool, Plus, Check, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Persona } from "@shared/schema";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/components/error-state";

const ICON_MAP: Record<string, any> = { Bot, Crown, Wrench, PenTool };

function PersonaForm({ persona, onSave, onCancel }: {
  persona?: Persona;
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(persona?.name || "");
  const [role, setRole] = useState(persona?.role || "Personal Assistant");
  const [icon, setIcon] = useState(persona?.icon || "Bot");
  const [soul, setSoul] = useState(persona?.soul || "");
  const [identity, setIdentity] = useState(persona?.identity || "");
  const [memoryDoc, setMemoryDoc] = useState(persona?.memoryDoc || "");
  const [operatingLoop, setOperatingLoop] = useState(persona?.operatingLoop || "");
  const [heartbeatDoc, setHeartbeatDoc] = useState(persona?.heartbeatDoc || "");
  const [toolsDoc, setToolsDoc] = useState(persona?.toolsDoc || "");
  const [agentsDoc, setAgentsDoc] = useState(persona?.agentsDoc || "");
  const [brandVoiceDoc, setBrandVoiceDoc] = useState(persona?.brandVoiceDoc || "");

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-sm">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Felix" data-testid="input-persona-name" className="mt-1" />
        </div>
        <div>
          <Label className="text-sm">Role</Label>
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. CEO Persona" data-testid="input-persona-role" className="mt-1" />
        </div>
      </div>
      <div>
        <Label className="text-sm">Icon</Label>
        <div className="flex gap-2 mt-1">
          {["Bot", "Crown", "Wrench", "PenTool"].map((i) => {
            const Icon = ICON_MAP[i];
            return (
              <button
                key={i}
                className={cn("w-9 h-9 rounded-md flex items-center justify-center border transition-colors", icon === i ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50")}
                onClick={() => setIcon(i)}
                data-testid={`button-icon-${i.toLowerCase()}`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <Label className="text-sm">Soul (Voice & Boundaries)</Label>
        <Textarea value={soul} onChange={(e) => setSoul(e.target.value)} rows={4} placeholder="Define voice, tone, and behavioral boundaries..." data-testid="input-persona-soul" className="mt-1 text-sm font-mono" />
      </div>
      <div>
        <Label className="text-sm">Identity (Mission & Rhythm)</Label>
        <Textarea value={identity} onChange={(e) => setIdentity(e.target.value)} rows={3} placeholder="Define mission, scoreboard, and operating mode..." data-testid="input-persona-identity" className="mt-1 text-sm font-mono" />
      </div>
      <div>
        <Label className="text-sm">Operating Preferences (Memory Doc)</Label>
        <Textarea value={memoryDoc} onChange={(e) => setMemoryDoc(e.target.value)} rows={3} placeholder="Define preferences, guardrails, and patterns..." data-testid="input-persona-memory" className="mt-1 text-sm font-mono" />
      </div>
      <div>
        <Label className="text-sm">Operating Loop</Label>
        <Textarea value={operatingLoop} onChange={(e) => setOperatingLoop(e.target.value)} rows={3} placeholder="Define the execution workflow..." data-testid="input-persona-loop" className="mt-1 text-sm font-mono" />
      </div>
      <div>
        <Label className="text-sm">Heartbeat Instructions</Label>
        <Textarea value={heartbeatDoc} onChange={(e) => setHeartbeatDoc(e.target.value)} rows={3} placeholder="Define cron schedules, autonomous behaviors, overnight build rules..." data-testid="input-persona-heartbeat" className="mt-1 text-sm font-mono" />
      </div>
      <div>
        <Label className="text-sm">Tool Preferences</Label>
        <Textarea value={toolsDoc} onChange={(e) => setToolsDoc(e.target.value)} rows={3} placeholder="Define which tools this persona prefers and how to use them..." data-testid="input-persona-tools" className="mt-1 text-sm font-mono" />
      </div>
      <div>
        <Label className="text-sm">Agents & Delegation</Label>
        <Textarea value={agentsDoc} onChange={(e) => setAgentsDoc(e.target.value)} rows={3} placeholder="Define delegation rules, which agents to route to, chain of command..." data-testid="input-persona-agents" className="mt-1 text-sm font-mono" />
      </div>
      <div>
        <Label className="text-sm">Brand Voice</Label>
        <Textarea value={brandVoiceDoc} onChange={(e) => setBrandVoiceDoc(e.target.value)} rows={3} placeholder="Define writing style, tone rules, banned words, content patterns..." data-testid="input-persona-brand" className="mt-1 text-sm font-mono" />
      </div>
      <div className="flex gap-2 pt-2">
        <Button onClick={() => onSave({ name, role, icon, soul, identity, memoryDoc, operatingLoop, heartbeatDoc, toolsDoc, agentsDoc, brandVoiceDoc })} disabled={!name.trim()} data-testid="button-save-persona" className="flex-1">
          Save Persona
        </Button>
        <Button variant="outline" onClick={onCancel} data-testid="button-cancel-persona">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function PersonaCard({ persona, onActivate, onEdit, onDelete }: {
  persona: Persona;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ICON_MAP[persona.icon] || Bot;

  return (
    <Card className={cn("transition-all", persona.isActive && "ring-2 ring-primary")} data-testid={`card-persona-${persona.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            persona.isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold truncate">{persona.name}</h3>
                  {persona.isActive && (
                    <Badge variant="default" className="text-xs gap-1 py-0 h-5">
                      <Check className="w-2.5 h-2.5" /> Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{persona.role}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!persona.isActive && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onActivate} data-testid={`button-activate-persona-${persona.id}`}>
                    Activate
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} data-testid={`button-edit-persona-${persona.id}`}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete} data-testid={`button-delete-persona-${persona.id}`}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
              onClick={() => setExpanded(!expanded)}
              data-testid={`button-expand-persona-${persona.id}`}
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Hide details" : "Show details"}
            </button>

            {expanded && (
              <div className="mt-3 space-y-3 text-xs">
                {persona.soul && (
                  <div>
                    <span className="font-semibold text-muted-foreground uppercase tracking-wide">Soul</span>
                    <pre className="mt-1 text-xs whitespace-pre-wrap bg-muted/50 rounded-md p-2 font-mono">{persona.soul}</pre>
                  </div>
                )}
                {persona.identity && (
                  <div>
                    <span className="font-semibold text-muted-foreground uppercase tracking-wide">Identity</span>
                    <pre className="mt-1 text-xs whitespace-pre-wrap bg-muted/50 rounded-md p-2 font-mono">{persona.identity}</pre>
                  </div>
                )}
                {persona.memoryDoc && (
                  <div>
                    <span className="font-semibold text-muted-foreground uppercase tracking-wide">Preferences</span>
                    <pre className="mt-1 text-xs whitespace-pre-wrap bg-muted/50 rounded-md p-2 font-mono">{persona.memoryDoc}</pre>
                  </div>
                )}
                {persona.operatingLoop && (
                  <div>
                    <span className="font-semibold text-muted-foreground uppercase tracking-wide">Operating Loop</span>
                    <pre className="mt-1 text-xs whitespace-pre-wrap bg-muted/50 rounded-md p-2 font-mono">{persona.operatingLoop}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PersonasPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Persona | null>(null);

  const personasQuery = useQuery<Persona[]>({ queryKey: ["/api/personas"] });
  const { data: personas = [], isLoading } = personasQuery;

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/personas", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
      setDialogOpen(false);
      toast({ description: "Persona created" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/personas/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
      setEditing(null);
      setDialogOpen(false);
      toast({ description: "Persona updated" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/personas/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ description: "Persona activated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/personas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
      toast({ description: "Persona deleted" });
    },
  });

  const activePersona = personas.find((p) => p.isActive);

  if (personasQuery.isError) return <ErrorState title="Personas Error" message="Failed to load personas. Please try again." onRetry={() => personasQuery.refetch()} />;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Personas</h1>
              <p className="text-sm text-muted-foreground">
                {activePersona ? `Active: ${activePersona.name} (${activePersona.role})` : "Create and manage agent personas"}
              </p>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-create-persona">
                <Plus className="w-4 h-4 mr-1" /> New Persona
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Persona" : "Create Persona"}</DialogTitle>
              </DialogHeader>
              <PersonaForm
                persona={editing || undefined}
                onSave={(data) => {
                  if (editing) {
                    updateMutation.mutate({ id: editing.id, data });
                  } else {
                    createMutation.mutate(data);
                  }
                }}
                onCancel={() => { setDialogOpen(false); setEditing(null); }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
        ) : personas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Bot className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No personas yet. Create one to customize your agent's behavior.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {personas.map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                onActivate={() => activateMutation.mutate(persona.id)}
                onEdit={() => { setEditing(persona); setDialogOpen(true); }}
                onDelete={() => deleteMutation.mutate(persona.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useRef } from "react";
import { Settings, Bot, Cpu, Brain, Save, Key, Trash2, Eye, EyeOff, Check, ExternalLink, Shield, MessageCircle, Zap, Loader2, X, Download, Upload, CloudUpload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AgentSettings } from "@shared/schema";
import { ErrorState } from "@/components/error-state";

const settingsSchema = z.object({
  agentName: z.string().min(1, "Name required").max(50),
  personality: z.string().min(10, "Personality must be at least 10 characters").max(2000),
  defaultModel: z.string(),
  thinkingEnabled: z.boolean(),
});

interface ModelInfo {
  id: string;
  label: string;
  provider: string;
  tier: string;
  description: string;
}

interface ProviderKeyInfo {
  id: number;
  provider: string;
  apiKey: string;
  baseUrl: string | null;
  enabled: boolean;
}

interface ProviderConfig {
  name: string;
  baseUrl: string;
  description: string;
}

const PROVIDER_LINKS: Record<string, string> = {
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  xai: "https://console.x.ai/",
  google: "https://aistudio.google.com/apikey",
  perplexity: "https://www.perplexity.ai/settings/api",
  openrouter: "https://openrouter.ai/keys",
};

function ProviderKeyForm({
  providerId,
  config,
  existing,
}: {
  providerId: string;
  config: ProviderConfig;
  existing?: ProviderKeyInfo;
}) {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const saveMutation = useMutation({
    mutationFn: (data: { apiKey: string; enabled: boolean }) =>
      apiRequest("PUT", `/api/provider-keys/${providerId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-keys"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      setApiKey("");
      toast({ description: `${config.name} key saved` });
    },
    onError: () => toast({ description: "Failed to save key", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/provider-keys/${providerId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-keys"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      toast({ description: `${config.name} key removed` });
    },
  });

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border bg-card" data-testid={`provider-key-${providerId}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{config.name}</span>
          {existing && (
            <Badge variant="secondary" className="text-xs">
              <Check className="w-3 h-3 mr-1" /> Connected
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {PROVIDER_LINKS[providerId] && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => window.open(PROVIDER_LINKS[providerId], "_blank")}
              data-testid={`link-${providerId}-keys`}
            >
              <ExternalLink className="w-3 h-3 mr-1" /> Get Key
            </Button>
          )}
          {existing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-${providerId}`}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{config.description}</p>
      {existing ? (
        <div className="flex items-center gap-2">
          <code className="text-xs bg-muted px-2 py-1 rounded flex-1 font-mono">{existing.apiKey}</code>
          <Switch
            checked={existing.enabled}
            onCheckedChange={(enabled) => saveMutation.mutate({ apiKey: "", enabled })}
            data-testid={`switch-${providerId}-enabled`}
          />
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Enter ${config.name} API key...`}
              className="text-sm pr-8 font-mono"
              data-testid={`input-${providerId}-key`}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-2"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </Button>
          </div>
          <Button
            size="sm"
            disabled={!apiKey.trim() || saveMutation.isPending}
            onClick={() => saveMutation.mutate({ apiKey: apiKey.trim(), enabled: true })}
            data-testid={`button-save-${providerId}`}
          >
            <Save className="w-3 h-3 mr-1" />
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

interface TestResult {
  connected: boolean;
  provider: string;
  detail: string;
  latencyMs?: number;
}

function TestAllKeysButton() {
  const { toast } = useToast();
  const [results, setResults] = useState<Record<string, TestResult> | null>(null);
  const [testing, setTesting] = useState(false);

  const runTest = async () => {
    setTesting(true);
    setResults(null);
    try {
      const res = await apiRequest("POST", "/api/provider-keys/test");
      const data = await res.json();
      setResults(data);
      const providers = Object.values(data) as TestResult[];
      const passed = providers.filter((p) => p.connected).length;
      const total = providers.length;
      toast({ description: `${passed}/${total} providers connected` });
    } catch {
      toast({ description: "Failed to run test", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={runTest}
        disabled={testing}
        data-testid="button-test-all-keys"
      >
        {testing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
        {testing ? "Testing..." : "Test All Keys"}
      </Button>
      {results && (
        <div className="w-full mt-2 rounded-lg border bg-muted/50 p-3 space-y-1.5 text-xs">
          {Object.entries(results).map(([id, r]) => (
            <div key={id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {r.connected ? (
                  <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                ) : (
                  <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
                )}
                <span className="font-medium">{r.provider}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                {r.latencyMs != null && <span>{r.latencyMs}ms</span>}
                <span className={r.connected ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                  {r.connected ? "OK" : "FAIL"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExportImportSection() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const importMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/import", data);
      return res.json();
    },
    onSuccess: (data) => {
      setImportResult(data.imported);
      queryClient.invalidateQueries();
      toast({ description: "Import completed successfully" });
    },
    onError: () => toast({ description: "Import failed", variant: "destructive" }),
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await apiRequest("GET", "/api/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `visionclaw-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ description: "Export downloaded" });
    } catch {
      toast({ description: "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleCloudBackup = async () => {
    setBackingUp(true);
    try {
      const res = await apiRequest("POST", "/api/backup/cloud");
      if (!res.ok) throw new Error("Backup failed");
      const data = await res.json();
      toast({ description: data.summary || "Backup uploaded to Google Drive" });
    } catch {
      toast({ description: "Cloud backup failed", variant: "destructive" });
    } finally {
      setBackingUp(false);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        importMutation.mutate(data);
      } catch {
        toast({ description: "Invalid JSON file", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleExport}
          disabled={exporting}
          className="flex-1"
          data-testid="button-export-data"
        >
          {exporting ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
          {exporting ? "Exporting..." : "Export All Data"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={importMutation.isPending}
          className="flex-1"
          data-testid="button-import-data"
        >
          {importMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
          {importMutation.isPending ? "Importing..." : "Import Data"}
        </Button>
      </div>
      <div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCloudBackup}
          disabled={backingUp}
          className="w-full"
          data-testid="button-cloud-backup"
        >
          {backingUp ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CloudUpload className="w-3 h-3 mr-1" />}
          {backingUp ? "Backing up to Google Drive..." : "Backup to Google Drive"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          className="hidden"
          data-testid="input-import-file"
        />
      </div>
      {importResult && (
        <div className="rounded-lg border bg-muted/50 p-3 text-xs space-y-1">
          <div className="font-medium text-sm mb-1">Import Results</div>
          {Object.entries(importResult).map(([key, count]) => (
            <div key={key} className="flex justify-between">
              <span className="capitalize">{key}</span>
              <span className="font-mono">{count as number}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground/60">
        Export includes conversations, messages, personas, memories, knowledge, heartbeat tasks, and skills. API keys are redacted for security. Daily automated backups run at 3 AM UTC to Google Drive.
      </p>
    </>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [discordToken, setDiscordToken] = useState("");
  const [showDiscordToken, setShowDiscordToken] = useState(false);
  const [accessPin, setAccessPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  const settingsQuery = useQuery<AgentSettings & { discordBotToken?: string | null; accessPin?: string | null }>({
    queryKey: ["/api/settings"],
  });
  const { data: settings, isLoading } = settingsQuery;

  const { data: discordStatus } = useQuery<{ connected: boolean; username?: string; guilds?: number }>({
    queryKey: ["/api/discord/status"],
    refetchInterval: 10000,
  });

  const { data: modelsData } = useQuery<{ models: ModelInfo[]; providers: Record<string, ProviderConfig> }>({
    queryKey: ["/api/models"],
  });

  const { data: providerKeysRaw } = useQuery<ProviderKeyInfo[]>({
    queryKey: ["/api/provider-keys"],
  });

  const providerKeys = providerKeysRaw || [];
  const models = modelsData?.models || [];
  const providers = modelsData?.providers || {};

  const discordMutation = useMutation({
    mutationFn: (token: string) => apiRequest("PUT", "/api/settings", { discordBotToken: token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/discord/status"] });
      setDiscordToken("");
      toast({ description: discordToken ? "Discord bot token saved" : "Discord bot disconnected" });
    },
    onError: () => toast({ description: "Failed to update Discord settings", variant: "destructive" }),
  });

  const pinMutation = useMutation({
    mutationFn: (pin: string) => apiRequest("PUT", "/api/settings", { accessPin: pin }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setAccessPin("");
      toast({ description: accessPin ? "Access PIN configured" : "Access PIN removed" });
    },
    onError: () => toast({ description: "Failed to update PIN", variant: "destructive" }),
  });

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      agentName: "VisionClaw",
      personality: "You are VisionClaw, a helpful personal AI assistant. You are knowledgeable, concise, and friendly.",
      defaultModel: "gpt-5.1",
      thinkingEnabled: false,
    },
    values: settings ? {
      agentName: settings.agentName,
      personality: settings.personality,
      defaultModel: settings.defaultModel,
      thinkingEnabled: settings.thinkingEnabled,
    } : undefined,
  });

  const saveMutation = useMutation({
    mutationFn: (data: z.infer<typeof settingsSchema>) => apiRequest("PUT", "/api/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ description: "Settings saved" });
    },
    onError: () => toast({ description: "Failed to save settings", variant: "destructive" }),
  });

  if (isLoading) return (
    <div className="h-full flex items-center justify-center text-muted-foreground">
      Loading settings...
    </div>
  );

  if (settingsQuery.isError) return <ErrorState title="Settings Error" message="Failed to load settings. Please try again." onRetry={() => settingsQuery.refetch()} />;

  const externalProviders = Object.entries(providers).filter(([id]) => id !== "replit");

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-settings-title">Settings</h1>
            <p className="text-sm text-muted-foreground">Configure your AI assistant</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" /> Agent Identity
                </CardTitle>
                <CardDescription className="text-xs">Customize how your assistant presents itself</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="agentName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Agent Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="VisionClaw"
                          data-testid="input-agent-name"
                          className="text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="personality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">System Prompt / Personality</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={5}
                          placeholder="You are a helpful assistant..."
                          data-testid="input-personality"
                          className="text-sm font-mono resize-y"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        This is sent to the AI as the system prompt for every conversation.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-primary" /> Model Configuration
                </CardTitle>
                <CardDescription className="text-xs">Choose the AI model for new conversations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="defaultModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Default Model</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-default-model" className="text-sm">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {models.map((m) => (
                            <SelectItem key={m.id} value={m.id} className="text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{m.label}</span>
                                <span className="text-xs text-muted-foreground">— {m.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="thinkingEnabled"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm flex items-center gap-2">
                            <Brain className="w-3.5 h-3.5 text-primary" /> Thinking Mode
                          </FormLabel>
                          <FormDescription className="text-xs">
                            Enable visible reasoning on new conversations
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-thinking-enabled"
                          />
                        </FormControl>
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Button
              type="submit"
              className="w-full"
              data-testid="button-save-settings"
              disabled={saveMutation.isPending}
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </Form>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Key className="w-4 h-4 text-primary" /> API Keys
                </CardTitle>
                <CardDescription className="text-xs">
                  Connect external AI providers to unlock more models. Replit AI is always available.
                </CardDescription>
              </div>
              <TestAllKeysButton />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {externalProviders.map(([id, config]) => (
              <ProviderKeyForm
                key={id}
                providerId={id}
                config={config}
                existing={providerKeys.find((k) => k.provider === id)}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" /> Discord Integration
            </CardTitle>
            <CardDescription className="text-xs">
              Connect a Discord bot to chat with VisionClaw from any Discord server or DM.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${discordStatus?.connected ? "bg-green-500" : "bg-muted-foreground/30"}`} />
              <span className="text-xs text-muted-foreground">
                {discordStatus?.connected
                  ? `Connected as ${discordStatus.username} — ${discordStatus.guilds} server(s)`
                  : "Not connected"}
              </span>
            </div>
            {settings?.discordBotToken ? (
              <div className="flex items-center gap-2">
                <Input
                  value={settings.discordBotToken}
                  disabled
                  className="text-xs h-8 flex-1"
                  data-testid="input-discord-token-masked"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8"
                  data-testid="button-disconnect-discord"
                  onClick={() => discordMutation.mutate("")}
                  disabled={discordMutation.isPending}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showDiscordToken ? "text" : "password"}
                    placeholder="Bot token from Discord Developer Portal"
                    value={discordToken}
                    onChange={(e) => setDiscordToken(e.target.value)}
                    className="text-xs h-8 pr-8"
                    data-testid="input-discord-token"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-8 w-8"
                    onClick={() => setShowDiscordToken(!showDiscordToken)}
                  >
                    {showDiscordToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                </div>
                <Button
                  size="sm"
                  className="h-8"
                  data-testid="button-save-discord-token"
                  onClick={() => discordMutation.mutate(discordToken)}
                  disabled={!discordToken || discordMutation.isPending}
                >
                  <Check className="w-3 h-3 mr-1" /> Connect
                </Button>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground/60">
              Create a bot at{" "}
              <a href="https://discord.com/developers/applications" target="_blank" rel="noopener" className="underline">
                discord.com/developers
              </a>
              . Enable Message Content Intent. Invite with bot + applications.commands scopes.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> Security
            </CardTitle>
            <CardDescription className="text-xs">
              Protect your VisionClaw instance with a PIN code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${settings?.accessPin ? "bg-green-500" : "bg-yellow-500"}`} />
              <span className="text-xs text-muted-foreground">
                {settings?.accessPin ? "PIN protection enabled" : "No PIN — all API routes are open"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPin ? "text" : "password"}
                  placeholder={settings?.accessPin ? "Enter new PIN to change" : "Set a PIN (4+ characters)"}
                  value={accessPin}
                  onChange={(e) => setAccessPin(e.target.value)}
                  className="text-xs h-8 pr-8"
                  data-testid="input-access-pin"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-8 w-8"
                  onClick={() => setShowPin(!showPin)}
                >
                  {showPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </Button>
              </div>
              <Button
                size="sm"
                className="h-8"
                data-testid="button-set-pin"
                onClick={() => pinMutation.mutate(accessPin)}
                disabled={!accessPin || accessPin.length < 4 || pinMutation.isPending}
              >
                <Check className="w-3 h-3 mr-1" /> Set
              </Button>
              {settings?.accessPin && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8"
                  data-testid="button-remove-pin"
                  onClick={() => pinMutation.mutate("")}
                  disabled={pinMutation.isPending}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" /> Data Export / Import / Cloud Backup
            </CardTitle>
            <CardDescription className="text-xs">
              Export data locally, import from a backup, or sync to Google Drive. Automated daily backups run at 3 AM UTC.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ExportImportSection />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

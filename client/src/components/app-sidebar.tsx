import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQuery, useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, MessageSquare, Settings, Zap, Trash2, Bot, Brain, Users, Heart, BookOpen, Search, X, CreditCard, BarChart3, Download, Loader2, Home } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import type { Conversation } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isYesterday, isThisWeek } from "date-fns";

function groupConversations(convs: Conversation[]) {
  const groups: Record<string, Conversation[]> = { Today: [], Yesterday: [], "This Week": [], Older: [] };
  for (const c of convs) {
    const d = new Date(c.updatedAt);
    if (isToday(d)) groups["Today"].push(c);
    else if (isYesterday(d)) groups["Yesterday"].push(c);
    else if (isThisWeek(d)) groups["This Week"].push(c);
    else groups["Older"].push(c);
  }
  return groups;
}

function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

type SearchResult = Conversation & { snippet?: string };

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { setOpenMobile } = useSidebar();
  const [searchQuery, setSearchQuery] = useState("");
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const navigateTo = (path: string) => {
    navigate(path);
    setOpenMobile(false);
  };

  const {
    data: convPages,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["/api/conversations"],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await apiRequest("GET", `/api/conversations?limit=50&offset=${pageParam}`);
      return res.json() as Promise<{ data: Conversation[]; total: number; hasMore: boolean }>;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      const loaded = allPages.reduce((sum, p) => sum + p.data.length, 0);
      return loaded;
    },
    initialPageParam: 0,
  });

  const conversations = useMemo(() => {
    if (!convPages) return [];
    return convPages.pages.flatMap(p => p.data);
  }, [convPages]);

  const totalConversations = convPages?.pages[0]?.total ?? 0;

  const { data: searchResults } = useQuery<SearchResult[]>({
    queryKey: ["/api/search", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch.trim()) return [];
      const res = await apiRequest("GET", `/api/search?q=${encodeURIComponent(debouncedSearch.trim())}`);
      return res.json();
    },
    enabled: debouncedSearch.trim().length >= 2,
  });

  const isSearching = debouncedSearch.trim().length >= 2;
  const displayedConversations = isSearching ? (searchResults || []) : conversations;

  const { data: settings } = useQuery<{ agentName: string }>({
    queryKey: ["/api/settings"],
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/conversations", { title: "New Chat" }),
    onSuccess: async (res) => {
      const conv = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      navigateTo(`/chat/${conv.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/conversations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (location.startsWith("/chat/")) navigateTo("/");
      toast({ description: "Conversation deleted" });
    },
  });

  const groups = groupConversations(displayedConversations as Conversation[]);
  const activeId = location.startsWith("/chat/") ? location.split("/chat/")[1] : null;

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground text-base">🦞</span>
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-sidebar-foreground truncate">
              {settings?.agentName || "VisionClaw"}
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </div>
        </div>
        <Button
          size="sm"
          className="w-full"
          data-testid="button-new-chat"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          <Plus className="w-4 h-4 mr-1" />
          New Chat
        </Button>
        <div className="relative mt-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="h-8 pl-7 pr-7 text-xs"
            data-testid="input-search-conversations"
          />
          {searchQuery && (
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery("")}
              data-testid="button-clear-search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        {isSearching && searchResults && (
          <div className="text-xs text-muted-foreground mt-1 px-1" data-testid="text-search-count">
            {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} found
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : isSearching && displayedConversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No results for "{debouncedSearch}"</p>
          </div>
        ) : !isSearching && conversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No conversations yet.</p>
            <p className="text-xs mt-1">Start a new chat above.</p>
          </div>
        ) : (
          <>
            {isSearching ? (
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs text-muted-foreground px-3 py-1">
                  Search Results
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {(displayedConversations as SearchResult[]).map((conv) => (
                      <SidebarMenuItem key={conv.id}>
                        <div className="group flex items-center w-full">
                          <SidebarMenuButton
                            asChild
                            isActive={activeId === String(conv.id)}
                            data-testid={`link-conversation-${conv.id}`}
                          >
                            <a
                              href={`/chat/${conv.id}`}
                              onClick={(e) => { e.preventDefault(); navigateTo(`/chat/${conv.id}`); }}
                              className="flex-1 min-w-0"
                            >
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1">
                                  <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                                  <span className="truncate text-sm">{conv.title}</span>
                                </div>
                                {conv.snippet && (
                                  <span className="text-xs text-muted-foreground truncate mt-0.5 pl-4.5" data-testid={`text-snippet-${conv.id}`}>
                                    {conv.snippet}
                                  </span>
                                )}
                              </div>
                            </a>
                          </SidebarMenuButton>
                        </div>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : (
              Object.entries(groups).map(([label, convs]) =>
                convs.length > 0 ? (
                  <SidebarGroup key={label}>
                    <SidebarGroupLabel className="text-xs text-muted-foreground px-3 py-1">
                      {label}
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {convs.map((conv) => (
                          <SidebarMenuItem key={conv.id}>
                            <div className="group flex items-center w-full">
                              <SidebarMenuButton
                                asChild
                                isActive={activeId === String(conv.id)}
                                data-testid={`link-conversation-${conv.id}`}
                              >
                                <a
                                  href={`/chat/${conv.id}`}
                                  onClick={(e) => { e.preventDefault(); navigateTo(`/chat/${conv.id}`); }}
                                  className="flex-1 min-w-0"
                                >
                                  <MessageSquare className="w-4 h-4 shrink-0 opacity-60" />
                                  <span className="truncate text-sm">{conv.title}</span>
                                </a>
                              </SidebarMenuButton>
                              <button
                                className="ml-1 mr-1 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                                data-testid={`button-delete-conversation-${conv.id}`}
                                onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(conv.id); }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                ) : null
              )
            )}
            {!isSearching && hasNextPage && (
              <div className="px-3 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  data-testid="button-load-more-conversations"
                >
                  {isFetchingNextPage ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Loading...</>
                  ) : (
                    <>Load More ({conversations.length} of {totalConversations})</>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location === "/"}
              data-testid="link-home"
            >
              <a href="/" onClick={(e) => { e.preventDefault(); navigateTo("/"); }}>
                <Home className="w-4 h-4" />
                <span>Home</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location === "/personas"}
              data-testid="link-personas"
            >
              <a href="/personas" onClick={(e) => { e.preventDefault(); navigateTo("/personas"); }}>
                <Users className="w-4 h-4" />
                <span>Personas</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location === "/memory"}
              data-testid="link-memory"
            >
              <a href="/memory" onClick={(e) => { e.preventDefault(); navigateTo("/memory"); }}>
                <Brain className="w-4 h-4" />
                <span>Memory</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location === "/knowledge"}
              data-testid="link-knowledge"
            >
              <a href="/knowledge" onClick={(e) => { e.preventDefault(); navigateTo("/knowledge"); }}>
                <BookOpen className="w-4 h-4" />
                <span>Knowledge</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location === "/heartbeat"}
              data-testid="link-heartbeat"
            >
              <a href="/heartbeat" onClick={(e) => { e.preventDefault(); navigateTo("/heartbeat"); }}>
                <Heart className="w-4 h-4" />
                <span>Heartbeat</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location === "/skills"}
              data-testid="link-skills"
            >
              <a href="/skills" onClick={(e) => { e.preventDefault(); navigateTo("/skills"); }}>
                <Zap className="w-4 h-4" />
                <span>Skills</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location === "/analytics"}
              data-testid="link-analytics"
            >
              <a href="/analytics" onClick={(e) => { e.preventDefault(); navigateTo("/analytics"); }}>
                <BarChart3 className="w-4 h-4" />
                <span>Analytics</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location === "/payments"}
              data-testid="link-payments"
            >
              <a href="/payments" onClick={(e) => { e.preventDefault(); navigateTo("/payments"); }}>
                <CreditCard className="w-4 h-4" />
                <span>Payments</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location === "/settings"}
              data-testid="link-settings"
            >
              <a href="/settings" onClick={(e) => { e.preventDefault(); navigateTo("/settings"); }}>
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {installPrompt && (
            <SidebarMenuItem>
              <SidebarMenuButton
                data-testid="button-install-pwa"
                onClick={async () => {
                  installPrompt.prompt();
                  const result = await installPrompt.userChoice;
                  if (result.outcome === "accepted") setInstallPrompt(null);
                }}
              >
                <Download className="w-4 h-4" />
                <span>Install App</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

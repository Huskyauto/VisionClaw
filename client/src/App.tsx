import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient, setAuthToken } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/lib/auth";
import HomePage from "@/pages/home";
import ChatPage from "@/pages/chat";
import SettingsPage from "@/pages/settings";
import SkillsPage from "@/pages/skills";
import PersonasPage from "@/pages/personas";
import MemoryPage from "@/pages/memory";
import HeartbeatPage from "@/pages/heartbeat";
import KnowledgePage from "@/pages/knowledge";
import PaymentsPage from "@/pages/payments";
import AnalyticsPage from "@/pages/analytics";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";

function PageRouter() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/chat/:id" component={ChatPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/skills" component={SkillsPage} />
      <Route path="/personas" component={PersonasPage} />
      <Route path="/memory" component={MemoryPage} />
      <Route path="/heartbeat" component={HeartbeatPage} />
      <Route path="/knowledge" component={KnowledgePage} />
      <Route path="/payments" component={PaymentsPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthGate() {
  const { token, authRequired, isChecking } = useAuth();

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (authRequired && !token) {
    return <LoginPage />;
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between px-4 py-2 border-b border-border h-12 shrink-0 bg-background/95 backdrop-blur-sm sticky top-0 z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" className="text-muted-foreground" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-hidden">
            <PageRouter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

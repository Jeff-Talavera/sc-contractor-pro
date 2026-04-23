import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient, getQueryFn, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import ClientsPage from "@/pages/clients";
import JobsitesPage from "@/pages/jobsites";
import InspectionsPage from "@/pages/inspections";
import CodeLibraryPage from "@/pages/code-library";
import WorkforcePage from "@/pages/workforce";
import ContractorsPage from "@/pages/contractors";
import SafetyRatingsPage from "@/pages/safety-ratings";
import SettingsPage from "@/pages/settings";
import LoginPage from "@/pages/login";
import AdminPortal from "@/pages/admin";
import { HardHat, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { User, Organization } from "@shared/schema";

const routePageNames: Array<[string, string]> = [
  ["/clients", "Clients"],
  ["/jobsites", "Jobsites"],
  ["/inspections", "Inspections"],
  ["/code-library", "Code Library"],
  ["/workforce", "Workforce"],
  ["/contractors", "Contractors"],
  ["/safety-ratings", "Safety Ratings"],
  ["/settings", "Settings"],
  ["/", "Dashboard"],
];

function getPageName(location: string): string {
  for (const [prefix, name] of routePageNames) {
    if (prefix === "/" ? location === "/" : location.startsWith(prefix)) {
      return name;
    }
  }
  return "SafeSite";
}

function TopNav() {
  const [location, navigate] = useLocation();
  const { data: me } = useQuery<{ user: User; organization: Organization } | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const initials = me?.user.name
    ? me.user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  async function handleLogout() {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {
      // Session may have already expired — navigate to login regardless
    }
    queryClient.clear();
    navigate("/login");
  }

  return (
    <header
      className="flex items-center justify-between px-4 h-14 bg-gray-900 text-white sticky top-0 z-50 shrink-0"
      data-testid="topnav-header"
    >
      <div className="flex items-center gap-3">
        <SidebarTrigger
          className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8"
          data-testid="button-sidebar-toggle"
        />
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-primary">
            <HardHat className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-wide text-white">SafeSite</span>
        </div>
      </div>

      <span className="text-sm font-medium text-white/80 hidden sm:block" data-testid="text-page-name">
        {getPageName(location)}
      </span>

      <div className="flex items-center gap-2">
        {me?.user.name && (
          <span className="text-xs text-white/60 hidden md:block">
            {me.user.name}
          </span>
        )}
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-xs font-semibold select-none"
          data-testid="avatar-user"
        >
          {initials}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
          onClick={handleLogout}
          title="Sign out"
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

function AuthGuard({ children, requireSuperAdmin = false }: { children: React.ReactNode; requireSuperAdmin?: boolean }) {
  const { data: me, isLoading } = useQuery<{ user: User; organization: Organization } | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary animate-pulse">
            <HardHat className="h-5 w-5 text-white" />
          </div>
          <span className="text-sm text-gray-500">Loading…</span>
        </div>
      </div>
    );
  }

  if (!me) {
    return <Redirect to="/login" />;
  }

  // Super admins go to /admin; prevent them from seeing the regular app
  if (me.user.isSuperAdmin && !requireSuperAdmin) {
    return <Redirect to="/admin" />;
  }

  // Regular users cannot access /admin
  if (!me.user.isSuperAdmin && requireSuperAdmin) {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}

function AppShell() {
  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full flex-col">
        <TopNav />
        <div className="flex flex-1 min-h-0">
          <AppSidebar />
          <main className="flex-1 overflow-hidden">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/clients" component={ClientsPage} />
              <Route path="/clients/:id" component={ClientsPage} />
              <Route path="/jobsites" component={JobsitesPage} />
              <Route path="/jobsites/:id" component={JobsitesPage} />
              <Route path="/inspections" component={InspectionsPage} />
              <Route path="/inspections/:id" component={InspectionsPage} />
              <Route path="/code-library" component={CodeLibraryPage} />
              <Route path="/workforce" component={WorkforcePage} />
              <Route path="/workforce/:id" component={WorkforcePage} />
              <Route path="/contractors" component={ContractorsPage} />
              <Route path="/contractors/:id" component={ContractorsPage} />
              <Route path="/safety-ratings" component={SafetyRatingsPage} />
              <Route path="/safety-ratings/:clientId" component={SafetyRatingsPage} />
              <Route path="/settings" component={SettingsPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AdminWrapper() {
  const [, navigate] = useLocation();

  async function handleLogout() {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {
      // Session may have expired — navigate to login regardless
    }
    queryClient.clear();
    navigate("/login");
  }

  return (
    <AuthGuard requireSuperAdmin>
      <AdminPortal onLogout={handleLogout} />
    </AuthGuard>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route path="/admin" component={AdminWrapper} />
          <Route>
            <AuthGuard>
              <AppShell />
            </AuthGuard>
          </Route>
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
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
import SafetyRatingsPage from "@/pages/safety-ratings";
import SettingsPage from "@/pages/settings";
import { HardHat } from "lucide-react";
import type { User, Organization } from "@shared/schema";

const routePageNames: Array<[string, string]> = [
  ["/clients", "Clients"],
  ["/jobsites", "Jobsites"],
  ["/inspections", "Inspections"],
  ["/code-library", "Code Library"],
  ["/workforce", "Workforce"],
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
  const [location] = useLocation();
  const { data: me } = useQuery<{ user: User; organization: Organization }>({
    queryKey: ["/api/me"],
  });

  const initials = me?.user.name
    ? me.user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

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
      </div>
    </header>
  );
}

function Router() {
  return (
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
      <Route path="/safety-ratings" component={SafetyRatingsPage} />
      <Route path="/safety-ratings/:clientId" component={SafetyRatingsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full flex-col">
            <TopNav />
            <div className="flex flex-1 min-h-0">
              <AppSidebar />
              <main className="flex-1 overflow-hidden">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

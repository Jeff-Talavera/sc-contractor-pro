import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Users,
  Building2,
  ClipboardCheck,
  BookOpen,
  HardHat,
  UserCog,
  Shield,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Disclaimer } from "@/components/disclaimer";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Jobsites", url: "/jobsites", icon: Building2 },
  { title: "Inspections", url: "/inspections", icon: ClipboardCheck },
  { title: "Code Library", url: "/code-library", icon: BookOpen },
  { title: "Workforce", url: "/workforce", icon: UserCog },
  { title: "Safety Ratings", url: "/safety-ratings", icon: Shield },
];

export function AppSidebar() {
  const [location] = useLocation();

  const isActive = (url: string) => {
    if (url === "/") return location === "/";
    return location.startsWith(url);
  };

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4 border-b border-sidebar-border">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer" data-testid="link-home">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <HardHat className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight">SafeSite</span>
              <span className="text-xs text-muted-foreground leading-tight">Construction Safety</span>
            </div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={active}
                      className={
                        active
                          ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-medium rounded-md"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/10 hover:text-sidebar-foreground rounded-md"
                      }
                    >
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2 border-t border-sidebar-border">
        <Disclaimer compact />
      </SidebarFooter>
    </Sidebar>
  );
}

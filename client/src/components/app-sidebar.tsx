import {
  LayoutDashboard,
  Database,
  AlertTriangle,
  Trophy,
  Wallet,
  FlaskConical,
  FileText,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";

const menuItems = [
  {
    title: "Overview",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Data Intake Monitor",
    url: "/data-intake",
    icon: Database,
  },
  {
    title: "Validation Queue",
    url: "/validation",
    icon: AlertTriangle,
  },
  {
    title: "Fixtures & Picks",
    url: "/fixtures",
    icon: Trophy,
  },
  {
    title: "Bankroll & Bets",
    url: "/bankroll",
    icon: Wallet,
  },
  {
    title: "Model Lab",
    url: "/models",
    icon: FlaskConical,
  },
  {
    title: "Post-Weekend Review",
    url: "/review",
    icon: FileText,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-semibold px-4 py-4">
            Rugby Predictions
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

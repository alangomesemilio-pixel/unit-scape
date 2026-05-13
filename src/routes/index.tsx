import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OrgChart } from "@/components/org/OrgChart";
import { MeetingsDashboard } from "@/components/meetings/MeetingsDashboard";
import { ExecutiveDashboard } from "@/components/exec/ExecutiveDashboard";
import { ExecAiChat } from "@/components/ai/ExecAiChat";
import { ForecastingDashboard } from "@/components/forecast/ForecastingDashboard";
import { Toaster } from "@/components/ui/sonner";
import { Network, CalendarCheck, LayoutDashboard, Sparkles, LineChart } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "GRAx Group — Dashboard Estratégico" },
      {
        name: "description",
        content:
          "Organograma e sistema de reuniões da GRAx Group: governança, KPIs e planos de ação semanais.",
      },
    ],
  }),
});

type View = "exec" | "org" | "meetings" | "ai";

function Index() {
  const [view, setView] = useState<View>("exec");

  return (
    <div className="h-screen w-screen flex flex-col bg-background">
      {/* Top nav */}
      <nav className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card/80 backdrop-blur z-20">
        <div className="flex items-center gap-2 mr-4">
          <div className="size-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
            G
          </div>
          <span className="font-bold text-sm">GRAx Group</span>
        </div>
        <NavBtn active={view === "exec"} onClick={() => setView("exec")} icon={LayoutDashboard}>
          Cockpit Executivo
        </NavBtn>
        <NavBtn active={view === "org"} onClick={() => setView("org")} icon={Network}>
          Organograma
        </NavBtn>
        <NavBtn active={view === "meetings"} onClick={() => setView("meetings")} icon={CalendarCheck}>
          Reuniões & Governança
        </NavBtn>
        <NavBtn active={view === "ai"} onClick={() => setView("ai")} icon={Sparkles}>
          IA Executiva
        </NavBtn>
      </nav>

      <div className="flex-1 min-h-0">
        {view === "exec" ? (
          <ExecutiveDashboard />
        ) : view === "org" ? (
          <OrgChart />
        ) : view === "meetings" ? (
          <MeetingsDashboard />
        ) : (
          <ExecAiChat />
        )}
      </div>
      <Toaster theme="dark" />
    </div>
  );
}

function NavBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Network;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      }`}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OrgChart } from "@/components/org/OrgChart";
import { MeetingsDashboard } from "@/components/meetings/MeetingsDashboard";
import { ExecutiveDashboard } from "@/components/exec/ExecutiveDashboard";
import { SomaForecasting } from "@/components/soma/SomaForecasting";
import { OkrsPage } from "@/components/okrs/OkrsPage";
import { Toaster } from "@/components/ui/sonner";
import { PasswordGate } from "@/components/auth/PasswordGate";
import { Network, CalendarCheck, LayoutDashboard, LineChart, Target } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "GRAx Group — Dashboard Estratégico" },
      {
        name: "description",
        content:
          "Dashboard estratégico GRAx / SOMA: forecasting, OKRs, organograma e rotinas.",
      },
    ],
  }),
});

type View = "dashboard" | "forecasting" | "okrs" | "organograma" | "rotinas";

function Index() {
  const [view, setView] = useState<View>("dashboard");

  return (
    <PasswordGate>
      <div className="h-screen w-screen flex flex-col">
        <nav className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card/80 backdrop-blur z-20">
          <div className="flex items-center gap-2 mr-4">
            <div className="size-7 rounded-md soma-brand-gradient flex items-center justify-center text-primary-foreground font-bold text-sm shadow-md">
              G
            </div>
            <span className="font-bold text-sm">GRAx Group</span>
          </div>
          <NavBtn active={view === "dashboard"} onClick={() => setView("dashboard")} icon={LayoutDashboard}>
            Dashboard
          </NavBtn>
          <NavBtn active={view === "forecasting"} onClick={() => setView("forecasting")} icon={LineChart}>
            Forecasting
          </NavBtn>
          <NavBtn active={view === "okrs"} onClick={() => setView("okrs")} icon={Target}>
            OKRs
          </NavBtn>
          <NavBtn active={view === "organograma"} onClick={() => setView("organograma")} icon={Network}>
            Organograma
          </NavBtn>
          <NavBtn active={view === "rotinas"} onClick={() => setView("rotinas")} icon={CalendarCheck}>
            Rotinas
          </NavBtn>
        </nav>

        <div className="flex-1 min-h-0">
          {view === "dashboard" ? (
            <ExecutiveDashboard />
          ) : view === "forecasting" ? (
            <SomaForecasting />
          ) : view === "okrs" ? (
            <OkrsPage />
          ) : view === "organograma" ? (
            <OrgChart />
          ) : (
            <MeetingsDashboard />
          )}
        </div>
        <Toaster theme="dark" />
      </div>
    </PasswordGate>
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
          ? "bg-primary/15 text-primary border border-primary/30"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      }`}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}

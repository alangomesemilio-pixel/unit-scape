import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OrgChart } from "@/components/org/OrgChart";
import { MeetingsDashboard } from "@/components/meetings/MeetingsDashboard";
import { ExecutiveDashboard } from "@/components/exec/ExecutiveDashboard";
import { ExecAiChat } from "@/components/ai/ExecAiChat";
import { ForecastingDashboard } from "@/components/forecast/ForecastingDashboard";
import { SomaForecasting } from "@/components/soma/SomaForecasting";
import { NovoForecast } from "@/components/soma/NovoForecast";
import { NovoOkrs } from "@/components/soma/NovoOkrs";
import { ForecastDinamico } from "@/components/soma/ForecastDinamico";
import { Toaster } from "@/components/ui/sonner";
import { PasswordGate } from "@/components/auth/PasswordGate";
import { Network, CalendarCheck, LayoutDashboard, Sparkles, LineChart, Heart, Rocket, Target, Gauge } from "lucide-react";

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

type View = "exec" | "forecast" | "soma" | "novo" | "dinamico" | "okrs" | "org" | "meetings" | "ai";

function Index() {
  const [view, setView] = useState<View>("exec");

  return (
    <PasswordGate>
    <div className="h-screen w-screen flex flex-col">
      {/* Top nav */}
      <nav className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card/80 backdrop-blur z-20">
        <div className="flex items-center gap-2 mr-4">
          <div className="size-7 rounded-md soma-brand-gradient flex items-center justify-center text-primary-foreground font-bold text-sm shadow-md">
            G
          </div>
          <span className="font-bold text-sm">GRAx Group</span>
        </div>
        <NavBtn active={view === "exec"} onClick={() => setView("exec")} icon={LayoutDashboard}>
          Cockpit Executivo
        </NavBtn>
        <NavBtn active={view === "forecast"} onClick={() => setView("forecast")} icon={LineChart}>
          Forecasting
        </NavBtn>
        <NavBtn active={view === "soma"} onClick={() => setView("soma")} icon={Heart}>
          Forecasting Estratégico – Soma
        </NavBtn>
        <NavBtn active={view === "novo"} onClick={() => setView("novo")} icon={Rocket}>
          Novo Forecast Estratégico
        </NavBtn>
        <NavBtn active={view === "okrs"} onClick={() => setView("okrs")} icon={Target}>
          OKRs &amp; PDCA
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
        ) : view === "forecast" ? (
          <ForecastingDashboard />
        ) : view === "soma" ? (
          <SomaForecasting />
        ) : view === "novo" ? (
          <NovoForecast />
        ) : view === "okrs" ? (
          <NovoOkrs />
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
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      }`}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OrgChart } from "@/components/org/OrgChart";
import { MeetingsDashboard } from "@/components/meetings/MeetingsDashboard";
import { ExecAiChat } from "@/components/ai/ExecAiChat";
import { SomaForecasting } from "@/components/soma/SomaForecasting";
import { NovoOkrs } from "@/components/soma/NovoOkrs";
import { ExecutiveHome } from "@/components/exec/ExecutiveHome";
import { AppSidebar, AppSidebarMobile, type ExecView } from "@/components/exec/AppSidebar";

import { Toaster } from "@/components/ui/sonner";
import { PasswordGate } from "@/components/auth/PasswordGate";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "GRAx Group — Dashboard Estratégico" },
      {
        name: "description",
        content:
          "Cockpit executivo da GRAx Group: KPIs, forecasting, OKRs, organograma e rituais de governança.",
      },
    ],
  }),
});

function Index() {
  const [view, setView] = useState<ExecView>("home");

  return (
    <PasswordGate>
      <div className="h-screen w-screen flex flex-col md:flex-row overflow-hidden">
        <AppSidebar view={view} onChange={setView} />
        <div className="flex-1 min-w-0 flex flex-col">
          <AppSidebarMobile view={view} onChange={setView} />
          <main className="flex-1 min-h-0">
            {view === "home" ? (
              <ExecutiveHome />
            ) : view === "soma" ? (
              <SomaForecasting />
            ) : view === "okrs" ? (
              <NovoOkrs />
            ) : view === "org" ? (
              <OrgChart />
            ) : view === "meetings" ? (
              <MeetingsDashboard />
            ) : (
              <ExecAiChat />
            )}
          </main>
        </div>
        <Toaster theme="dark" />
      </div>
    </PasswordGate>
  );
}

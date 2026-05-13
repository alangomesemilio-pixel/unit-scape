import { createFileRoute } from "@tanstack/react-router";
import { OrgChart } from "@/components/org/OrgChart";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "GRAx Group — Organograma Estratégico" },
      { name: "description", content: "Organograma interativo da GRAx Group com cargos, responsabilidades e KPIs." },
    ],
  }),
});

function Index() {
  return (
    <>
      <OrgChart />
      <Toaster theme="dark" />
    </>
  );
}

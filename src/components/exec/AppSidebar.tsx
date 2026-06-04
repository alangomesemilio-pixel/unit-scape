import { Home, LineChart, Target, Network, CalendarCheck, Sparkles } from "lucide-react";

export type ExecView = "home" | "soma" | "okrs" | "org" | "meetings" | "ai";

const ITEMS: { id: ExecView; label: string; icon: typeof Home; accent: string }[] = [
  { id: "home", label: "Home", icon: Home, accent: "var(--soma-coral)" },
  { id: "soma", label: "SOMA", icon: LineChart, accent: "var(--soma-lavender)" },
  { id: "okrs", label: "OKRs", icon: Target, accent: "var(--level-intl)" },
  { id: "org", label: "Organograma", icon: Network, accent: "var(--level-head)" },
  { id: "meetings", label: "Reuniões", icon: CalendarCheck, accent: "var(--soma-coral-soft)" },
  { id: "ai", label: "AI Advisor", icon: Sparkles, accent: "var(--soma-lilac)" },
];

export function AppSidebar({
  view,
  onChange,
}: {
  view: ExecView;
  onChange: (v: ExecView) => void;
}) {
  return (
    <aside className="hidden md:flex w-60 flex-col border-r border-border bg-card/60 backdrop-blur shrink-0">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <div className="size-8 rounded-lg soma-brand-gradient flex items-center justify-center text-primary-foreground font-bold shadow-md">
          G
        </div>
        <div className="leading-tight">
          <div className="font-bold text-sm">GRAx Group</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Cockpit Executivo</div>
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {ITEMS.map((it) => {
          const active = view === it.id;
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative ${
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full transition-opacity"
                style={{
                  background: it.accent,
                  opacity: active ? 1 : 0,
                }}
              />
              <Icon
                className="size-4 shrink-0"
                style={{ color: active ? it.accent : undefined }}
              />
              <span>{it.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border text-[10px] text-muted-foreground">
        v2 · Dashboard Executivo
      </div>
    </aside>
  );
}

// Mobile top-bar fallback
export function AppSidebarMobile({ view, onChange }: { view: ExecView; onChange: (v: ExecView) => void }) {
  return (
    <nav className="md:hidden flex items-center gap-1 px-2 py-2 border-b border-border bg-card/80 backdrop-blur overflow-x-auto">
      {ITEMS.map((it) => {
        const active = view === it.id;
        const Icon = it.icon;
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium shrink-0 ${
              active ? "bg-primary/15 text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="size-3.5" />
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}

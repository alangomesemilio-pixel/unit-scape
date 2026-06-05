import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MEETINGS } from "@/lib/meetings-data";
import { ReportsStatusPanel } from "./ReportsStatusPanel";
import {
  DollarSign,
  TrendingUp,
  Target,
  Users,
  Repeat,
  Briefcase,
  Heart,
  Sparkles,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  CheckCircle2,
  CalendarCheck,
  Pencil,
} from "lucide-react";

const ICONS: Record<string, typeof DollarSign> = {
  DollarSign, TrendingUp, Target, Users, Repeat, Briefcase, Heart, Sparkles,
};

type Kpi = {
  id: string;
  kpi_id: string;
  mes: string;
  nome: string;
  dono: string | null;
  meta: number;
  realizado: number;
  unit: string;
  direction: "up" | "down";
  icon: string | null;
  accent: string | null;
  ordem: number;
};

const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const daysInMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};

const dayOfMonth = () => new Date().getDate();

function fmt(value: number, unit: string) {
  if (unit === "R$") {
    if (Math.abs(value) >= 1000)
      return `R$ ${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
    return `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
  }
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "x") return `${value.toFixed(2)}x`;
  return value.toLocaleString("pt-BR");
}

function statusFor(realizado: number, meta: number, direction: "up" | "down") {
  if (meta === 0) return { color: "var(--muted-foreground)", label: "—", level: "neutral" as const };
  if (direction === "down") {
    const ratio = realizado / meta;
    if (ratio <= 1.0) return { color: "#22c55e", label: "OK", level: "ok" as const };
    if (ratio <= 1.3) return { color: "#eab308", label: "Atenção", level: "warn" as const };
    return { color: "#ef4444", label: "Crítico", level: "crit" as const };
  }
  const pct = (realizado / meta) * 100;
  if (pct > 100) return { color: "#a855f7", label: "Superou", level: "over" as const };
  if (pct >= 86) return { color: "#22c55e", label: "No ritmo", level: "ok" as const };
  if (pct >= 60) return { color: "#eab308", label: "Atenção", level: "warn" as const };
  return { color: "#ef4444", label: "Ação necessária", level: "crit" as const };
}

function pctAtingido(realizado: number, meta: number, direction: "up" | "down") {
  if (meta === 0) return 0;
  if (direction === "down") {
    if (realizado === 0) return 100;
    return Math.max(0, Math.min(200, (meta / realizado) * 100));
  }
  return Math.max(0, (realizado / meta) * 100);
}

export function ExecutiveHome() {
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [loading, setLoading] = useState(true);
  const mes = currentMonthKey();

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("kpis_executivos")
        .select("*")
        .eq("mes", mes)
        .order("ordem", { ascending: true });
      if (!alive) return;
      if (error) console.error(error);
      setKpis((data as Kpi[]) ?? []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [mes]);

  async function update(kpi: Kpi, patch: Partial<Pick<Kpi, "realizado" | "meta">>) {
    setKpis((prev) => prev.map((k) => (k.id === kpi.id ? { ...k, ...patch } : k)));
    await supabase.from("kpis_executivos").update(patch).eq("id", kpi.id);
  }

  const receita = kpis.find((k) => k.kpi_id === "receita");
  const dim = daysInMonth();
  const dom = dayOfMonth();
  const pctMes = (dom / dim) * 100;

  // Receita por canal — pega do soma_kv se existir (legacy)
  const [canais, setCanais] = useState<{ nome: string; realizado: number; meta: number; dono: string }[]>([
    { nome: "E-commerce / Site", realizado: 0, meta: 250000, dono: "Fernando" },
    { nome: "B2B", realizado: 0, meta: 80000, dono: "Igor" },
    { nome: "Influenciadora", realizado: 0, meta: 60000, dono: "Vanessa" },
    { nome: "WhatsApp", realizado: 0, meta: 30000, dono: "Ian" },
    { nome: "TikTok Shop", realizado: 0, meta: 20000, dono: "Vanessa" },
    { nome: "Assinatura", realizado: 0, meta: 15000, dono: "Ian" },
  ]);

  const totalRealCanais = canais.reduce((a, c) => a + c.realizado, 0);
  const totalMetaCanais = canais.reduce((a, c) => a + c.meta, 0);

  const projecao = useMemo(() => {
    const r = receita?.realizado ?? totalRealCanais;
    if (!dom) return { fecho: 0, ritmoDia: 0 };
    const fecho = (r / dom) * dim;
    const faltaDias = Math.max(1, dim - dom);
    const meta = receita?.meta ?? totalMetaCanais;
    const ritmoDia = Math.max(0, (meta - r) / faltaDias);
    return { fecho, ritmoDia };
  }, [receita, dom, dim, totalRealCanais, totalMetaCanais]);

  const alerts = useMemo(() => {
    const out: { tone: "warn" | "crit"; msg: string }[] = [];
    kpis.forEach((k) => {
      const s = statusFor(k.realizado, k.meta, k.direction);
      if (s.level === "crit") out.push({ tone: "crit", msg: `${k.nome} (${k.dono}) em zona crítica` });
      else if (s.level === "warn" && dom > 15) out.push({ tone: "warn", msg: `${k.nome} em risco — atingimento parcial` });
    });
    return out;
  }, [kpis, dom]);

  const semafGeral = receita
    ? statusFor(receita.realizado || totalRealCanais, receita.meta || totalMetaCanais, "up")
    : statusFor(totalRealCanais, totalMetaCanais, "up");

  const proximasReunioes = MEETINGS.slice(0, 3);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Status bar */}
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center gap-6">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Mês atual</div>
            <div className="text-lg font-bold">
              {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Mês decorrido</span>
              <span>{pctMes.toFixed(0)}% · dia {dom}/{dim}</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-muted-foreground/40" style={{ width: `${pctMes}%` }} />
            </div>
          </div>
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Meta Receita Total</span>
              <span>
                {fmt(receita?.realizado || totalRealCanais, "R$")} / {fmt(receita?.meta || totalMetaCanais, "R$")}
              </span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, pctAtingido(receita?.realizado || totalRealCanais, receita?.meta || totalMetaCanais, "up"))}%`,
                  background: semafGeral.color,
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: `${semafGeral.color}22` }}>
            <span className="size-2.5 rounded-full" style={{ background: semafGeral.color }} />
            <span className="text-sm font-semibold" style={{ color: semafGeral.color }}>
              {semafGeral.label}
            </span>
          </div>
        </div>

        {/* KPI cards */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">KPIs principais</h2>
            <span className="text-xs text-muted-foreground">Clique nos valores para editar</span>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-36 rounded-2xl bg-card animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {kpis.map((k) => (
                <KpiCard key={k.id} kpi={k} onUpdate={(p) => update(k, p)} />
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Receita por canal */}
          <section className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider">Receita por canal</h2>
              <span className="text-xs text-muted-foreground">
                Total: {fmt(totalRealCanais, "R$")} / {fmt(totalMetaCanais, "R$")}
              </span>
            </div>
            <div className="space-y-3">
              {canais.map((c, i) => {
                const pct = c.meta ? (c.realizado / c.meta) * 100 : 0;
                const s = statusFor(c.realizado, c.meta, "up");
                return (
                  <div key={c.nome}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.nome}</span>
                        <span className="text-muted-foreground">· {c.dono}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <InlineNum
                          value={c.realizado}
                          unit="R$"
                          onCommit={(v) => setCanais((prev) => prev.map((x, j) => (j === i ? { ...x, realizado: v } : x)))}
                        />
                        <span>/ {fmt(c.meta, "R$")}</span>
                        <span className="font-semibold" style={{ color: s.color }}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full transition-all duration-700"
                        style={{ width: `${Math.min(100, pct)}%`, background: s.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Projeção */}
          <section className="rounded-2xl border border-border bg-card p-5 flex flex-col">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-3">Projeção de fechamento</h2>
            <div className="flex-1 flex flex-col justify-center">
              <div className="text-xs text-muted-foreground mb-1">No ritmo atual, você fecha:</div>
              <div className="text-3xl font-bold mb-3" style={{ color: semafGeral.color }}>
                {fmt(projecao.fecho, "R$")}
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ritmo necessário/dia</span>
                  <span className="font-semibold">{fmt(projecao.ritmoDia, "R$")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dias restantes</span>
                  <span className="font-semibold">{Math.max(0, dim - dom)} de {dim}</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Alertas */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-3">Alertas ativos</h2>
            {alerts.length === 0 ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/30">
                <CheckCircle2 className="size-5 text-[#22c55e]" />
                <span className="text-sm font-medium">Tudo no ritmo ✅</span>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-xl border"
                    style={{
                      background: `${a.tone === "crit" ? "#ef4444" : "#eab308"}15`,
                      borderColor: `${a.tone === "crit" ? "#ef4444" : "#eab308"}40`,
                    }}
                  >
                    <AlertTriangle
                      className="size-4 shrink-0"
                      style={{ color: a.tone === "crit" ? "#ef4444" : "#eab308" }}
                    />
                    <span className="text-sm">{a.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Próximas reuniões */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-3">Próximas reuniões</h2>
            <div className="space-y-2">
              {proximasReunioes.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border"
                >
                  <div
                    className="size-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${m.accent}30` }}
                  >
                    <CalendarCheck className="size-4" style={{ color: m.accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm truncate">{m.title}</div>
                      <div className="text-[10px] text-muted-foreground shrink-0">{m.duration}</div>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{m.day}</div>
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {m.participants.slice(0, 5).join(", ")}
                      {m.participants.length > 5 ? " …" : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <ReportsStatusPanel />
      </div>
    </div>
  );
}

function KpiCard({ kpi, onUpdate }: { kpi: Kpi; onUpdate: (p: Partial<Pick<Kpi, "realizado" | "meta">>) => void }) {
  const Icon = ICONS[kpi.icon ?? ""] ?? Target;
  const s = statusFor(kpi.realizado, kpi.meta, kpi.direction);
  const pct = pctAtingido(kpi.realizado, kpi.meta, kpi.direction);
  const trendUp = kpi.direction === "up" ? kpi.realizado >= kpi.meta : kpi.realizado <= kpi.meta;

  return (
    <div
      className="relative rounded-2xl border bg-card p-4 overflow-hidden transition-all hover:scale-[1.01]"
      style={{ borderColor: `${s.color}40` }}
    >
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ background: `radial-gradient(circle at top right, ${kpi.accent || s.color}, transparent 60%)` }}
      />
      <div className="relative">
        <div className="flex items-start justify-between mb-2">
          <div
            className="size-9 rounded-lg flex items-center justify-center"
            style={{ background: `${kpi.accent || s.color}25` }}
          >
            <Icon className="size-4" style={{ color: kpi.accent || s.color }} />
          </div>
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: `${s.color}20`, color: s.color }}
          >
            {trendUp ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {pct.toFixed(0)}%
          </div>
        </div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">
          {kpi.nome} {kpi.dono ? `· ${kpi.dono}` : ""}
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <InlineNum
            value={kpi.realizado}
            unit={kpi.unit}
            onCommit={(v) => onUpdate({ realizado: v })}
            className="text-2xl font-bold tracking-tight"
          />
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
          <span>Meta:</span>
          <InlineNum
            value={kpi.meta}
            unit={kpi.unit}
            onCommit={(v) => onUpdate({ meta: v })}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          />
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full transition-all duration-700"
            style={{ width: `${Math.min(100, pct)}%`, background: s.color }}
          />
        </div>
      </div>
    </div>
  );
}

function InlineNum({
  value,
  unit,
  onCommit,
  className,
}: {
  value: number;
  unit: string;
  onCommit: (v: number) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = () => {
    const n = parseFloat(draft.replace(/\./g, "").replace(",", "."));
    if (!isNaN(n) && n !== value) {
      onCommit(n);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        className={`bg-transparent outline-none border-b border-primary/50 px-0.5 w-28 ${className ?? ""}`}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`inline-flex items-center gap-1 group ${className ?? ""}`}
      title="Clique para editar"
    >
      <span>{fmt(value, unit)}</span>
      {saved ? (
        <CheckCircle2 className="size-3 text-[#22c55e]" />
      ) : (
        <Pencil className="size-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
      )}
    </button>
  );
}

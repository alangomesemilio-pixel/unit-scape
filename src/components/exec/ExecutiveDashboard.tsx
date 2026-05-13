import { useEffect, useMemo, useState } from "react";
import {
  defaultExecState,
  EXEC_STORAGE_KEY,
  formatValue,
  isoWeekKey,
  statusOf,
  trendOf,
  variation,
  type ExecKpi,
  type ExecState,
  type PdcaItem,
  type WeekSnapshot,
} from "@/lib/executive-data";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Trophy,
  Target,
  Calendar,
  Download,
  RotateCcw,
  Pencil,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { fetchSheetKpis } from "@/lib/sheets.functions";
import { FileSpreadsheet, RefreshCw } from "lucide-react";

const SHEET_ID_KEY = "grax.exec.sheetId";

function load(): ExecState {
  try {
    const raw = localStorage.getItem(EXEC_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultExecState;
}

export function ExecutiveDashboard() {
  const [state, setState] = useState<ExecState>(() => load());
  const [editingKpi, setEditingKpi] = useState<{ coreId: string | "general"; id: string } | null>(
    null
  );
  const [pdcaOpen, setPdcaOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetId, setSheetId] = useState<string>(() => {
    try {
      return localStorage.getItem(SHEET_ID_KEY) || "";
    } catch {
      return "";
    }
  });
  const [syncing, setSyncing] = useState(false);
  const callFetchSheet = useServerFn(fetchSheetKpis);

  const syncFromSheet = async () => {
    const id = sheetId.trim();
    if (!id) {
      toast.error("Informe o ID da planilha");
      return;
    }
    try {
      localStorage.setItem(SHEET_ID_KEY, id);
    } catch {}
    setSyncing(true);
    try {
      const res = await callFetchSheet({ data: { spreadsheetId: id } });
      const map = new Map(res.rows.map((r) => [r.kpi_id, r]));
      let matched = 0;
      setState((s) => {
        const apply = (kpi: ExecKpi): ExecKpi => {
          const r = map.get(kpi.id);
          if (!r) return kpi;
          matched++;
          return {
            ...kpi,
            current: r.current ?? kpi.current,
            previous: r.previous ?? kpi.previous,
            target: r.target ?? kpi.target,
            owner: r.owner ?? kpi.owner,
          };
        };
        return {
          ...s,
          general: s.general.map(apply),
          cores: s.cores.map((c) => ({ ...c, kpis: c.kpis.map(apply) })),
        };
      });
      toast.success(`Sincronizado: ${matched} KPIs atualizados de ${res.count} linhas`);
      setSheetOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erro: ${msg}`);
    } finally {
      setSyncing(false);
    }
  };

  const allKpiIds = useMemo(() => {
    const ids: { id: string; label: string; nucleo: string; unidade: string; responsavel: string }[] =
      [];
    state.general.forEach((k) =>
      ids.push({ id: k.id, label: k.label, nucleo: "geral", unidade: k.unit, responsavel: k.owner || "" })
    );
    state.cores.forEach((c) =>
      c.kpis.forEach((k) =>
        ids.push({ id: k.id, label: k.label, nucleo: c.id, unidade: k.unit, responsavel: k.owner || "" })
      )
    );
    return ids;
  }, [state]);

  const downloadTemplateCsv = () => {
    const header = ["kpi_id", "label", "nucleo", "atual", "anterior", "meta", "unidade", "responsavel"];
    const rows = [header.join(",")];
    [...state.general.map((k) => ({ k, nucleo: "geral" })), ...state.cores.flatMap((c) => c.kpis.map((k) => ({ k, nucleo: c.id })))].forEach(
      ({ k, nucleo }) => {
        rows.push(
          [k.id, `"${k.label}"`, nucleo, k.current, k.previous, k.target, k.unit, k.owner || ""].join(",")
        );
      }
    );
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "grax-kpis-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };


  useEffect(() => {
    localStorage.setItem(
      EXEC_STORAGE_KEY,
      JSON.stringify({ ...state, lastUpdated: new Date().toISOString() })
    );
  }, [state]);

  const alerts = useMemo(() => {
    const all: { core: string; kpi: ExecKpi }[] = [];
    state.cores.forEach((c) =>
      c.kpis.forEach((kpi) => {
        if (statusOf(kpi) !== "healthy") all.push({ core: c.title, kpi });
      })
    );
    return all.sort((a, b) => (statusOf(a.kpi) === "critical" ? -1 : 1));
  }, [state]);

  const updateKpi = (coreId: string | "general", id: string, patch: Partial<ExecKpi>) => {
    setState((s) => {
      if (coreId === "general") {
        return { ...s, general: s.general.map((k) => (k.id === id ? { ...k, ...patch } : k)) };
      }
      return {
        ...s,
        cores: s.cores.map((c) =>
          c.id === coreId
            ? { ...c, kpis: c.kpis.map((k) => (k.id === id ? { ...k, ...patch } : k)) }
            : c
        ),
      };
    });
  };

  const editingKpiData = useMemo(() => {
    if (!editingKpi) return null;
    if (editingKpi.coreId === "general") {
      return state.general.find((k) => k.id === editingKpi.id) ?? null;
    }
    const core = state.cores.find((c) => c.id === editingKpi.coreId);
    return core?.kpis.find((k) => k.id === editingKpi.id) ?? null;
  }, [editingKpi, state]);

  const reset = () => {
    if (confirm("Restaurar todos os dados padrão?")) {
      setState(defaultExecState);
      toast.success("Dashboard restaurado");
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grax-executivo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updatePdca = (id: string, patch: Partial<PdcaItem>) => {
    setState((s) => ({
      ...s,
      pdca: s.pdca.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  };
  const addPdca = () => {
    setState((s) => ({
      ...s,
      pdca: [
        ...s.pdca,
        {
          id: `p${Date.now()}`,
          problem: "Novo problema",
          owner: "",
          plan: "",
          due: "",
          status: "todo",
        },
      ],
    }));
  };
  const removePdca = (id: string) =>
    setState((s) => ({ ...s, pdca: s.pdca.filter((p) => p.id !== id) }));

  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/90 backdrop-blur px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Cockpit Executivo — GRAx Group</h1>
          <p className="text-xs text-muted-foreground">
            Painel de governança · Semana atual vs anterior · Realizado vs Meta
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="default" onClick={() => setSheetOpen(true)} disabled={syncing}>
            <RefreshCw className={`size-4 mr-1 ${syncing ? "animate-spin" : ""}`} /> Sincronizar Sheets
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPdcaOpen(true)}>
            <Target className="size-4 mr-1" /> PDCA ({state.pdca.length})
          </Button>

          <Button size="sm" variant="ghost" onClick={exportJson}>
            <Download className="size-4 mr-1" /> Exportar
          </Button>
          <Button size="sm" variant="ghost" onClick={reset}>
            <RotateCcw className="size-4 mr-1" /> Reset
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Visão executiva geral */}
        <section>
          <SectionTitle
            title="Visão Executiva Geral"
            subtitle="Indicadores macro da companhia"
            icon={<Trophy className="size-4" />}
          />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {state.general.map((kpi) => (
              <KpiTile
                key={kpi.id}
                kpi={kpi}
                onEdit={() => setEditingKpi({ coreId: "general", id: kpi.id })}
              />
            ))}
          </div>
        </section>

        {/* Receita por marca / canal */}
        <section className="grid lg:grid-cols-2 gap-4">
          <RevenueBlock title="Receita por marca" rows={state.brandRevenue} />
          <RevenueBlock title="Receita por canal" rows={state.channelRevenue} />
        </section>

        {/* Alertas + Reunião */}
        <section className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
            <SectionTitle
              title="Sistema de alertas"
              subtitle={`${alerts.length} indicadores fora da meta`}
              icon={<AlertTriangle className="size-4" />}
              compact
            />
            {alerts.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                <CheckCircle2 className="size-4 text-emerald-400" />
                Tudo saudável esta semana.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {alerts.map(({ core, kpi }) => (
                  <AlertRow key={kpi.id} core={core} kpi={kpi} />
                ))}
              </div>
            )}
          </div>
          <MeetingPanel
            meeting={state.meeting}
            onChange={(m) => setState((s) => ({ ...s, meeting: m }))}
          />
        </section>

        {/* Núcleos */}
        {state.cores.map((core) => (
          <section
            key={core.id}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <div
              className="px-5 py-3 border-b border-border flex items-center justify-between"
              style={{
                background: `linear-gradient(90deg, color-mix(in oklab, ${core.accent} 22%, transparent), transparent)`,
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: core.accent }}
                />
                <div>
                  <h3 className="font-semibold text-sm">{core.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    Responsável: <span className="text-foreground">{core.owner}</span> ·{" "}
                    {core.description}
                  </p>
                </div>
              </div>
              <CoreSummary kpis={core.kpis} />
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {core.kpis.map((kpi) => (
                <KpiTile
                  key={kpi.id}
                  kpi={kpi}
                  onEdit={() => setEditingKpi({ coreId: core.id, id: kpi.id })}
                />
              ))}
            </div>
          </section>
        ))}

        <div className="text-xs text-muted-foreground text-center pt-4 pb-8">
          Atualizado em {state.lastUpdated ? new Date(state.lastUpdated).toLocaleString("pt-BR") : "-"} · Dados salvos localmente neste navegador.
        </div>
      </div>

      {/* KPI editor */}
      <Sheet
        open={!!editingKpi}
        onOpenChange={(o) => {
          if (!o) setEditingKpi(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-md">
          {editingKpiData && (
            <>
              <SheetHeader>
                <SheetTitle>{editingKpiData.label}</SheetTitle>
                <SheetDescription>
                  Atualize valores realizados, meta e responsável.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 mt-6 px-4">
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Real">
                    <Input
                      type="number"
                      value={editingKpiData.current}
                      onChange={(e) =>
                        updateKpi(editingKpi!.coreId, editingKpi!.id, {
                          current: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Anterior">
                    <Input
                      type="number"
                      value={editingKpiData.previous}
                      onChange={(e) =>
                        updateKpi(editingKpi!.coreId, editingKpi!.id, {
                          previous: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Meta">
                    <Input
                      type="number"
                      value={editingKpiData.target}
                      onChange={(e) =>
                        updateKpi(editingKpi!.coreId, editingKpi!.id, {
                          target: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                </div>
                <Field label="Responsável">
                  <Input
                    value={editingKpiData.owner ?? ""}
                    onChange={(e) =>
                      updateKpi(editingKpi!.coreId, editingKpi!.id, { owner: e.target.value })
                    }
                  />
                </Field>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    id="hib"
                    type="checkbox"
                    checked={editingKpiData.higherIsBetter !== false}
                    onChange={(e) =>
                      updateKpi(editingKpi!.coreId, editingKpi!.id, {
                        higherIsBetter: e.target.checked,
                      })
                    }
                  />
                  <label htmlFor="hib">Maior é melhor</label>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheets sync panel */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5 text-emerald-400" /> Sincronizar com Google Sheets
            </SheetTitle>
            <SheetDescription>
              Mantenha uma planilha simples e o cockpit é preenchido automaticamente.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 mt-4 px-4 text-sm">
            <div className="rounded-lg border border-border p-3 bg-secondary/40 space-y-2">
              <div className="font-semibold">Passo 1 — Crie a planilha</div>
              <p className="text-xs text-muted-foreground">
                Crie um Google Sheets com uma aba chamada <code className="px-1 rounded bg-background">KPIs</code> e a primeira linha exatamente assim:
              </p>
              <code className="block text-[11px] bg-background p-2 rounded border border-border overflow-x-auto">
                kpi_id | label | nucleo | atual | anterior | meta | unidade | responsavel
              </code>
              <p className="text-xs text-muted-foreground">
                Compartilhe a planilha com a conta Google que você conectou (permissão de leitura basta).
              </p>
              <Button size="sm" variant="secondary" onClick={downloadTemplateCsv}>
                <Download className="size-4 mr-1" /> Baixar template CSV (todos os {allKpiIds.length} KPIs)
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Abra esse CSV no Google Sheets (Arquivo → Importar) para começar com todos os KPIs já listados.
              </p>
            </div>

            <div className="rounded-lg border border-border p-3 bg-secondary/40 space-y-2">
              <div className="font-semibold">Passo 2 — Cole o ID da planilha</div>
              <p className="text-xs text-muted-foreground">
                Da URL: <code className="px-1 rounded bg-background">docs.google.com/spreadsheets/d/<b>ID_AQUI</b>/edit</code>
              </p>
              <Input
                placeholder="ex: 1AbC...xyZ"
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
              />
            </div>

            <div className="rounded-lg border border-border p-3 bg-secondary/40 space-y-2">
              <div className="font-semibold">Passo 3 — Sincronizar</div>
              <p className="text-xs text-muted-foreground">
                Cada linha atualiza o KPI cujo <code>kpi_id</code> bater. Linhas sem correspondência são ignoradas.
              </p>
              <Button onClick={syncFromSheet} disabled={syncing || !sheetId.trim()}>
                <RefreshCw className={`size-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizando..." : "Sincronizar agora"}
              </Button>
            </div>

            <details className="rounded-lg border border-border p-3 bg-secondary/40">
              <summary className="cursor-pointer text-xs font-semibold">
                Ver lista de kpi_id válidos ({allKpiIds.length})
              </summary>
              <div className="mt-2 max-h-64 overflow-y-auto text-[11px] font-mono space-y-0.5">
                {allKpiIds.map((k) => (
                  <div key={k.id} className="flex justify-between gap-2 border-b border-border/40 py-0.5">
                    <span className="text-emerald-300">{k.id}</span>
                    <span className="text-muted-foreground truncate">{k.label} · {k.nucleo}</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </SheetContent>
      </Sheet>

      {/* PDCA panel */}
      <Sheet open={pdcaOpen} onOpenChange={setPdcaOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Sistema PDCA — Planos de ação</SheetTitle>
            <SheetDescription>
              Cada KPI crítico vira problema, plano, responsável e prazo.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 mt-4 px-4">
            {state.pdca.map((p) => (
              <div key={p.id} className="rounded-lg border border-border p-3 bg-secondary/40 space-y-2">
                <div className="flex items-start gap-2">
                  <Textarea
                    rows={2}
                    value={p.problem}
                    onChange={(e) => updatePdca(p.id, { problem: e.target.value })}
                    className="text-sm"
                  />
                  <Button size="icon" variant="ghost" onClick={() => removePdca(p.id)}>
                    <X className="size-4" />
                  </Button>
                </div>
                <Textarea
                  rows={2}
                  value={p.plan}
                  placeholder="Plano de ação"
                  onChange={(e) => updatePdca(p.id, { plan: e.target.value })}
                  className="text-sm"
                />
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Responsável"
                    value={p.owner}
                    onChange={(e) => updatePdca(p.id, { owner: e.target.value })}
                  />
                  <Input
                    placeholder="Prazo"
                    value={p.due}
                    onChange={(e) => updatePdca(p.id, { due: e.target.value })}
                  />
                  <select
                    className="rounded-md border border-border bg-background px-2 text-sm"
                    value={p.status}
                    onChange={(e) =>
                      updatePdca(p.id, { status: e.target.value as PdcaItem["status"] })
                    }
                  >
                    <option value="todo">A fazer</option>
                    <option value="doing">Em andamento</option>
                    <option value="done">Concluído</option>
                  </select>
                </div>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={addPdca}>
              + Novo plano
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
  icon,
  compact,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "mb-3" : "mb-3"}>
      <div className="flex items-center gap-2">
        {icon && <span className="text-primary">{icon}</span>}
        <h2 className="text-sm font-semibold uppercase tracking-wider">{title}</h2>
      </div>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

function statusColor(s: ReturnType<typeof statusOf>) {
  if (s === "healthy") return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
  if (s === "warning") return "text-amber-400 border-amber-500/30 bg-amber-500/10";
  return "text-rose-400 border-rose-500/30 bg-rose-500/10";
}

function KpiTile({ kpi, onEdit }: { kpi: ExecKpi; onEdit: () => void }) {
  const s = statusOf(kpi);
  const t = trendOf(kpi);
  const v = variation(kpi.current, kpi.previous);
  const goodTrend = (kpi.higherIsBetter !== false) === (v >= 0);
  const TrendIcon = t === "up" ? ArrowUpRight : t === "down" ? ArrowDownRight : Minus;
  const targetPct = kpi.target ? (kpi.current / kpi.target) * 100 : 0;

  return (
    <button
      onClick={onEdit}
      className={`group relative text-left rounded-xl border p-3 hover:border-primary/40 transition-colors ${statusColor(
        s
      )}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-medium text-foreground/80 leading-tight">
          {kpi.label}
        </div>
        <Pencil className="size-3 opacity-0 group-hover:opacity-60" />
      </div>
      <div className="mt-1.5 text-lg font-bold text-foreground">
        {formatValue(kpi.current, kpi.unit)}
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px]">
        <span
          className={`inline-flex items-center gap-0.5 ${
            goodTrend ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          <TrendIcon className="size-3" />
          {v >= 0 ? "+" : ""}
          {v.toFixed(1)}%
        </span>
        <span className="text-muted-foreground">
          meta {formatValue(kpi.target, kpi.unit)}
        </span>
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-foreground/10 overflow-hidden">
        <div
          className="h-full"
          style={{
            width: `${Math.min(100, Math.max(0, targetPct))}%`,
            background:
              s === "healthy"
                ? "rgb(52 211 153)"
                : s === "warning"
                  ? "rgb(251 191 36)"
                  : "rgb(251 113 133)",
          }}
        />
      </div>
      {kpi.owner && (
        <div className="mt-1 text-[10px] text-muted-foreground">@{kpi.owner}</div>
      )}
    </button>
  );
}

function CoreSummary({ kpis }: { kpis: ExecKpi[] }) {
  const counts = kpis.reduce(
    (acc, k) => {
      acc[statusOf(k)]++;
      return acc;
    },
    { healthy: 0, warning: 0, critical: 0 } as Record<string, number>
  );
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <Pill color="emerald" label={counts.healthy} />
      <Pill color="amber" label={counts.warning} />
      <Pill color="rose" label={counts.critical} />
    </div>
  );
}
function Pill({ color, label }: { color: "emerald" | "amber" | "rose"; label: number }) {
  const map = {
    emerald: "bg-emerald-500/15 text-emerald-300",
    amber: "bg-amber-500/15 text-amber-300",
    rose: "bg-rose-500/15 text-rose-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full font-semibold ${map[color]}`}>{label}</span>
  );
}

function AlertRow({ core, kpi }: { core: string; kpi: ExecKpi }) {
  const s = statusOf(kpi);
  const v = variation(kpi.current, kpi.previous);
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${statusColor(s)}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {s === "critical" ? (
          <Flame className="size-4 shrink-0" />
        ) : (
          <AlertTriangle className="size-4 shrink-0" />
        )}
        <div className="min-w-0">
          <div className="text-xs font-medium truncate text-foreground">
            {kpi.label}{" "}
            <span className="text-muted-foreground font-normal">· {core}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Real {formatValue(kpi.current, kpi.unit)} · Meta{" "}
            {formatValue(kpi.target, kpi.unit)} · {v >= 0 ? "+" : ""}
            {v.toFixed(1)}% vs anterior
          </div>
        </div>
      </div>
      {kpi.owner && (
        <span className="text-[11px] text-muted-foreground shrink-0">@{kpi.owner}</span>
      )}
    </div>
  );
}

function RevenueBlock({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; current: number; previous: number; target: number }[];
}) {
  const total = rows.reduce((a, r) => a + r.current, 0);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <SectionTitle title={title} subtitle={`Total: ${formatValue(total, "R$")}`} compact />
      <div className="space-y-2">
        {rows.map((r) => {
          const v = variation(r.current, r.previous);
          const pct = r.target ? (r.current / r.target) * 100 : 0;
          return (
            <div key={r.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground">
                  {formatValue(r.current, "R$")}{" "}
                  <span className={v >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    ({v >= 0 ? "+" : ""}
                    {v.toFixed(1)}%)
                  </span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MeetingPanel({
  meeting,
  onChange,
}: {
  meeting: ExecState["meeting"];
  onChange: (m: ExecState["meeting"]) => void;
}) {
  const groups: { key: keyof ExecState["meeting"]; title: string; icon: React.ReactNode }[] = [
    { key: "victories", title: "Vitórias", icon: <Trophy className="size-3.5 text-emerald-400" /> },
    { key: "bottlenecks", title: "Gargalos", icon: <Flame className="size-3.5 text-rose-400" /> },
    { key: "priorities", title: "Prioridades", icon: <Target className="size-3.5 text-amber-400" /> },
    { key: "decisions", title: "Decisões", icon: <Calendar className="size-3.5 text-primary" /> },
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <SectionTitle title="Reunião executiva" subtitle="Guia da semana" compact />
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.key}>
            <div className="flex items-center gap-1.5 text-xs font-semibold mb-1">
              {g.icon} {g.title}
            </div>
            <Textarea
              rows={2}
              value={meeting[g.key].join("\n")}
              onChange={(e) =>
                onChange({
                  ...meeting,
                  [g.key]: e.target.value.split("\n").filter(Boolean),
                })
              }
              className="text-xs"
              placeholder="Uma linha por item"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

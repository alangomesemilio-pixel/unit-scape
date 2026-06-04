import { useEffect, useMemo, useState } from "react";
import {
  MEETINGS,
  emptyWeekState,
  getWeekKey,
  shiftWeek,
  getMeetingKpis,
  groupKpisByCore,
  formatWeekRange,
  weekRange,
  type ActionItem,
  type PdcaItem,
  type MeetingDef,
  type MeetingState,
  type WeekState,
  type Weekday,
} from "@/lib/meetings-data";
import {
  defaultExecState,
  EXEC_STORAGE_KEY,
  formatValue,
  statusOf,
  type ExecKpi,
  type ExecState,
} from "@/lib/executive-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Users,
  Target,
  CheckCircle2,
  Clock,
  Calendar as CalendarIcon,
  Download,
  Archive,
  ShieldCheck,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { saveWeekSnapshot } from "@/lib/snapshots.functions";
import { logWeekClose, loadAuditLog, type AuditEntry, type AuditChange } from "@/lib/audit.functions";

const ACTOR_KEY = "grax.meetings.actor";

const STORAGE_PREFIX = "grax-meetings-";

function loadWeek(weekKey: string): WeekState {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + weekKey);
    if (!raw) return emptyWeekState();
    return { ...emptyWeekState(), ...(JSON.parse(raw) as WeekState) };
  } catch {
    return emptyWeekState();
  }
}

function saveWeek(weekKey: string, state: WeekState) {
  localStorage.setItem(STORAGE_PREFIX + weekKey, JSON.stringify(state));
}

function loadExec(): ExecState {
  try {
    const raw = localStorage.getItem(EXEC_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultExecState;
}

function saveExec(s: ExecState) {
  localStorage.setItem(EXEC_STORAGE_KEY, JSON.stringify(s));
}

export function MeetingsDashboard() {
  const [weekKey, setWeekKey] = useState<string>(() => getWeekKey());
  const [active, setActive] = useState<Weekday>("mon");
  const [state, setState] = useState<WeekState>(() => loadWeek(getWeekKey()));
  const [exec, setExec] = useState<ExecState>(defaultExecState);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [actor, setActor] = useState<string>("");
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);

  const callSaveWeek = useServerFn(saveWeekSnapshot);
  const callLogClose = useServerFn(logWeekClose);
  const callLoadAudit = useServerFn(loadAuditLog);

  useEffect(() => {
    setExec(loadExec());
    try {
      setActor(localStorage.getItem(ACTOR_KEY) || "");
    } catch {}
    callLoadAudit()
      .then((res) => setAuditLog(res.entries))
      .catch((e) => console.warn("[audit] load failed", e));
  }, []);

  useEffect(() => {
    setState(loadWeek(weekKey));
  }, [weekKey]);

  useEffect(() => {
    const t = setTimeout(() => saveWeek(weekKey, state), 300);
    return () => clearTimeout(t);
  }, [state, weekKey]);

  const meeting = useMemo(() => MEETINGS.find((m) => m.id === active)!, [active]);
  const ms = state[active];

  // KPIs derived from cockpit (single source of truth)
  const meetingKpis = useMemo(() => getMeetingKpis(active, exec), [active, exec]);
  const groupedKpis = useMemo(() => groupKpisByCore(active, exec), [active, exec]);

  const update = (patch: Partial<MeetingState>) =>
    setState((s) => ({
      ...s,
      [active]: { ...s[active], ...patch, lastUpdated: new Date().toISOString() },
    }));

  const setKpiReal = (id: string, v: string) => {
    update({
      kpis: {
        ...ms.kpis,
        [id]: { value: v, target: ms.kpis[id]?.target ?? "" },
      },
    });
  };

  const toggleAttendance = (p: string) => {
    update({ attendance: { ...ms.attendance, [p]: !ms.attendance[p] } });
  };

  const addAction = () => {
    const a: ActionItem = {
      id: `a-${Date.now()}`,
      text: "",
      owner: meeting.participants[0] ?? "",
      due: "",
      status: "todo",
    };
    update({ actions: [...ms.actions, a] });
  };

  const updateAction = (id: string, patch: Partial<ActionItem>) => {
    update({ actions: ms.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  };

  const removeAction = (id: string) => {
    update({ actions: ms.actions.filter((a) => a.id !== id) });
  };

  const completion = useMemo(() => {
    if (meetingKpis.length === 0) return 0;
    const filled = meetingKpis.filter((k) => ms.kpis[k.id]?.value).length;
    return Math.round((filled / meetingKpis.length) * 100);
  }, [meetingKpis, ms]);

  const weekStats = useMemo(() => {
    let totalActions = 0;
    let doneActions = 0;
    let kpisFilled = 0;
    let kpisTotal = 0;
    let meetingsDone = 0;
    for (const m of MEETINGS) {
      const s = state[m.id];
      const ks = getMeetingKpis(m.id, exec);
      totalActions += s.actions.length;
      doneActions += s.actions.filter((a) => a.status === "done").length;
      kpisTotal += ks.length;
      kpisFilled += ks.filter((k) => s.kpis[k.id]?.value).length;
      if (s.done) meetingsDone++;
    }
    return { totalActions, doneActions, kpisFilled, kpisTotal, meetingsDone };
  }, [state, exec]);

  const exportWeek = () => {
    const blob = new Blob([JSON.stringify({ weekKey, state }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grax-${weekKey}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ===== Fechar semana global =====
  const closeWeek = async () => {
    // Ask / confirm the actor (responsável pelo fechamento)
    const suggested = actor || "";
    const who = window.prompt(
      "Quem está fechando a semana? (nome ficará registrado no log de auditoria)",
      suggested
    );
    if (!who || !who.trim()) {
      toast.error("Fechamento cancelado: responsável é obrigatório.");
      return;
    }
    const actorName = who.trim().slice(0, 80);
    setActor(actorName);
    try {
      localStorage.setItem(ACTOR_KEY, actorName);
    } catch {}

    // Collect every "real" entered across all meetings of this week
    const values: Record<string, number> = {};
    for (const m of MEETINGS) {
      const s = state[m.id];
      for (const [id, entry] of Object.entries(s.kpis)) {
        const n = parseFloat(String(entry.value).replace(",", "."));
        if (!Number.isFinite(n)) continue;
        values[id] = n; // last write wins (e.g. Friday > Monday)
      }
    }

    if (Object.keys(values).length === 0) {
      if (
        !confirm(
          `Nenhum KPI preenchido nesta semana. Fechar mesmo assim e arquivar valores atuais do Cockpit?`
        )
      ) {
        return;
      }
      // fallback: archive cockpit current
      exec.general.forEach((k) => (values[k.id] = k.current));
      exec.cores.forEach((c) => c.kpis.forEach((k) => (values[k.id] = k.current)));
    } else if (
      !confirm(
        `Fechar semana ${weekKey} como ${actorName}?\n\n• ${
          Object.keys(values).length
        } KPIs serão arquivados no banco\n• Valores 'atual' do Cockpit viram 'anterior'\n• Log de auditoria será gerado\n• Próxima semana abre com metas herdadas e reais zerados`
      )
    ) {
      return;
    }

    // Build full KPI map (id -> ExecKpi) to compute audit diffs with labels
    const kpiMap = new Map<string, ExecKpi>();
    exec.general.forEach((k) => kpiMap.set(k.id, k));
    exec.cores.forEach((c) => c.kpis.forEach((k) => kpiMap.set(k.id, k)));

    const changes: AuditChange[] = Object.entries(values).map(([id, next]) => {
      const k = kpiMap.get(id);
      return {
        kpi_id: id,
        label: k?.label ?? id,
        previous: k ? k.current : null,
        next,
      };
    });

    try {
      await callSaveWeek({ data: { week: weekKey, values } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erro ao salvar no banco: ${msg}`);
      return;
    }

    // Audit log entry — non-blocking but reported
    try {
      await callLogClose({ data: { week: weekKey, actor: actorName, changes } });
      // Refresh log
      const res = await callLoadAudit();
      setAuditLog(res.entries);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.warning(`Snapshot salvo, mas log de auditoria falhou: ${msg}`);
    }

    // Propagate into Cockpit: current → previous, then current = real (if provided)
    const next: ExecState = {
      ...exec,
      general: exec.general.map((k) => ({
        ...k,
        previous: k.current,
        current: values[k.id] ?? k.current,
      })),
      cores: exec.cores.map((c) => ({
        ...c,
        kpis: c.kpis.map((k) => ({
          ...k,
          previous: k.current,
          current: values[k.id] ?? k.current,
        })),
      })),
      lastUpdated: new Date().toISOString(),
    };
    setExec(next);
    saveExec(next);

    // Mark all 5 days as done for the closed week
    const closed: WeekState = { ...state };
    (Object.keys(closed) as Weekday[]).forEach((k) => {
      closed[k] = { ...closed[k], done: true };
    });
    saveWeek(weekKey, closed);

    // Advance to next week (fresh empty state — metas live in Cockpit, reais zerados)
    const nextWeek = shiftWeek(weekKey, 1);
    setWeekKey(nextWeek);
    toast.success(`Semana ${weekKey} arquivada por ${actorName}. Avançando para ${nextWeek}.`);
  };

  // Selected calendar date (any day in the current week)
  const selectedDate = useMemo(() => weekRange(weekKey).start, [weekKey]);

  return (
    <div className="h-full w-full flex flex-col bg-background overflow-hidden">
      {/* Week strip */}
      <div className="px-6 py-4 border-b border-border bg-card/30 backdrop-blur">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setWeekKey((w) => shiftWeek(w, -1))}
              aria-label="Semana anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>

            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/70 transition">
                  <CalendarIcon className="size-4 text-primary" />
                  <span className="font-mono text-sm font-semibold">{weekKey}</span>
                  <span className="text-xs text-muted-foreground">· {formatWeekRange(weekKey)}</span>
                  {weekKey === getWeekKey() && (
                    <Badge variant="outline" className="text-[10px] ml-1">
                      ATUAL
                    </Badge>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => {
                    if (!d) return;
                    setWeekKey(getWeekKey(d));
                    setCalendarOpen(false);
                  }}
                  weekStartsOn={1}
                  showOutsideDays
                />
                <div className="border-t border-border p-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground px-1">
                    Clique em qualquer dia para abrir aquela semana ISO
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setWeekKey(getWeekKey());
                      setCalendarOpen(false);
                    }}
                  >
                    Hoje
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              size="icon"
              variant="outline"
              onClick={() => setWeekKey((w) => shiftWeek(w, 1))}
              aria-label="Próxima semana"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <Stat icon={CheckCircle2} label="Reuniões fechadas" value={`${weekStats.meetingsDone}/5`} />
            <Stat
              icon={Target}
              label="KPIs preenchidos"
              value={`${weekStats.kpisFilled}/${weekStats.kpisTotal}`}
            />
            <Stat
              icon={Clock}
              label="Ações concluídas"
              value={`${weekStats.doneActions}/${weekStats.totalActions}`}
            />
            <Button size="sm" variant="outline" onClick={exportWeek}>
              <Download className="size-3.5 mr-1" /> Exportar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAuditOpen(true)}>
              <ShieldCheck className="size-3.5 mr-1" /> Auditoria ({auditLog.length})
            </Button>
            <Button size="sm" onClick={closeWeek} className="bg-primary text-primary-foreground">
              <Archive className="size-3.5 mr-1" /> Fechar semana
            </Button>
          </div>
        </div>

        {/* Day tabs */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          {MEETINGS.map((m) => {
            const isActive = m.id === active;
            const s = state[m.id];
            const ks = getMeetingKpis(m.id, exec);
            const kpisFilled = ks.filter((k) => s.kpis[k.id]?.value).length;
            const pct = ks.length ? Math.round((kpisFilled / ks.length) * 100) : 0;
            return (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                className={`group min-w-[180px] text-left px-4 py-2.5 rounded-lg border transition-all ${
                  isActive
                    ? "bg-card border-primary shadow-lg shadow-primary/10"
                    : "bg-card/40 border-border hover:bg-card/70 hover:border-border/80"
                }`}
                style={isActive ? { borderColor: m.accent } : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {m.day}
                    </div>
                    <div className="text-sm font-semibold leading-tight">{m.title}</div>
                  </div>
                  {s.done && <CheckCircle2 className="size-4 text-primary" />}
                </div>
                <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${pct}%`, background: m.accent }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Meeting body */}
      <div className="flex-1 overflow-auto">
        <MeetingPanel
          meeting={meeting}
          ms={ms}
          weekKey={weekKey}
          completion={completion}
          groupedKpis={groupedKpis}
          onToggleAttend={toggleAttendance}
          onSetKpiReal={setKpiReal}
          onUpdate={update}
          onAddAction={addAction}
          onUpdateAction={updateAction}
          onRemoveAction={removeAction}
          onMarkDone={() => {
            update({ done: !ms.done });
            toast.success(ms.done ? "Reunião reaberta" : "Reunião fechada");
          }}
        />
      </div>


      <AuditPanel
        open={auditOpen}
        onOpenChange={setAuditOpen}
        entries={auditLog}
        currentActor={actor}
        onActorChange={(name) => {
          setActor(name);
          try {
            localStorage.setItem(ACTOR_KEY, name);
          } catch {}
        }}
      />
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof CheckCircle2; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-mono font-semibold text-foreground">{value}</span>
    </div>
  );
}

interface PanelProps {
  meeting: MeetingDef;
  ms: MeetingState;
  weekKey: string;
  completion: number;
  groupedKpis: Record<string, ExecKpi[]>;
  onToggleAttend: (p: string) => void;
  onSetKpiReal: (id: string, v: string) => void;
  onUpdate: (patch: Partial<MeetingState>) => void;
  onAddAction: () => void;
  onUpdateAction: (id: string, patch: Partial<ActionItem>) => void;
  onRemoveAction: (id: string) => void;
  onMarkDone: () => void;
}

function MeetingPanel({
  meeting,
  ms,
  weekKey,
  completion,
  groupedKpis,
  onToggleAttend,
  onSetKpiReal,
  onUpdate,
  onAddAction,
  onUpdateAction,
  onRemoveAction,
  onMarkDone,
}: PanelProps) {

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div
        className="rounded-xl border border-border p-5 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, color-mix(in oklch, ${meeting.accent} 12%, var(--card)), var(--card))`,
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge style={{ background: meeting.accent, color: "var(--background)" }}>
                {meeting.day}
              </Badge>
              <Badge variant="outline">{meeting.duration}</Badge>
            </div>
            <h2 className="text-2xl font-bold">{meeting.title}</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{meeting.objective}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <div className="text-3xl font-bold font-mono" style={{ color: meeting.accent }}>
                {completion}%
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                KPIs preenchidos
              </div>
            </div>
            <Button
              size="sm"
              variant={ms.done ? "outline" : "default"}
              onClick={onMarkDone}
              className={!ms.done ? "bg-primary text-primary-foreground" : ""}
            >
              <CheckCircle2 className="size-4 mr-1" />
              {ms.done ? "Reabrir reunião" : "Fechar reunião"}
            </Button>
          </div>
        </div>
      </div>

      {/* Painel novo de KPIs específicos da reunião → grava em kpis_executivos */}
      <MeetingKpiPanel day={meeting.id} weekKey={weekKey} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <Section title="Participantes" icon={Users}>
          <div className="space-y-2">
            {meeting.participants.map((p) => (
              <label
                key={p}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary/50 cursor-pointer"
              >
                <Checkbox
                  checked={!!ms.attendance[p]}
                  onCheckedChange={() => onToggleAttend(p)}
                />
                <span className={`text-sm ${ms.attendance[p] ? "text-foreground" : "text-muted-foreground"}`}>
                  {p}
                </span>
              </label>
            ))}
          </div>
        </Section>

        <Section title="Resultado esperado" icon={Target}>
          <ul className="space-y-2">
            {meeting.expectedResult.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm">
                <span
                  className="mt-1.5 size-1.5 rounded-full shrink-0"
                  style={{ background: meeting.accent }}
                />
                <span className="text-muted-foreground">{r}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Notas da reunião">
          <Textarea
            value={ms.notes}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            placeholder="Decisões, contexto, observações..."
            className="min-h-[180px] resize-none"
          />
        </Section>
      </div>

      {/* PDCA only on Friday */}
      {meeting.id === "fri" && (
        <Section title="PDCA da semana" icon={Target}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(
              [
                ["plan", "P — Plan", "Planejamento da semana seguinte"],
                ["doText", "D — Do", "Execução da semana atual"],
                ["check", "C — Check", "Análise dos resultados"],
                ["act", "A — Act", "Plano corretivo"],
              ] as const
            ).map(([k, label, ph]) => (
              <div key={k}>
                <div className="text-xs font-semibold mb-1.5 text-foreground">{label}</div>
                <Textarea
                  value={ms.pdca?.[k] ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      pdca: {
                        plan: ms.pdca?.plan ?? "",
                        doText: ms.pdca?.doText ?? "",
                        check: ms.pdca?.check ?? "",
                        act: ms.pdca?.act ?? "",
                        [k]: e.target.value,
                      },
                    })
                  }
                  placeholder={ph}
                  className="min-h-[90px] resize-none"
                />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* PDCAs pontuais — sexta-feira (um por KPI/tema discutido) */}
      {meeting.id === "fri" && (
        <PdcaItemsSection
          items={ms.pdcaItems ?? []}
          allKpis={Object.values(groupedKpis).flat()}
          onChange={(pdcaItems) => onUpdate({ pdcaItems })}
        />
      )}

      {/* Responsabilidades — quem traz qual KPI */}
      <ResponsibilitiesSection
        meeting={meeting}
        groupedKpis={groupedKpis}
        ms={ms}
        accent={meeting.accent}
      />

      {/* KPIs derived from Cockpit */}
      <Section title="KPIs do Cockpit · preencha o real desta semana" icon={Target}>
        <div className="space-y-5">
          {Object.entries(groupedKpis).map(([group, list]) => (
            <div key={group}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {group}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {list.map((k) => {
                  const entry = ms.kpis[k.id] ?? { value: "", target: "" };
                  const filled = !!entry.value;
                  const status = statusOf(k);
                  const statusColor =
                    status === "healthy"
                      ? "var(--chart-2, #22c55e)"
                      : status === "warning"
                        ? "var(--chart-4, #f59e0b)"
                        : "var(--destructive)";
                  return (
                    <div
                      key={k.id}
                      className={`rounded-lg border p-3 transition-colors ${
                        filled ? "border-primary/40 bg-primary/5" : "border-border bg-card/40"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <div className="text-xs font-medium truncate" title={k.label}>
                          {k.label}
                        </div>
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ background: statusColor }}
                          title={status}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5 font-mono">
                        <span>
                          Meta: <span className="text-foreground">{formatValue(k.target, k.unit)}</span>
                        </span>
                        <span>
                          Atual: <span className="text-foreground">{formatValue(k.current, k.unit)}</span>
                        </span>
                      </div>
                      <Input
                        value={entry.value}
                        onChange={(e) => onSetKpiReal(k.id, e.target.value)}
                        placeholder={`Real semana (${k.unit || "#"})`}
                        className="h-8 text-sm font-mono"
                        inputMode="decimal"
                      />
                      {k.owner && (
                        <div className="text-[10px] text-muted-foreground mt-1">↳ {k.owner}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {Object.keys(groupedKpis).length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6">
              Nenhum KPI vinculado a esta reunião.
            </div>
          )}
        </div>
      </Section>

      {/* Action plan */}
      <Section
        title="Planos de ação"
        icon={CheckCircle2}
        action={
          <Button size="sm" variant="outline" onClick={onAddAction}>
            <Plus className="size-4 mr-1" /> Ação
          </Button>
        }
      >
        {ms.actions.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            Nenhuma ação registrada. Adicione decisões e responsáveis.
          </div>
        ) : (
          <div className="space-y-2">
            {ms.actions.map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg border border-border bg-card/40"
              >
                <Input
                  value={a.text}
                  onChange={(e) => onUpdateAction(a.id, { text: e.target.value })}
                  placeholder="O que fazer..."
                  className="col-span-5 h-9"
                />
                <select
                  value={a.owner}
                  onChange={(e) => onUpdateAction(a.id, { owner: e.target.value })}
                  className="col-span-2 h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {meeting.participants.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <Input
                  value={a.due}
                  onChange={(e) => onUpdateAction(a.id, { due: e.target.value })}
                  placeholder="Prazo"
                  className="col-span-2 h-9"
                />
                <select
                  value={a.status}
                  onChange={(e) =>
                    onUpdateAction(a.id, { status: e.target.value as ActionItem["status"] })
                  }
                  className="col-span-2 h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="todo">A fazer</option>
                  <option value="doing">Em andamento</option>
                  <option value="done">Concluída</option>
                </select>
                <Button
                  size="icon"
                  variant="ghost"
                  className="col-span-1 h-9"
                  onClick={() => onRemoveAction(a.id)}
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function ResponsibilitiesSection({
  meeting,
  groupedKpis,
  ms,
  accent,
}: {
  meeting: MeetingDef;
  groupedKpis: Record<string, ExecKpi[]>;
  ms: MeetingState;
  accent: string;
}) {
  // Flatten KPIs of this meeting
  const allKpis = Object.values(groupedKpis).flat();

  // Match by owner (case-insensitive, first-name match against participants)
  const norm = (s: string) => s.trim().toLowerCase().split(/\s+/)[0];
  const buckets = new Map<string, ExecKpi[]>();
  meeting.participants.forEach((p) => buckets.set(p, []));
  const orphans: ExecKpi[] = [];

  for (const k of allKpis) {
    if (!k.owner) {
      orphans.push(k);
      continue;
    }
    const ownerKey = norm(k.owner);
    const match = meeting.participants.find((p) => norm(p) === ownerKey);
    if (match) buckets.get(match)!.push(k);
    else orphans.push(k);
  }

  if (allKpis.length === 0) return null;

  return (
    <Section title="Responsabilidades · o que cada participante traz" icon={Users}>
      <p className="text-xs text-muted-foreground mb-4 -mt-2">
        Cada KPI tem um responsável. Antes da reunião, cada pessoa precisa trazer o real da semana
        dos KPIs abaixo para que o Cockpit fique 100% preenchido.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {meeting.participants.map((p) => {
          const list = buckets.get(p) ?? [];
          const filled = list.filter((k) => ms.kpis[k.id]?.value).length;
          const pct = list.length ? Math.round((filled / list.length) * 100) : 0;
          const allDone = list.length > 0 && filled === list.length;
          return (
            <div
              key={p}
              className={`rounded-lg border p-3 transition-colors ${
                allDone ? "border-primary/40 bg-primary/5" : "border-border bg-card/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="size-7 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{ background: accent, color: "var(--background)" }}
                  >
                    {p.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{p}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {list.length === 0
                        ? "Sem KPI atribuído"
                        : `${filled}/${list.length} KPIs · ${pct}%`}
                    </div>
                  </div>
                </div>
                {allDone && <CheckCircle2 className="size-4 text-primary shrink-0" />}
              </div>
              {list.length > 0 ? (
                <ul className="space-y-1">
                  {list.map((k) => {
                    const done = !!ms.kpis[k.id]?.value;
                    return (
                      <li
                        key={k.id}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`size-1.5 rounded-full shrink-0 ${
                              done ? "bg-primary" : "bg-muted-foreground/40"
                            }`}
                          />
                          <span className={`truncate ${done ? "" : "text-muted-foreground"}`}>
                            {k.label}
                          </span>
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                          {k.unit || "#"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="text-[11px] text-muted-foreground italic">
                  Participa da reunião sem KPI direto sob sua responsabilidade.
                </div>
              )}
            </div>
          );
        })}

        {orphans.length > 0 && (
          <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3 md:col-span-2 lg:col-span-3">
            <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2">
              ⚠ KPIs sem responsável vinculado a esta reunião ({orphans.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {orphans.map((k) => (
                <Badge key={k.id} variant="outline" className="text-[10px]">
                  {k.label}
                  {k.owner ? ` · ${k.owner}` : ""}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

function Section({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon?: typeof CheckCircle2;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="size-4 text-muted-foreground" />}
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function AuditPanel({
  open,
  onOpenChange,
  entries,
  currentActor,
  onActorChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entries: AuditEntry[];
  currentActor: string;
  onActorChange: (name: string) => void;
}) {
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const exportLog = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grax-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Log de auditoria — Fechamentos de semana
          </SheetTitle>
          <SheetDescription>
            Cada fechamento registra responsável, data/hora e KPIs alterados (valor anterior → novo).
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-2">
          <Label htmlFor="audit-actor" className="text-xs">
            Seu nome (padrão para fechamentos)
          </Label>
          <Input
            id="audit-actor"
            value={currentActor}
            onChange={(e) => onActorChange(e.target.value.slice(0, 80))}
            placeholder="Ex.: Alan"
            className="h-9"
          />
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {entries.length} {entries.length === 1 ? "fechamento" : "fechamentos"} registrados
          </div>
          <Button size="sm" variant="outline" onClick={exportLog} disabled={entries.length === 0}>
            <Download className="size-3.5 mr-1" /> Exportar JSON
          </Button>
        </div>

        <div className="mt-3 space-y-3">
          {entries.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-10 border border-dashed border-border rounded-lg">
              Nenhum fechamento registrado ainda.
            </div>
          )}
          {entries.map((entry) => (
            <details
              key={entry.id}
              className="group rounded-lg border border-border bg-card/40 overflow-hidden"
            >
              <summary className="flex items-center justify-between gap-3 p-3 cursor-pointer hover:bg-secondary/30 list-none">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
                    <Archive className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{entry.week}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {entry.kpi_count} KPIs
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {entry.actor} · {fmtDate(entry.closed_at)}
                    </div>
                  </div>
                </div>
                <History className="size-4 text-muted-foreground group-open:rotate-180 transition" />
              </summary>
              <div className="border-t border-border p-3 bg-background/40">
                {entry.changes.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Sem mudanças detalhadas.</div>
                ) : (
                  <div className="space-y-1">
                    {entry.changes.map((c) => {
                      const delta =
                        c.previous != null ? c.next - c.previous : null;
                      const deltaPct =
                        c.previous != null && c.previous !== 0
                          ? ((c.next - c.previous) / Math.abs(c.previous)) * 100
                          : null;
                      const up = delta != null && delta > 0;
                      const down = delta != null && delta < 0;
                      return (
                        <div
                          key={c.kpi_id}
                          className="grid grid-cols-12 gap-2 items-center text-xs py-1 border-b border-border/50 last:border-0"
                        >
                          <div className="col-span-5 font-medium truncate" title={c.label}>
                            {c.label}
                          </div>
                          <div className="col-span-3 font-mono text-muted-foreground text-right">
                            {c.previous != null ? c.previous.toLocaleString("pt-BR") : "—"}
                          </div>
                          <div className="col-span-1 text-center text-muted-foreground">→</div>
                          <div className="col-span-3 font-mono font-semibold text-right">
                            {c.next.toLocaleString("pt-BR")}
                            {deltaPct != null && (
                              <span
                                className={`ml-1 text-[10px] ${
                                  up ? "text-emerald-500" : down ? "text-red-500" : "text-muted-foreground"
                                }`}
                              >
                                {up ? "▲" : down ? "▼" : "•"}
                                {Math.abs(deltaPct).toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PdcaItemsSection({
  items,
  allKpis,
  onChange,
}: {
  items: PdcaItem[];
  allKpis: ExecKpi[];
  onChange: (items: PdcaItem[]) => void;
}) {
  const add = () => {
    const novo: PdcaItem = {
      id: crypto.randomUUID(),
      topic: "",
      kpiId: undefined,
      owner: "",
      plan: "",
      doText: "",
      check: "",
      act: "",
      createdAt: new Date().toISOString(),
    };
    onChange([...(items ?? []), novo]);
  };
  const update = (id: string, patch: Partial<PdcaItem>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));

  return (
    <Section
      title={`PDCAs da reunião · ${items.length}`}
      icon={Target}
      action={
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="size-3.5 mr-1" /> Novo PDCA
        </Button>
      }
    >
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-4 text-center">
          Nenhum PDCA registrado. Conforme discutir um KPI ou tema, clique em
          <span className="font-medium text-foreground"> Novo PDCA </span>
          para registrar Plan · Do · Check · Act.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-card/40 p-3 space-y-3"
            >
              <div className="flex items-start gap-2">
                <div className="text-xs font-semibold text-muted-foreground mt-2 w-6">
                  #{idx + 1}
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input
                    value={item.topic}
                    onChange={(e) => update(item.id, { topic: e.target.value })}
                    placeholder="Tema / KPI discutido"
                    className="h-8 text-sm"
                  />
                  <select
                    value={item.kpiId ?? ""}
                    onChange={(e) =>
                      update(item.id, { kpiId: e.target.value || undefined })
                    }
                    className="h-8 text-sm rounded-md border border-input bg-background px-2"
                  >
                    <option value="">Vincular KPI (opcional)</option>
                    {allKpis.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={item.owner}
                    onChange={(e) => update(item.id, { owner: e.target.value })}
                    placeholder="Responsável"
                    className="h-8 text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(item.id)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-8">
                {(
                  [
                    ["plan", "P — Plan", "O que vamos planejar/corrigir"],
                    ["doText", "D — Do", "Como vamos executar"],
                    ["check", "C — Check", "Como vamos medir"],
                    ["act", "A — Act", "Ação corretiva / próximo passo"],
                  ] as const
                ).map(([k, label, ph]) => (
                  <div key={k}>
                    <div className="text-[11px] font-semibold mb-1 text-foreground">
                      {label}
                    </div>
                    <Textarea
                      value={item[k]}
                      onChange={(e) => update(item.id, { [k]: e.target.value })}
                      placeholder={ph}
                      className="min-h-[60px] resize-none text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

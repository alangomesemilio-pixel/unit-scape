import { useEffect, useMemo, useState } from "react";
import {
  MEETINGS,
  emptyWeekState,
  getWeekKey,
  shiftWeek,
  type ActionItem,
  type MeetingDef,
  type MeetingState,
  type WeekState,
  type Weekday,
} from "@/lib/meetings-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Users,
  Target,
  CheckCircle2,
  Clock,
  Calendar,
  Download,
} from "lucide-react";
import { toast } from "sonner";

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

export function MeetingsDashboard() {
  const [weekKey, setWeekKey] = useState<string>(() => getWeekKey());
  const [active, setActive] = useState<Weekday>("mon");
  const [state, setState] = useState<WeekState>(() => loadWeek(getWeekKey()));

  useEffect(() => {
    setState(loadWeek(weekKey));
  }, [weekKey]);

  useEffect(() => {
    const t = setTimeout(() => saveWeek(weekKey, state), 300);
    return () => clearTimeout(t);
  }, [state, weekKey]);

  const meeting = useMemo(() => MEETINGS.find((m) => m.id === active)!, [active]);
  const ms = state[active];

  const update = (patch: Partial<MeetingState>) =>
    setState((s) => ({ ...s, [active]: { ...s[active], ...patch, lastUpdated: new Date().toISOString() } }));

  const setKpi = (id: string, field: "value" | "target", v: string) => {
    update({
      kpis: {
        ...ms.kpis,
        [id]: { value: ms.kpis[id]?.value ?? "", target: ms.kpis[id]?.target ?? "", [field]: v },
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
    const filled = meeting.kpis.filter((k) => ms.kpis[k.id]?.value).length;
    return Math.round((filled / meeting.kpis.length) * 100);
  }, [meeting, ms]);

  const weekStats = useMemo(() => {
    let totalActions = 0;
    let doneActions = 0;
    let kpisFilled = 0;
    let kpisTotal = 0;
    let meetingsDone = 0;
    for (const m of MEETINGS) {
      const s = state[m.id];
      totalActions += s.actions.length;
      doneActions += s.actions.filter((a) => a.status === "done").length;
      kpisTotal += m.kpis.length;
      kpisFilled += m.kpis.filter((k) => s.kpis[k.id]?.value).length;
      if (s.done) meetingsDone++;
    }
    return { totalActions, doneActions, kpisFilled, kpisTotal, meetingsDone };
  }, [state]);

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

  const groupedKpis = useMemo(() => {
    const g: Record<string, typeof meeting.kpis> = {};
    for (const k of meeting.kpis) (g[k.group] ||= []).push(k);
    return g;
  }, [meeting]);

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
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary">
              <Calendar className="size-4 text-primary" />
              <span className="font-mono text-sm font-semibold">{weekKey}</span>
              {weekKey === getWeekKey() && (
                <Badge variant="outline" className="text-[10px] ml-1">
                  ATUAL
                </Badge>
              )}
            </div>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setWeekKey((w) => shiftWeek(w, 1))}
              aria-label="Próxima semana"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setWeekKey(getWeekKey())}>
              Hoje
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
          </div>
        </div>

        {/* Day tabs */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          {MEETINGS.map((m) => {
            const isActive = m.id === active;
            const s = state[m.id];
            const kpisFilled = m.kpis.filter((k) => s.kpis[k.id]?.value).length;
            const pct = Math.round((kpisFilled / m.kpis.length) * 100);
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
          completion={completion}
          groupedKpis={groupedKpis}
          onToggleAttend={toggleAttendance}
          onSetKpi={setKpi}
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
  completion: number;
  groupedKpis: Record<string, MeetingDef["kpis"]>;
  onToggleAttend: (p: string) => void;
  onSetKpi: (id: string, field: "value" | "target", v: string) => void;
  onUpdate: (patch: Partial<MeetingState>) => void;
  onAddAction: () => void;
  onUpdateAction: (id: string, patch: Partial<ActionItem>) => void;
  onRemoveAction: (id: string) => void;
  onMarkDone: () => void;
}

function MeetingPanel({
  meeting,
  ms,
  completion,
  groupedKpis,
  onToggleAttend,
  onSetKpi,
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Participants */}
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

        {/* Expected results */}
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

        {/* Notes */}
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

      {/* KPIs */}
      <Section title="KPIs analisados" icon={Target}>
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
                  return (
                    <div
                      key={k.id}
                      className={`rounded-lg border p-3 transition-colors ${
                        filled ? "border-primary/40 bg-primary/5" : "border-border bg-card/40"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium truncate">{k.label}</div>
                        {k.unit && (
                          <span className="text-[10px] text-muted-foreground font-mono">{k.unit}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Input
                          value={entry.value}
                          onChange={(e) => onSetKpi(k.id, "value", e.target.value)}
                          placeholder="Real"
                          className="h-8 text-sm font-mono"
                        />
                        <Input
                          value={entry.target}
                          onChange={(e) => onSetKpi(k.id, "target", e.target.value)}
                          placeholder="Meta"
                          className="h-8 text-sm font-mono text-muted-foreground"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
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
                  className="col-span-12 md:col-span-5 h-9"
                />
                <Select
                  value={a.owner}
                  onValueChange={(v) => onUpdateAction(a.id, { owner: v })}
                >
                  <SelectTrigger className="col-span-6 md:col-span-3 h-9">
                    <SelectValue placeholder="Responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {meeting.participants.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={a.due}
                  onChange={(e) => onUpdateAction(a.id, { due: e.target.value })}
                  className="col-span-6 md:col-span-2 h-9"
                />
                <Select
                  value={a.status}
                  onValueChange={(v) => onUpdateAction(a.id, { status: v as ActionItem["status"] })}
                >
                  <SelectTrigger className="col-span-10 md:col-span-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">A fazer</SelectItem>
                    <SelectItem value="doing">Fazendo</SelectItem>
                    <SelectItem value="done">Concluído</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="ghost"
                  className="col-span-2 md:col-span-1 h-9"
                  onClick={() => onRemoveAction(a.id)}
                  aria-label="Remover ação"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon?: typeof Users;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="size-4 text-primary" />}
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

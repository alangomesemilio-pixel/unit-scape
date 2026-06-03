import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flag, Plus, Trash2, Loader2, Save, Trophy } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getSomaKv, setSomaKv } from "@/lib/soma-store.functions";
import { toast } from "sonner";

type KrSource =
  | "manual"
  | "receitaSemestre"
  | "ebitdaSemestre"
  | "pedidosSemestre"
  | "ticketMedio"
  | "ltvCac"
  | "recompra"
  | "roas"
  | "b2bRev"
  | "investSemestre";

interface KeyResult {
  id: string;
  title: string;
  owner: string;
  unit: "R$" | "%" | "x" | "#";
  baseline: number;
  target: number;
  source: KrSource;
  current?: number;
}

interface OkrObjective {
  id: string;
  title: string;
  why: string;
  owner: string;
  accent: string;
  krs: KeyResult[];
}

const ACCENTS = ["#f28572", "#d6b4ff", "#b78cff", "#ff9c8f", "#f5c97a", "#9ad7c5"];

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmt = (n: number, unit: KeyResult["unit"]) =>
  unit === "R$"
    ? brl(n)
    : unit === "%"
    ? `${n.toFixed(1)}%`
    : unit === "x"
    ? `${n.toFixed(2)}x`
    : Math.round(n).toLocaleString("pt-BR");

export function SomaOkrPanel() {
  const getKv = useServerFn(getSomaKv);
  const setKv = useServerFn(setSomaKv);
  const [okrs, setOkrs] = useState<OkrObjective[]>([]);
  const [fullState, setFullState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getKv({ data: { key: "forecast.state" } })
      .then((r) => {
        if (!alive) return;
        const s = (r.value as any) ?? {};
        setFullState(s);
        setOkrs(Array.isArray(s.okrs) ? s.okrs : []);
        setSavedAt(r.updatedAt ?? null);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [getKv]);

  const save = async () => {
    setSaving(true);
    try {
      const nextState = { ...(fullState ?? {}), okrs };
      await setKv({ data: { key: "forecast.state", value: nextState } });
      setFullState(nextState);
      setSavedAt(new Date().toISOString());
      toast.success("OKRs Soma salvos");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const setObjective = (id: string, patch: Partial<OkrObjective>) =>
    setOkrs((arr) => arr.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const removeObjective = (id: string) =>
    setOkrs((arr) => arr.filter((o) => o.id !== id));

  const addObjective = () =>
    setOkrs((arr) => [
      ...arr,
      {
        id: `okr-${Date.now()}`,
        title: "Novo objetivo",
        why: "Por que importa…",
        owner: "Responsável",
        accent: ACCENTS[arr.length % ACCENTS.length],
        krs: [],
      },
    ]);

  const setKr = (objId: string, krId: string, patch: Partial<KeyResult>) =>
    setOkrs((arr) =>
      arr.map((o) =>
        o.id !== objId ? o : { ...o, krs: o.krs.map((k) => (k.id === krId ? { ...k, ...patch } : k)) },
      ),
    );

  const removeKr = (objId: string, krId: string) =>
    setOkrs((arr) =>
      arr.map((o) =>
        o.id !== objId ? o : { ...o, krs: o.krs.filter((k) => k.id !== krId) },
      ),
    );

  const addKr = (objId: string) =>
    setOkrs((arr) =>
      arr.map((o) =>
        o.id !== objId
          ? o
          : {
              ...o,
              krs: [
                ...o.krs,
                {
                  id: `kr-${Date.now()}`,
                  title: "Novo Key Result",
                  owner: "Dono",
                  unit: "R$",
                  baseline: 0,
                  target: 0,
                  source: "manual",
                  current: 0,
                },
              ],
            },
      ),
    );

  const progressFor = (o: OkrObjective) => {
    if (o.krs.length === 0) return 0;
    const sum = o.krs.reduce((acc, kr) => {
      const denom = kr.target - kr.baseline;
      const cur = kr.current ?? kr.baseline;
      const p = denom > 0 ? Math.max(0, Math.min(100, ((cur - kr.baseline) / denom) * 100)) : 0;
      return acc + p;
    }, 0);
    return sum / o.krs.length;
  };
  const overall = okrs.length === 0 ? 0 : okrs.reduce((s, o) => s + progressFor(o), 0) / okrs.length;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <Trophy className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">OKRs Estratégicos · Soma</h2>
            <p className="text-xs text-muted-foreground">
              Objetivos do semestre · Jun → Dez · {overall.toFixed(0)}% de atingimento médio
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="text-xs text-muted-foreground">
              Salvo · {new Date(savedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={addObjective} disabled={loading}>
            <Plus className="size-3.5 mr-1" /> Objetivo
          </Button>
          <Button size="sm" onClick={save} disabled={saving || loading}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="h-2 rounded-full overflow-hidden bg-primary/10">
        <div
          className="h-full transition-all"
          style={{ width: `${Math.min(100, overall)}%`, background: "linear-gradient(90deg, #f28572, #f5c97a)" }}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin mr-2" /> Carregando OKRs Soma…
        </div>
      ) : okrs.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Nenhum OKR ainda. Clique em "+ Objetivo" para criar o primeiro.
        </div>
      ) : (
        <div className="space-y-4">
          {okrs.map((obj) => {
            const objProg = progressFor(obj);
            return (
              <div
                key={obj.id}
                className="rounded-xl border p-4"
                style={{
                  borderColor: `${obj.accent}40`,
                  background: `linear-gradient(135deg, ${obj.accent}08, transparent)`,
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className="size-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${obj.accent}25`, color: obj.accent }}
                    >
                      <Flag className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <input
                        value={obj.title}
                        onChange={(e) => setObjective(obj.id, { title: e.target.value })}
                        className="bg-transparent font-medium text-sm w-full focus:outline-none border-b border-transparent focus:border-primary/30"
                      />
                      <input
                        value={obj.why}
                        onChange={(e) => setObjective(obj.id, { why: e.target.value })}
                        className="bg-transparent text-xs text-muted-foreground italic w-full mt-0.5 focus:outline-none"
                      />
                      <input
                        value={obj.owner}
                        onChange={(e) => setObjective(obj.id, { owner: e.target.value })}
                        className="bg-transparent text-[10px] uppercase tracking-wider mt-1 focus:outline-none"
                        style={{ color: obj.accent }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-2xl font-light tabular-nums" style={{ color: obj.accent }}>
                        {objProg.toFixed(0)}%
                      </div>
                      <div className="text-[10px] text-muted-foreground">{obj.krs.length} KRs</div>
                    </div>
                    <button
                      onClick={() => removeObjective(obj.id)}
                      className="text-muted-foreground hover:text-destructive p-1"
                      title="Remover objetivo"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                        <th className="py-1.5 px-2 text-left min-w-[180px]">Key Result</th>
                        <th className="py-1.5 px-2 text-left">Dono</th>
                        <th className="py-1.5 px-2 text-right">Baseline</th>
                        <th className="py-1.5 px-2 text-right">Meta</th>
                        <th className="py-1.5 px-2 text-right">Atual</th>
                        <th className="py-1.5 px-2 text-right w-[140px]">Atingimento</th>
                        <th className="py-1.5 px-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {obj.krs.map((kr) => {
                        const denom = kr.target - kr.baseline;
                        const cur = kr.current ?? kr.baseline;
                        const prog =
                          denom > 0
                            ? Math.max(0, Math.min(100, ((cur - kr.baseline) / denom) * 100))
                            : 0;
                        const progColor =
                          prog >= 90 ? "#9ad7c5" : prog >= 60 ? "#f5c97a" : "#f28572";
                        return (
                          <tr key={kr.id} className="border-b border-border/60 hover:bg-secondary/30">
                            <td className="py-2 px-2">
                              <input
                                value={kr.title}
                                onChange={(e) => setKr(obj.id, kr.id, { title: e.target.value })}
                                className="bg-transparent w-full focus:outline-none"
                              />
                              <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                                <select
                                  value={kr.unit}
                                  onChange={(e) =>
                                    setKr(obj.id, kr.id, { unit: e.target.value as KeyResult["unit"] })
                                  }
                                  className="bg-transparent border-b border-border focus:outline-none text-[10px]"
                                >
                                  <option value="R$">R$</option>
                                  <option value="%">%</option>
                                  <option value="x">x</option>
                                  <option value="#">#</option>
                                </select>
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <input
                                value={kr.owner}
                                onChange={(e) => setKr(obj.id, kr.id, { owner: e.target.value })}
                                className="bg-transparent w-20 focus:outline-none text-[11px]"
                              />
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input
                                type="number"
                                value={kr.baseline}
                                onChange={(e) =>
                                  setKr(obj.id, kr.id, { baseline: parseFloat(e.target.value) || 0 })
                                }
                                className="bg-transparent w-20 text-right focus:outline-none tabular-nums"
                              />
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input
                                type="number"
                                value={kr.target}
                                onChange={(e) =>
                                  setKr(obj.id, kr.id, { target: parseFloat(e.target.value) || 0 })
                                }
                                className="bg-transparent w-24 text-right focus:outline-none tabular-nums font-medium"
                                style={{ color: obj.accent }}
                              />
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              <input
                                type="number"
                                value={kr.current ?? 0}
                                onChange={(e) =>
                                  setKr(obj.id, kr.id, { current: parseFloat(e.target.value) || 0 })
                                }
                                className="bg-transparent w-20 text-right focus:outline-none tabular-nums"
                              />
                              <div className="text-[10px] text-muted-foreground">{fmt(cur, kr.unit)}</div>
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-2 justify-end">
                                <div className="h-1.5 w-16 rounded-full overflow-hidden bg-primary/10">
                                  <div
                                    className="h-full"
                                    style={{ width: `${prog}%`, background: progColor }}
                                  />
                                </div>
                                <span className="tabular-nums w-10 text-right" style={{ color: progColor }}>
                                  {prog.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-1 text-right">
                              <button
                                onClick={() => removeKr(obj.id, kr.id)}
                                className="text-muted-foreground opacity-50 hover:opacity-100"
                                title="Remover KR"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      <tr>
                        <td colSpan={7} className="pt-2">
                          <button
                            onClick={() => addKr(obj.id)}
                            className="text-[11px] flex items-center gap-1"
                            style={{ color: obj.accent }}
                          >
                            <Plus className="size-3" /> adicionar Key Result
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-[11px] text-muted-foreground italic border-t border-border pt-3">
        <Badge variant="outline" className="text-[10px] mr-1">Dica</Badge>
        Editado aqui · sincroniza com o cenário compartilhado <code>forecast.state</code>. Lembre-se de clicar em <strong>Salvar</strong> ao terminar.
      </div>
    </Card>
  );
}

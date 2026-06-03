import { useEffect, useState } from "react";
import data from "@/data/soma-forecast-novo.json";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Users, Target, Loader2, Save, Lightbulb } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getSomaKv, setSomaKv } from "@/lib/soma-store.functions";
import { toast } from "sonner";
import { SomaOkrPanel } from "./SomaOkrPanel";

type PDCA = {
  plan?: string;
  do?: string;
  check?: string;
  act?: string;
  recomendacao?: string;
};

type PDCAMap = Record<string, PDCA>;

const FIELDS: { key: keyof PDCA; label: string; placeholder: string; color: string }[] = [
  { key: "plan", label: "P · Plan", placeholder: "O que será planejado?", color: "text-sky-400" },
  { key: "do", label: "D · Do", placeholder: "O que está sendo executado?", color: "text-emerald-400" },
  { key: "check", label: "C · Check", placeholder: "Resultado vs. meta — o que os dados mostram?", color: "text-amber-400" },
  { key: "act", label: "A · Act", placeholder: "Ajustes / próximas ações concretas", color: "text-rose-400" },
];

export function NovoOkrs() {
  const { responsaveis } = data as any;
  const getKv = useServerFn(getSomaKv);
  const setKv = useServerFn(setSomaKv);

  const [pdca, setPdca] = useState<PDCAMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getKv({ data: { key: "novo.pdca" } })
      .then((r) => {
        if (!alive) return;
        if (r.value && typeof r.value === "object") setPdca(r.value as PDCAMap);
        setSavedAt(r.updatedAt ?? null);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [getKv]);

  const update = (id: string, key: keyof PDCA, value: string) => {
    setPdca((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await setKv({ data: { key: "novo.pdca", value: pdca } });
      setSavedAt(new Date().toISOString());
      toast.success("PDCA salvo no banco compartilhado");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="size-5 text-primary" />
              <h1 className="text-2xl font-bold">OKRs &amp; PDCA</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Acompanhamento por responsável · ciclo Plan → Do → Check → Act + recomendação executiva
            </p>
          </div>
          <div className="flex items-center gap-2">
            {savedAt && (
              <span className="text-xs text-muted-foreground">
                Salvo · {new Date(savedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </span>
            )}
            <Button onClick={save} disabled={saving || loading} size="sm">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar PDCA
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="size-5 animate-spin mr-2" /> Carregando…
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {responsaveis.map((r: any) => {
              const ciclo = pdca[r.id] ?? {};
              return (
                <Card key={r.id} className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold">{r.nome}</div>
                      <div className="text-xs text-muted-foreground">{r.cargo}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      <Target className="size-3 mr-1" /> OKR
                    </Badge>
                  </div>

                  <div className="bg-secondary/50 rounded-md p-3 border-l-2 border-primary">
                    <div className="text-[10px] uppercase text-muted-foreground mb-1">Objetivo</div>
                    <p className="text-sm italic">{r.okr}</p>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground mb-1">KPIs</div>
                    <div className="flex flex-wrap gap-1">
                      {r.kpis.map((k: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px] font-normal">
                          {k}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {FIELDS.map((f) => (
                      <div key={f.key} className="space-y-1">
                        <label className={`text-[10px] uppercase font-semibold ${f.color}`}>
                          {f.label}
                        </label>
                        <Textarea
                          value={ciclo[f.key] ?? ""}
                          onChange={(e) => update(r.id, f.key, e.target.value)}
                          placeholder={f.placeholder}
                          className="text-xs min-h-[72px] resize-none"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1 border-t border-border pt-3">
                    <label className="text-[10px] uppercase font-semibold text-primary flex items-center gap-1">
                      <Lightbulb className="size-3" /> Recomendação executiva
                    </label>
                    <Textarea
                      value={ciclo.recomendacao ?? ""}
                      onChange={(e) => update(r.id, "recomendacao", e.target.value)}
                      placeholder="Próximo passo recomendado para o ciclo seguinte (priorize 1 ação concreta)"
                      className="text-sm min-h-[64px] resize-none border-primary/30 focus-visible:ring-primary"
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

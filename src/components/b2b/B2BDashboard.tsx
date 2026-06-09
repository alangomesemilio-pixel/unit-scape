import { useEffect, useMemo, useState } from "react";
import {
  Briefcase, Plus, Trash2, Users, TrendingUp, Target, Percent,
  DollarSign, Building2, X, Pencil, Calendar, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// ============ TYPES ============
type Stage = "prospeccao" | "contato" | "proposta" | "negociacao" | "fechado" | "perdido";
type Responsavel = "Otávio" | "Igor";
type SubCanal = "distribuidores" | "cadeias_pdv" | "key_accounts";

type Deal = {
  id: string;
  empresa: string;
  responsavel: Responsavel;
  valor_estimado: number;
  stage: Stage;
  proxima_acao: string | null;
  proxima_acao_data: string | null;
  notas: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
};

type Distributor = {
  id: string;
  nome: string;
  sub_canal: SubCanal;
  ultimo_pedido_data: string | null;
  ticket_medio: number;
  receita_total: number;
  status: string;
  notas: string | null;
};

type Order = {
  id: string;
  pedido_data: string;
  cliente: string;
  valor: number;
  status: string;
  responsavel: Responsavel;
  canal: SubCanal;
  distribuidor_id: string | null;
};

const STAGES: { id: Stage; label: string; color: string }[] = [
  { id: "prospeccao", label: "Prospecção", color: "#94a3b8" },
  { id: "contato", label: "Contato feito", color: "#3b82f6" },
  { id: "proposta", label: "Proposta enviada", color: "#a855f7" },
  { id: "negociacao", label: "Negociação", color: "#eab308" },
  { id: "fechado", label: "Fechado", color: "#10b981" },
  { id: "perdido", label: "Perdido", color: "#ef4444" },
];

const SUB_CANAIS: { id: SubCanal; label: string }[] = [
  { id: "distribuidores", label: "Distribuidores" },
  { id: "cadeias_pdv", label: "Cadeias PDV" },
  { id: "key_accounts", label: "Key Accounts" },
];

const META_RECEITA_MES = 300_000;
const META_TICKET = 3_500;
const META_PIPELINE = 200_000;
const META_DISTRIBUIDORES = 25;
const META_FECHAMENTO = 20;

// ============ HELPERS ============
function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}
function semaforo(val: number, meta: number, reverse = false): string {
  const pct = (val / meta) * 100;
  const ok = reverse ? pct <= 100 : pct >= 100;
  const warn = reverse ? pct <= 120 : pct >= 80;
  if (ok) return "#10b981";
  if (warn) return "#eab308";
  return "#ef4444";
}

// ============ MAIN ============
export function B2BDashboard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [dealModal, setDealModal] = useState<{ open: boolean; deal?: Deal; stage?: Stage }>({ open: false });
  const [distModal, setDistModal] = useState<{ open: boolean; dist?: Distributor }>({ open: false });
  const [orderModal, setOrderModal] = useState<{ open: boolean; order?: Order }>({ open: false });

  async function loadAll() {
    setLoading(true);
    const [d, dist, o] = await Promise.all([
      supabase.from("b2b_pipeline").select("*").order("ordem", { ascending: true }),
      supabase.from("b2b_distributors").select("*").order("receita_total", { ascending: false }),
      supabase.from("b2b_orders").select("*").order("pedido_data", { ascending: false }).limit(500),
    ]);
    if (d.error) toast.error(d.error.message); else setDeals((d.data ?? []) as Deal[]);
    if (dist.error) toast.error(dist.error.message); else setDistributors((dist.data ?? []) as Distributor[]);
    if (o.error) toast.error(o.error.message); else setOrders((o.data ?? []) as Order[]);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  // ============ KPIs ============
  const kpis = useMemo(() => {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const receitaMes = orders
      .filter((o) => o.pedido_data >= inicioMes && o.status !== "cancelado")
      .reduce((s, o) => s + Number(o.valor), 0);
    const validOrders = orders.filter((o) => o.status !== "cancelado");
    const ticketMedio = validOrders.length > 0
      ? validOrders.reduce((s, o) => s + Number(o.valor), 0) / validOrders.length
      : 0;
    const pipelineAtivo = deals
      .filter((d) => d.stage !== "fechado" && d.stage !== "perdido")
      .reduce((s, d) => s + Number(d.valor_estimado), 0);
    const distAtivos = distributors.filter((d) => d.status === "ativo").length;
    const fechados = deals.filter((d) => d.stage === "fechado").length;
    const perdidos = deals.filter((d) => d.stage === "perdido").length;
    const total = fechados + perdidos;
    const taxaFechamento = total > 0 ? (fechados / total) * 100 : 0;
    return { receitaMes, ticketMedio, pipelineAtivo, distAtivos, taxaFechamento };
  }, [deals, distributors, orders]);

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 bg-background">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="size-6" /> Canal B2B
          </h1>
          <p className="text-sm text-muted-foreground">
            Pipeline, distribuidores e performance do canal corporativo da SOMA
          </p>
        </div>
        <button
          onClick={loadAll}
          className="px-3 py-2 rounded-lg bg-secondary text-sm hover:bg-secondary/80"
        >
          {loading ? "Carregando…" : "Recarregar"}
        </button>
      </header>

      {/* ============ KPIs ============ */}
      <section>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="size-4 text-muted-foreground" /> KPIs B2B
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard
            icon={DollarSign}
            label="Receita B2B / mês"
            value={fmtBRL(kpis.receitaMes)}
            sub={`Meta ${fmtBRL(META_RECEITA_MES)}`}
            color={semaforo(kpis.receitaMes, META_RECEITA_MES)}
          />
          <KpiCard
            icon={TrendingUp}
            label="Ticket médio"
            value={fmtBRL(kpis.ticketMedio)}
            sub={`Meta ${fmtBRL(META_TICKET)}`}
            color={semaforo(kpis.ticketMedio, META_TICKET)}
          />
          <KpiCard
            icon={Target}
            label="Pipeline ativo"
            value={fmtBRL(kpis.pipelineAtivo)}
            sub={`Meta ${fmtBRL(META_PIPELINE)}`}
            color={semaforo(kpis.pipelineAtivo, META_PIPELINE)}
          />
          <KpiCard
            icon={Users}
            label="Distribuidores ativos"
            value={String(kpis.distAtivos)}
            sub={`Meta ${META_DISTRIBUIDORES}`}
            color={semaforo(kpis.distAtivos, META_DISTRIBUIDORES)}
          />
          <KpiCard
            icon={Percent}
            label="Taxa de fechamento"
            value={`${kpis.taxaFechamento.toFixed(1)}%`}
            sub={`Meta ${META_FECHAMENTO}%`}
            color={semaforo(kpis.taxaFechamento, META_FECHAMENTO)}
          />
        </div>
      </section>

      {/* ============ PIPELINE KANBAN ============ */}
      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Target className="size-4 text-muted-foreground" /> Pipeline de Vendas
            </h2>
            <p className="text-xs text-muted-foreground">Arraste os cards entre as colunas para mudar o estágio.</p>
          </div>
          <button
            onClick={() => setDealModal({ open: true, stage: "prospeccao" })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs hover:opacity-90"
          >
            <Plus className="size-3.5" /> Novo negócio
          </button>
        </div>
        <KanbanBoard
          deals={deals}
          onReload={loadAll}
          onEdit={(deal) => setDealModal({ open: true, deal })}
        />
      </section>

      {/* ============ DISTRIBUIDORES ============ */}
      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" /> Distribuidores Ativos
          </h2>
          <button
            onClick={() => setDistModal({ open: true })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs hover:opacity-90"
          >
            <Plus className="size-3.5" /> Novo distribuidor
          </button>
        </div>
        <DistributorsTable
          rows={distributors}
          onEdit={(d) => setDistModal({ open: true, dist: d })}
          onReload={loadAll}
        />
      </section>

      {/* ============ HISTÓRICO DE PEDIDOS ============ */}
      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" /> Histórico de Pedidos B2B
          </h2>
          <button
            onClick={() => setOrderModal({ open: true })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs hover:opacity-90"
          >
            <Plus className="size-3.5" /> Novo pedido
          </button>
        </div>
        <OrdersTable
          rows={orders}
          onEdit={(o) => setOrderModal({ open: true, order: o })}
          onReload={loadAll}
        />
      </section>

      {dealModal.open && (
        <DealModal
          initial={dealModal.deal}
          defaultStage={dealModal.stage ?? "prospeccao"}
          onClose={() => setDealModal({ open: false })}
          onSaved={() => { setDealModal({ open: false }); loadAll(); }}
        />
      )}
      {distModal.open && (
        <DistModal
          initial={distModal.dist}
          onClose={() => setDistModal({ open: false })}
          onSaved={() => { setDistModal({ open: false }); loadAll(); }}
        />
      )}
      {orderModal.open && (
        <OrderModal
          initial={orderModal.order}
          distributors={distributors}
          onClose={() => setOrderModal({ open: false })}
          onSaved={() => { setOrderModal({ open: false }); loadAll(); }}
        />
      )}
    </div>
  );
}

// ============ KPI CARD ============
function KpiCard({
  icon: Icon, label, value, sub, color,
}: { icon: any; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <Icon className="size-4 text-muted-foreground" />
        {color && <span className="size-2 rounded-full" style={{ background: color }} />}
      </div>
      <div className="text-2xl font-bold tabular-nums" style={color ? { color } : {}}>{value}</div>
      <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</div>}
    </div>
  );
}

// ============ KANBAN ============
function KanbanBoard({
  deals, onReload, onEdit,
}: { deals: Deal[]; onReload: () => void; onEdit: (d: Deal) => void }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const grouped = useMemo(() => {
    const map: Record<Stage, Deal[]> = {
      prospeccao: [], contato: [], proposta: [], negociacao: [], fechado: [], perdido: [],
    };
    for (const d of deals) map[d.stage]?.push(d);
    return map;
  }, [deals]);

  async function moveTo(id: string, stage: Stage) {
    const { error } = await supabase.from("b2b_pipeline").update({ stage }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`Movido para ${STAGES.find((s) => s.id === stage)?.label}`); onReload(); }
  }

  async function remove(id: string) {
    if (!confirm("Excluir este negócio?")) return;
    const { error } = await supabase.from("b2b_pipeline").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); onReload(); }
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {STAGES.map((stage) => {
        const items = grouped[stage.id];
        const total = items.reduce((s, d) => s + Number(d.valor_estimado), 0);
        return (
          <div
            key={stage.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragId) { moveTo(dragId, stage.id); setDragId(null); } }}
            className="rounded-xl border border-border bg-card/50 p-2 min-h-[200px] flex flex-col"
          >
            <div className="flex items-center justify-between px-2 py-1 mb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: stage.color }} />
                <span className="text-xs font-semibold">{stage.label}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{items.length}</span>
            </div>
            <div className="text-[10px] text-muted-foreground px-2 mb-2 tabular-nums">{fmtBRL(total)}</div>
            <div className="space-y-2 flex-1">
              {items.map((d) => (
                <div
                  key={d.id}
                  draggable
                  onDragStart={() => setDragId(d.id)}
                  onDragEnd={() => setDragId(null)}
                  className={`group rounded-lg border border-border bg-background p-2.5 cursor-grab active:cursor-grabbing hover:border-primary/50 transition ${dragId === d.id ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="text-xs font-semibold truncate flex-1">{d.empresa}</div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => onEdit(d)} className="p-0.5 hover:text-primary"><Pencil className="size-3" /></button>
                      <button onClick={() => remove(d.id)} className="p-0.5 hover:text-red-500"><Trash2 className="size-3" /></button>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{d.responsavel}</div>
                  <div className="text-xs font-bold tabular-nums mt-1" style={{ color: stage.color }}>
                    {fmtBRL(Number(d.valor_estimado))}
                  </div>
                  {d.proxima_acao && (
                    <div className="text-[10px] text-muted-foreground mt-1 truncate" title={d.proxima_acao}>
                      → {d.proxima_acao}
                    </div>
                  )}
                  {d.proxima_acao_data && (
                    <div className="text-[10px] text-amber-500 mt-0.5">📅 {fmtDate(d.proxima_acao_data)}</div>
                  )}
                  <div className="text-[9px] text-muted-foreground/70 mt-1">
                    Criado {fmtDate(d.created_at.slice(0, 10))}
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="text-[10px] text-muted-foreground/50 text-center py-4">vazio</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============ DISTRIBUTORS TABLE ============
function DistributorsTable({
  rows, onEdit, onReload,
}: { rows: Distributor[]; onEdit: (d: Distributor) => void; onReload: () => void }) {
  async function remove(id: string) {
    if (!confirm("Excluir distribuidor?")) return;
    const { error } = await supabase.from("b2b_distributors").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); onReload(); }
  }
  const labelSub = (s: string) => SUB_CANAIS.find((x) => x.id === s)?.label ?? s;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-xs text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Nome</th>
            <th className="text-left px-3 py-2 font-medium">Sub-canal</th>
            <th className="text-left px-3 py-2 font-medium">Último pedido</th>
            <th className="text-right px-3 py-2 font-medium">Ticket médio</th>
            <th className="text-right px-3 py-2 font-medium">Receita total</th>
            <th className="text-left px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={7} className="text-center py-6 text-muted-foreground text-xs">Nenhum distribuidor cadastrado</td></tr>
          )}
          {rows.map((d) => (
            <tr key={d.id} className="border-t border-border hover:bg-secondary/30 transition">
              <td className="px-3 py-2 font-medium">{d.nome}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{labelSub(d.sub_canal)}</td>
              <td className="px-3 py-2 text-xs">{fmtDate(d.ultimo_pedido_data)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(Number(d.ticket_medio))}</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtBRL(Number(d.receita_total))}</td>
              <td className="px-3 py-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  d.status === "ativo" ? "bg-emerald-500/15 text-emerald-500" :
                  d.status === "inativo" ? "bg-red-500/15 text-red-500" :
                  "bg-yellow-500/15 text-yellow-500"
                }`}>
                  {d.status}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <button onClick={() => onEdit(d)} className="p-1 hover:text-primary"><Pencil className="size-3.5" /></button>
                <button onClick={() => remove(d.id)} className="p-1 hover:text-red-500"><Trash2 className="size-3.5" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ ORDERS TABLE ============
function OrdersTable({
  rows, onEdit, onReload,
}: { rows: Order[]; onEdit: (o: Order) => void; onReload: () => void }) {
  async function remove(id: string) {
    if (!confirm("Excluir pedido?")) return;
    const { error } = await supabase.from("b2b_orders").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); onReload(); }
  }
  const labelSub = (s: string) => SUB_CANAIS.find((x) => x.id === s)?.label ?? s;

  return (
    <div className="rounded-xl border border-border overflow-hidden max-h-[500px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-xs text-muted-foreground sticky top-0">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Data</th>
            <th className="text-left px-3 py-2 font-medium">Cliente</th>
            <th className="text-right px-3 py-2 font-medium">Valor</th>
            <th className="text-left px-3 py-2 font-medium">Status</th>
            <th className="text-left px-3 py-2 font-medium">Responsável</th>
            <th className="text-left px-3 py-2 font-medium">Canal</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={7} className="text-center py-6 text-muted-foreground text-xs">Nenhum pedido B2B registrado</td></tr>
          )}
          {rows.map((o) => (
            <tr key={o.id} className="border-t border-border hover:bg-secondary/30 transition">
              <td className="px-3 py-2 text-xs">{fmtDate(o.pedido_data)}</td>
              <td className="px-3 py-2 font-medium">{o.cliente}</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtBRL(Number(o.valor))}</td>
              <td className="px-3 py-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  o.status === "entregue" ? "bg-emerald-500/15 text-emerald-500" :
                  o.status === "cancelado" ? "bg-red-500/15 text-red-500" :
                  o.status === "faturado" ? "bg-blue-500/15 text-blue-500" :
                  "bg-yellow-500/15 text-yellow-500"
                }`}>
                  {o.status}
                </span>
              </td>
              <td className="px-3 py-2 text-xs">{o.responsavel}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{labelSub(o.canal)}</td>
              <td className="px-3 py-2 text-right">
                <button onClick={() => onEdit(o)} className="p-1 hover:text-primary"><Pencil className="size-3.5" /></button>
                <button onClick={() => remove(o.id)} className="p-1 hover:text-red-500"><Trash2 className="size-3.5" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ MODAL SHELL ============
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded"><X className="size-4" /></button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground mb-1 block">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary";

// ============ DEAL MODAL ============
function DealModal({
  initial, defaultStage, onClose, onSaved,
}: { initial?: Deal; defaultStage: Stage; onClose: () => void; onSaved: () => void }) {
  const [empresa, setEmpresa] = useState(initial?.empresa ?? "");
  const [responsavel, setResponsavel] = useState<Responsavel>(initial?.responsavel ?? "Otávio");
  const [valor, setValor] = useState<string>(String(initial?.valor_estimado ?? ""));
  const [stage, setStage] = useState<Stage>(initial?.stage ?? defaultStage);
  const [proxAcao, setProxAcao] = useState(initial?.proxima_acao ?? "");
  const [proxData, setProxData] = useState(initial?.proxima_acao_data ?? "");
  const [notas, setNotas] = useState(initial?.notas ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!empresa.trim()) { toast.error("Informe a empresa"); return; }
    setSaving(true);
    const payload = {
      empresa: empresa.trim(),
      responsavel,
      valor_estimado: Number(valor) || 0,
      stage,
      proxima_acao: proxAcao.trim() || null,
      proxima_acao_data: proxData || null,
      notas: notas.trim() || null,
    };
    const res = initial
      ? await supabase.from("b2b_pipeline").update(payload).eq("id", initial.id)
      : await supabase.from("b2b_pipeline").insert(payload);
    setSaving(false);
    if (res.error) toast.error(res.error.message);
    else { toast.success("Salvo"); onSaved(); }
  }

  return (
    <ModalShell title={initial ? "Editar negócio" : "Novo negócio"} onClose={onClose}>
      <Field label="Empresa"><input className={inputCls} value={empresa} onChange={(e) => setEmpresa(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Responsável">
          <select className={inputCls} value={responsavel} onChange={(e) => setResponsavel(e.target.value as Responsavel)}>
            <option value="Otávio">Otávio</option>
            <option value="Igor">Igor</option>
          </select>
        </Field>
        <Field label="Valor estimado (R$)">
          <input type="number" className={inputCls} value={valor} onChange={(e) => setValor(e.target.value)} />
        </Field>
      </div>
      <Field label="Estágio">
        <select className={inputCls} value={stage} onChange={(e) => setStage(e.target.value as Stage)}>
          {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </Field>
      <Field label="Próxima ação"><input className={inputCls} value={proxAcao} onChange={(e) => setProxAcao(e.target.value)} /></Field>
      <Field label="Data próxima ação"><input type="date" className={inputCls} value={proxData} onChange={(e) => setProxData(e.target.value)} /></Field>
      <Field label="Notas"><textarea className={inputCls} rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} /></Field>
      <button onClick={save} disabled={saving} className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50">
        {saving ? "Salvando…" : "Salvar"}
      </button>
    </ModalShell>
  );
}

// ============ DIST MODAL ============
function DistModal({
  initial, onClose, onSaved,
}: { initial?: Distributor; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [subCanal, setSubCanal] = useState<SubCanal>(initial?.sub_canal ?? "distribuidores");
  const [ultimoPedido, setUltimoPedido] = useState(initial?.ultimo_pedido_data ?? "");
  const [ticket, setTicket] = useState(String(initial?.ticket_medio ?? ""));
  const [receita, setReceita] = useState(String(initial?.receita_total ?? ""));
  const [status, setStatus] = useState(initial?.status ?? "ativo");
  const [notas, setNotas] = useState(initial?.notas ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!nome.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    const payload = {
      nome: nome.trim(),
      sub_canal: subCanal,
      ultimo_pedido_data: ultimoPedido || null,
      ticket_medio: Number(ticket) || 0,
      receita_total: Number(receita) || 0,
      status,
      notas: notas.trim() || null,
    };
    const res = initial
      ? await supabase.from("b2b_distributors").update(payload).eq("id", initial.id)
      : await supabase.from("b2b_distributors").insert(payload);
    setSaving(false);
    if (res.error) toast.error(res.error.message);
    else { toast.success("Salvo"); onSaved(); }
  }

  return (
    <ModalShell title={initial ? "Editar distribuidor" : "Novo distribuidor"} onClose={onClose}>
      <Field label="Nome"><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sub-canal">
          <select className={inputCls} value={subCanal} onChange={(e) => setSubCanal(e.target.value as SubCanal)}>
            {SUB_CANAIS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ativo">ativo</option>
            <option value="prospect">prospect</option>
            <option value="inativo">inativo</option>
          </select>
        </Field>
      </div>
      <Field label="Último pedido"><input type="date" className={inputCls} value={ultimoPedido} onChange={(e) => setUltimoPedido(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ticket médio (R$)"><input type="number" className={inputCls} value={ticket} onChange={(e) => setTicket(e.target.value)} /></Field>
        <Field label="Receita total (R$)"><input type="number" className={inputCls} value={receita} onChange={(e) => setReceita(e.target.value)} /></Field>
      </div>
      <Field label="Notas"><textarea className={inputCls} rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} /></Field>
      <button onClick={save} disabled={saving} className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50">
        {saving ? "Salvando…" : "Salvar"}
      </button>
    </ModalShell>
  );
}

// ============ ORDER MODAL ============
function OrderModal({
  initial, distributors, onClose, onSaved,
}: { initial?: Order; distributors: Distributor[]; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState(initial?.pedido_data ?? new Date().toISOString().slice(0, 10));
  const [cliente, setCliente] = useState(initial?.cliente ?? "");
  const [valor, setValor] = useState(String(initial?.valor ?? ""));
  const [status, setStatus] = useState(initial?.status ?? "novo");
  const [responsavel, setResponsavel] = useState<Responsavel>(initial?.responsavel ?? "Otávio");
  const [canal, setCanal] = useState<SubCanal>(initial?.canal ?? "distribuidores");
  const [distId, setDistId] = useState<string>(initial?.distribuidor_id ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!cliente.trim()) { toast.error("Informe o cliente"); return; }
    setSaving(true);
    const payload = {
      pedido_data: data,
      cliente: cliente.trim(),
      valor: Number(valor) || 0,
      status,
      responsavel,
      canal,
      distribuidor_id: distId || null,
    };
    const res = initial
      ? await supabase.from("b2b_orders").update(payload).eq("id", initial.id)
      : await supabase.from("b2b_orders").insert(payload);
    setSaving(false);
    if (res.error) toast.error(res.error.message);
    else { toast.success("Salvo"); onSaved(); }
  }

  return (
    <ModalShell title={initial ? "Editar pedido" : "Novo pedido B2B"} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data"><input type="date" className={inputCls} value={data} onChange={(e) => setData(e.target.value)} /></Field>
        <Field label="Valor (R$)"><input type="number" className={inputCls} value={valor} onChange={(e) => setValor(e.target.value)} /></Field>
      </div>
      <Field label="Cliente"><input className={inputCls} value={cliente} onChange={(e) => setCliente(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="novo">novo</option>
            <option value="faturado">faturado</option>
            <option value="entregue">entregue</option>
            <option value="cancelado">cancelado</option>
          </select>
        </Field>
        <Field label="Responsável">
          <select className={inputCls} value={responsavel} onChange={(e) => setResponsavel(e.target.value as Responsavel)}>
            <option value="Otávio">Otávio</option>
            <option value="Igor">Igor</option>
          </select>
        </Field>
      </div>
      <Field label="Canal">
        <select className={inputCls} value={canal} onChange={(e) => setCanal(e.target.value as SubCanal)}>
          {SUB_CANAIS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </Field>
      <Field label="Distribuidor (opcional)">
        <select className={inputCls} value={distId} onChange={(e) => setDistId(e.target.value)}>
          <option value="">— nenhum —</option>
          {distributors.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
      </Field>
      <button onClick={save} disabled={saving} className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50">
        {saving ? "Salvando…" : "Salvar"}
      </button>
    </ModalShell>
  );
}

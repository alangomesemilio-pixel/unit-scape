import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Package, Truck, CheckCircle2, XCircle, RefreshCw, Boxes, AlertTriangle,
  Plus, Trash2, Gauge, Clock, Settings, X, PlugZap, ExternalLink, Pause,
  Cog, Send, Warehouse, BarChart3, TrendingUp, Search, ShoppingBag,
  Calendar, MapPin, AlertCircle, Activity,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getMelonnOrders, getMelonnInventory, getMelonnCouriers,
  getMelonnConfig, saveMelonnConfig, testMelonnEndpoint,
  melonnStatusLabel, MELONN_STATUSES, MELONN_WAREHOUSES,
  type MelonnOrder, type MelonnInventoryItem, type MelonnCourier,
  type MelonnOrderStatus, type MelonnConfig,
} from "@/lib/melonn.functions";

// ============================================================
// TYPES & CONSTANTS
// ============================================================

type Material = {
  id: string;
  material: string;
  quantidade_atual: number;
  minimo: number;
  unidade: string;
  ordem: number;
};

type TabId = "pedidos" | "performance" | "estoque" | "transportadoras" | "embalagens";
type Periodo = "hoje" | "7d" | "30d";
type StatusFilter = "all" | MelonnOrderStatus;
type TipoFilter = "all" | "b2b" | "d2c";

const STATUS_META: Record<MelonnOrderStatus, { icon: typeof Package; color: string; emoji: string }> = {
  picking:    { icon: Package,      color: "#eab308", emoji: "🟡" },
  processing: { icon: Cog,          color: "#3b82f6", emoji: "🔵" },
  ready:      { icon: Send,         color: "#f97316", emoji: "🟠" },
  in_transit: { icon: Truck,        color: "#a855f7", emoji: "🚚" },
  delivered:  { icon: CheckCircle2, color: "#10b981", emoji: "🟢" },
  on_hold:    { icon: Pause,        color: "#94a3b8", emoji: "⏸️" },
  cancelled:  { icon: XCircle,      color: "#ef4444", emoji: "🔴" },
};

const SLA_DAYS = 3;
const REFRESH_MS = 5 * 60 * 1000;

// ============================================================
// HELPERS
// ============================================================

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function startOfPeriod(p: Periodo): number {
  const d = new Date();
  if (p === "hoje") { d.setHours(0, 0, 0, 0); return d.getTime(); }
  if (p === "7d") return Date.now() - 7 * 86400000;
  return Date.now() - 30 * 86400000;
}
function fmtHHMM(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function semaforo(value: number, good: number, warn: number, reverse = false): string {
  const isGood = reverse ? value <= good : value >= good;
  const isWarn = reverse ? value <= warn : value >= warn;
  if (isGood) return "#10b981";
  if (isWarn) return "#eab308";
  return "#ef4444";
}

// ============================================================
// SHARED UI
// ============================================================

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card p-4 ${className}`}>{children}</div>;
}

function KpiCard({
  icon: Icon, label, value, color, sub,
}: { icon: any; label: string; value: string; color?: string; sub?: string }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-center justify-between mb-1">
        <Icon className="size-4 text-muted-foreground" />
        {color && <span className="size-2 rounded-full" style={{ background: color }} />}
      </div>
      <div className="text-2xl font-bold tabular-nums" style={color ? { color } : {}}>{value}</div>
      <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</div>}
    </Card>
  );
}

function SectionTitle({ icon: Icon, title, subtitle, children }: any) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

// ============================================================
// MAIN DASHBOARD
// ============================================================

export function LogisticaDashboard() {
  const [orders, setOrders] = useState<MelonnOrder[]>([]);
  const [ordersErr, setOrdersErr] = useState<string>();
  const [ordersAt, setOrdersAt] = useState<string>();

  const [inventory, setInventory] = useState<MelonnInventoryItem[]>([]);
  const [inventoryErr, setInventoryErr] = useState<string>();
  const [inventoryAt, setInventoryAt] = useState<string>();

  const [couriers, setCouriers] = useState<MelonnCourier[]>([]);
  const [couriersErr, setCouriersErr] = useState<string>();

  const [materials, setMaterials] = useState<Material[]>([]);
  const [activeWarehouses, setActiveWarehouses] = useState<string[]>(["MED-2", "MED-3", "BOG-2", "BAQ-1", "CAL-2"]);
  const [loading, setLoading] = useState({ orders: true, inv: true, cou: true, mat: true });

  const [tab, setTab] = useState<TabId>("pedidos");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refreshOrders = useCallback(async () => {
    setLoading((l) => ({ ...l, orders: true }));
    const r = await getMelonnOrders();
    setOrders(r.orders); setOrdersErr(r.error); setOrdersAt(r.fetched_at);
    setLoading((l) => ({ ...l, orders: false }));
  }, []);
  const refreshInventory = useCallback(async () => {
    setLoading((l) => ({ ...l, inv: true }));
    const r = await getMelonnInventory();
    setInventory(r.items); setInventoryErr(r.error); setInventoryAt(r.fetched_at);
    setLoading((l) => ({ ...l, inv: false }));
  }, []);
  const refreshCouriers = useCallback(async () => {
    setLoading((l) => ({ ...l, cou: true }));
    const r = await getMelonnCouriers();
    setCouriers(r.couriers); setCouriersErr(r.error);
    setLoading((l) => ({ ...l, cou: false }));
  }, []);
  const refreshMaterials = useCallback(async () => {
    setLoading((l) => ({ ...l, mat: true }));
    const { data, error } = await supabase.from("packaging_materials").select("*").order("ordem", { ascending: true });
    if (error) toast.error(error.message);
    setMaterials((data as Material[]) ?? []);
    setLoading((l) => ({ ...l, mat: false }));
  }, []);

  async function refreshAll() {
    setRefreshing(true);
    await Promise.all([refreshOrders(), refreshInventory(), refreshCouriers()]);
    setRefreshing(false);
  }

  useEffect(() => {
    getMelonnConfig().then((r) => setActiveWarehouses(r.config.warehouseCodes));
    refreshOrders(); refreshInventory(); refreshCouriers(); refreshMaterials();
    const t = setInterval(() => { refreshAll(); }, REFRESH_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============= KPIs HEADER =============
  const kpis = useMemo(() => {
    const total = orders.length;
    const delivered = orders.filter((o) => o.status === "delivered");
    const onTime = delivered.filter((o) => {
      if (!o.creation_date || !o.delivered_at) return true; // sem dado, assume ok
      return daysSince(o.creation_date) - daysSince(o.delivered_at) <= SLA_DAYS;
    }).length;
    const slaPct = delivered.length > 0 ? (onTime / delivered.length) * 100 : 0;
    const avgDays = delivered.length > 0
      ? delivered.reduce((sum, o) => {
          if (!o.creation_date || !o.delivered_at) return sum;
          return sum + Math.max(0, daysSince(o.creation_date) - daysSince(o.delivered_at));
        }, 0) / delivered.length
      : 0;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;
    const cancelPct = total > 0 ? (cancelled / total) * 100 : 0;
    const atrasados = orders.filter(
      (o) => o.status_code === 20 || (o.status !== "delivered" && o.status !== "cancelled" && daysSince(o.creation_date) > SLA_DAYS),
    ).length;
    const ruptura = new Set(inventory.filter((i) => i.available === 0).map((i) => i.sku)).size;
    const todayStart = startOfPeriod("hoje");
    const hoje = orders.filter((o) => o.creation_date && new Date(o.creation_date).getTime() >= todayStart).length;
    return { slaPct, avgDays, cancelPct, atrasados, ruptura, hoje };
  }, [orders, inventory]);

  const ctx = {
    orders, inventory, couriers, materials, activeWarehouses,
    ordersErr, inventoryErr, couriersErr,
    loading, refreshMaterials, setMaterials,
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 bg-background">
      {/* HEADER */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Logística</h1>
          <p className="text-sm text-muted-foreground">
            Integração Melonn · análise operacional em tempo real
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1"><Warehouse className="size-3" />Bodegas: {activeWarehouses.join(" · ")}</span>
            <span className="flex items-center gap-1"><Clock className="size-3" />Última atualização: {fmtHHMM(ordersAt)}</span>
            <span className="text-muted-foreground/60">· Auto-refresh 5min</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-sm hover:bg-secondary/80">
            <Settings className="size-4" /> Configurações
          </button>
          <button onClick={refreshAll} disabled={refreshing} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50">
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} /> Atualizar agora
          </button>
        </div>
      </header>

      {/* KPI HEADER */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={Gauge} label="SLA de entrega" value={`${kpis.slaPct.toFixed(1)}%`} sub="Meta ≥ 98%" color={semaforo(kpis.slaPct, 98, 90)} />
        <KpiCard icon={Clock} label="Tempo médio de entrega" value={`${kpis.avgDays.toFixed(1)} d`} sub="Meta ≤ 3 dias" color={semaforo(kpis.avgDays, 3, 5, true)} />
        <KpiCard icon={XCircle} label="Taxa de cancelamento" value={`${kpis.cancelPct.toFixed(1)}%`} sub="Meta ≤ 3%" color={semaforo(kpis.cancelPct, 3, 5, true)} />
        <KpiCard icon={AlertTriangle} label="Pedidos em atraso" value={String(kpis.atrasados)} sub="Meta 0" color={kpis.atrasados === 0 ? "#10b981" : kpis.atrasados < 5 ? "#eab308" : "#ef4444"} />
        <KpiCard icon={Boxes} label="Ruptura de estoque" value={String(kpis.ruptura)} sub="SKUs sem estoque" color={kpis.ruptura === 0 ? "#10b981" : kpis.ruptura < 5 ? "#eab308" : "#ef4444"} />
        <KpiCard icon={ShoppingBag} label="Pedidos hoje" value={String(kpis.hoje)} sub="Criados nas últimas 24h" />
      </div>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} onSaved={(c) => setActiveWarehouses(c.warehouseCodes)} />}

      {/* TABS NAV */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {[
          { id: "pedidos", label: "📦 Pedidos" },
          { id: "performance", label: "📊 Performance" },
          { id: "estoque", label: "🏭 Estoque" },
          { id: "transportadoras", label: "🚚 Transportadoras" },
          { id: "embalagens", label: "📦 Embalagens" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as TabId)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      {tab === "pedidos" && <PedidosTab {...ctx} />}
      {tab === "performance" && <PerformanceTab {...ctx} />}
      {tab === "estoque" && <EstoqueTab {...ctx} />}
      {tab === "transportadoras" && <TransportadorasTab {...ctx} />}
      {tab === "embalagens" && <EmbalagensTab {...ctx} />}
    </div>
  );
}

// ============================================================
// ABA 1 — PEDIDOS
// ============================================================
type CtxBase = {
  orders: MelonnOrder[]; inventory: MelonnInventoryItem[]; couriers: MelonnCourier[];
  materials: Material[]; activeWarehouses: string[];
  ordersErr?: string; inventoryErr?: string; couriersErr?: string;
  loading: { orders: boolean; inv: boolean; cou: boolean; mat: boolean };
  refreshMaterials: () => Promise<void>;
  setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
};

function PedidosTab({ orders, ordersErr, loading, activeWarehouses }: CtxBase) {
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const [bodega, setBodega] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [tipo, setTipo] = useState<TipoFilter>("all");
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const filtered = useMemo(() => {
    const since = startOfPeriod(periodo);
    return orders.filter((o) => {
      if (o.creation_date && new Date(o.creation_date).getTime() < since) return false;
      if (bodega !== "all" && o.warehouse_code !== bodega) return false;
      if (status !== "all" && o.status !== status) return false;
      if (tipo === "b2b" && !o.is_b2b) return false;
      if (tipo === "d2c" && o.is_b2b) return false;
      if (busca) {
        const q = busca.toLowerCase();
        if (!o.number.toLowerCase().includes(q) && !o.customer.toLowerCase().includes(q) && !(o.internal_number?.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [orders, periodo, bodega, status, tipo, busca]);

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(MELONN_STATUSES.map((s) => [s, 0])) as Record<MelonnOrderStatus, number>;
    filtered.forEach((o) => { map[o.status] = (map[o.status] ?? 0) + 1; });
    return map;
  }, [filtered]);

  const pageOrders = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <section className="space-y-4">
      {ordersErr && <div className="text-xs text-amber-500">⚠️ {ordersErr}</div>}

      {/* FILTROS */}
      <Card className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {(["hoje", "7d", "30d"] as Periodo[]).map((p) => (
            <button key={p} onClick={() => { setPeriodo(p); setPage(0); }} className={`px-2.5 py-1 text-xs rounded ${periodo === p ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"}`}>
              {p === "hoje" ? "Hoje" : p === "7d" ? "7 dias" : "30 dias"}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-border" />
        <select value={bodega} onChange={(e) => { setBodega(e.target.value); setPage(0); }} className="text-xs bg-secondary px-2 py-1 rounded border border-border">
          <option value="all">Todas bodegas</option>
          {activeWarehouses.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(0); }} className="text-xs bg-secondary px-2 py-1 rounded border border-border">
          <option value="all">Todos status</option>
          {MELONN_STATUSES.map((s) => <option key={s} value={s}>{melonnStatusLabel(s)}</option>)}
        </select>
        <select value={tipo} onChange={(e) => { setTipo(e.target.value as TipoFilter); setPage(0); }} className="text-xs bg-secondary px-2 py-1 rounded border border-border">
          <option value="all">Todos tipos</option>
          <option value="d2c">D2C</option>
          <option value="b2b">B2B</option>
        </select>
        <div className="ml-auto flex items-center gap-1.5 bg-secondary rounded px-2 py-1 border border-border">
          <Search className="size-3 text-muted-foreground" />
          <input value={busca} onChange={(e) => { setBusca(e.target.value); setPage(0); }} placeholder="# pedido ou cliente" className="bg-transparent text-xs focus:outline-none w-44" />
        </div>
      </Card>

      {/* CARDS DE STATUS CLICÁVEIS */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
        {MELONN_STATUSES.map((s) => {
          const meta = STATUS_META[s];
          const Icon = meta.icon;
          const active = status === s;
          return (
            <button key={s} onClick={() => { setStatus(active ? "all" : s); setPage(0); }}
              className={`rounded-lg border p-3 text-left transition hover:scale-[1.02] ${active ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
              <div className="flex items-center justify-between mb-1">
                <Icon className="size-4" style={{ color: meta.color }} />
                <span className="text-[10px]">{meta.emoji}</span>
              </div>
              <div className="text-xl font-bold tabular-nums">{byStatus[s]}</div>
              <div className="text-[10px] text-muted-foreground leading-tight">{melonnStatusLabel(s)}</div>
            </button>
          );
        })}
      </div>

      {/* TABELA */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr>
                <th className="text-left px-3 py-2 font-medium"># Pedido</th>
                <th className="text-left px-3 py-2 font-medium">Melonn ID</th>
                <th className="text-left px-3 py-2 font-medium">Data</th>
                <th className="text-left px-3 py-2 font-medium">Tipo</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Transportadora</th>
                <th className="text-left px-3 py-2 font-medium">Bodega</th>
                <th className="text-right px-3 py-2 font-medium">Dias abertos</th>
                <th className="text-left px-3 py-2 font-medium">Rastreio</th>
              </tr>
            </thead>
            <tbody>
              {loading.orders ? (
                <tr><td colSpan={9} className="text-center text-muted-foreground py-8">Carregando…</td></tr>
              ) : pageOrders.length === 0 ? (
                <tr><td colSpan={9} className="text-center text-muted-foreground py-8">Nenhum pedido com esses filtros.</td></tr>
              ) : pageOrders.map((o, idx) => {
                const dias = daysSince(o.creation_date);
                const aberto = o.status !== "delivered" && o.status !== "cancelled";
                const atrasado = aberto && dias > SLA_DAYS;
                return (
                  <tr key={o.id} className={`border-t border-border ${idx % 2 === 0 ? "" : "bg-secondary/10"} ${atrasado ? "bg-red-500/10" : ""}`}>
                    <td className="px-3 py-2 font-mono text-xs">{o.number}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{o.internal_number ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{o.creation_date ? new Date(o.creation_date).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${o.is_b2b ? "bg-blue-500/15 text-blue-500" : "bg-secondary text-muted-foreground"}`}>
                        {o.is_b2b ? "B2B" : "D2C"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px]" style={{ background: `${STATUS_META[o.status].color}22`, color: STATUS_META[o.status].color }}>
                        {melonnStatusLabel(o.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{o.carrier ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{o.warehouse_code ?? o.warehouse ?? "—"}</td>
                    <td className={`px-3 py-2 text-right text-xs ${atrasado ? "text-red-500 font-bold" : ""}`}>{aberto ? dias : "—"}</td>
                    <td className="px-3 py-2">
                      {o.tracking_link ? (
                        <a href={o.tracking_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                          rastrear <ExternalLink className="size-3" />
                        </a>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* PAGINAÇÃO */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border text-xs">
            <span className="text-muted-foreground">{filtered.length} pedidos · página {page + 1} de {pageCount}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-2 py-1 rounded bg-secondary disabled:opacity-40">‹</button>
              <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1} className="px-2 py-1 rounded bg-secondary disabled:opacity-40">›</button>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}

// ============================================================
// ABA 2 — PERFORMANCE
// ============================================================
function PerformanceTab({ orders, activeWarehouses }: CtxBase) {
  // Gráfico 1: volume por dia (30 dias)
  const volumePorDia = useMemo(() => {
    const map = new Map<string, { dia: string; criados: number; entregues: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { dia: `${d.getDate()}/${d.getMonth() + 1}`, criados: 0, entregues: 0 });
    }
    orders.forEach((o) => {
      if (o.creation_date) {
        const k = o.creation_date.slice(0, 10);
        const e = map.get(k); if (e) e.criados++;
      }
      if (o.delivered_at) {
        const k = o.delivered_at.slice(0, 10);
        const e = map.get(k); if (e) e.entregues++;
      }
    });
    return Array.from(map.values());
  }, [orders]);

  // Gráfico 2: funil
  const funil = useMemo(() => {
    const order: { label: string; key: MelonnOrderStatus | "all" }[] = [
      { label: "Recebido (total)", key: "all" },
      { label: "Em separação", key: "picking" },
      { label: "Em processamento", key: "processing" },
      { label: "Pronto p/ envio", key: "ready" },
      { label: "Em trânsito", key: "in_transit" },
      { label: "Entregue", key: "delivered" },
    ];
    return order.map((o) => ({
      etapa: o.label,
      qtd: o.key === "all" ? orders.length : orders.filter((x) => x.status === o.key).length,
    }));
  }, [orders]);

  // Gráfico 3: SLA donut
  const slaDist = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "delivered" && o.creation_date && o.delivered_at);
    let prazo = 0, atraso12 = 0, atraso3 = 0;
    delivered.forEach((o) => {
      const dias = daysSince(o.creation_date) - daysSince(o.delivered_at);
      if (dias <= SLA_DAYS) prazo++;
      else if (dias <= SLA_DAYS + 2) atraso12++;
      else atraso3++;
    });
    return [
      { name: "No prazo", value: prazo, color: "#10b981" },
      { name: "Atrasado 1-2d", value: atraso12, color: "#eab308" },
      { name: "Atrasado 3+d", value: atraso3, color: "#ef4444" },
    ];
  }, [orders]);

  // Gráfico 4: por bodega
  const porBodega = useMemo(() => {
    const map = new Map<string, { bodega: string; recebidos: number; entregues: number; em_aberto: number }>();
    orders.forEach((o) => {
      const wh = o.warehouse_code ?? "—";
      const e = map.get(wh) ?? { bodega: wh, recebidos: 0, entregues: 0, em_aberto: 0 };
      e.recebidos++;
      if (o.status === "delivered") e.entregues++;
      else if (o.status !== "cancelled") e.em_aberto++;
      map.set(wh, e);
    });
    return Array.from(map.values());
  }, [orders]);

  // Métricas calculadas
  const metricas = useMemo(() => {
    const total = orders.length;
    const delivered = orders.filter((o) => o.status === "delivered").length;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;
    const b2b = orders.filter((o) => o.is_b2b).length;
    const last7Start = Date.now() - 7 * 86400000;
    const last7 = orders.filter((o) => o.creation_date && new Date(o.creation_date).getTime() >= last7Start).length;
    const media7 = last7 / 7;
    const dayOfMonth = new Date().getDate();
    const projecao = Math.round(media7 * 30);
    return {
      sucessoPct: total > 0 ? (delivered / total) * 100 : 0,
      cancelPct: total > 0 ? (cancelled / total) * 100 : 0,
      b2bPct: total > 0 ? (b2b / total) * 100 : 0,
      d2cPct: total > 0 ? ((total - b2b) / total) * 100 : 0,
      media7,
      projecao,
      dayOfMonth,
    };
  }, [orders]);

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <SectionTitle icon={TrendingUp} title="Volume de pedidos por dia" subtitle="Últimos 30 dias" />
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={volumePorDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="criados" stroke="#3b82f6" strokeWidth={2} dot={false} name="Criados" />
                <Line type="monotone" dataKey="entregues" stroke="#10b981" strokeWidth={2} dot={false} name="Entregues" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={BarChart3} title="Funil de status" subtitle="Pedidos por etapa agora" />
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={funil} layout="vertical" margin={{ left: 90 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="etapa" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={90} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Bar dataKey="qtd" fill="#a855f7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={Activity} title="SLA de entrega" subtitle="Distribuição dos pedidos entregues" />
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={slaDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {slaDist.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={Warehouse} title="Volume por bodega" subtitle={`Comparativo: ${activeWarehouses.join(" · ")}`} />
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={porBodega}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="bodega" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="recebidos" fill="#3b82f6" name="Recebidos" />
                <Bar dataKey="entregues" fill="#10b981" name="Entregues" />
                <Bar dataKey="em_aberto" fill="#eab308" name="Em aberto" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* MÉTRICAS CALCULADAS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={CheckCircle2} label="Taxa de sucesso" value={`${metricas.sucessoPct.toFixed(1)}%`} color="#10b981" />
        <KpiCard icon={XCircle} label="Taxa de cancelamento" value={`${metricas.cancelPct.toFixed(1)}%`} color={semaforo(metricas.cancelPct, 3, 5, true)} />
        <KpiCard icon={Activity} label="% B2B / D2C" value={`${metricas.b2bPct.toFixed(0)}% / ${metricas.d2cPct.toFixed(0)}%`} />
        <KpiCard icon={Calendar} label="Média de pedidos/dia (7d)" value={metricas.media7.toFixed(1)} />
        <KpiCard icon={TrendingUp} label="Projeção do mês" value={String(metricas.projecao)} sub="baseado no ritmo de 7 dias" />
        <KpiCard icon={Clock} label="Tempo criação → entrega" value="—" sub="depende de eventos da API" />
        <KpiCard icon={Clock} label="Tempo picking → despacho" value="—" sub="depende de eventos da API" />
        <KpiCard icon={Clock} label="Tempo despacho → entrega" value="—" sub="depende de eventos da API" />
      </div>
    </section>
  );
}

// ============================================================
// ABA 3 — ESTOQUE
// ============================================================
function EstoqueTab({ inventory, orders, inventoryErr, loading, activeWarehouses }: CtxBase) {
  const [filtro, setFiltro] = useState<string>("consolidado");

  // média de pedidos/dia (7d) — para cobertura
  const mediaDia = useMemo(() => {
    const since = Date.now() - 7 * 86400000;
    const recent = orders.filter((o) => o.creation_date && new Date(o.creation_date).getTime() >= since).length;
    return recent / 7;
  }, [orders]);

  // Consolidado por SKU com cobertura
  const consolidado = useMemo(() => {
    const map = new Map<string, { sku: string; product: string; byWh: Record<string, { available: number; reserved: number }>; available: number; reserved: number; total: number }>();
    inventory.forEach((i) => {
      const cur = map.get(i.sku) ?? { sku: i.sku, product: i.product, byWh: {}, available: 0, reserved: 0, total: 0 };
      cur.byWh[i.warehouse] = { available: i.available, reserved: i.reserved };
      cur.available += i.available; cur.reserved += i.reserved; cur.total += i.total;
      map.set(i.sku, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.available - b.available);
  }, [inventory]);

  const ruptura = consolidado.filter((c) => c.available === 0);
  const baixa = consolidado.filter((c) => c.available > 0 && (mediaDia > 0 ? c.available / mediaDia : 999) < 7);
  const desbalanceadas = consolidado.filter((c) =>
    activeWarehouses.length >= 2 &&
    activeWarehouses.some((wh) => (c.byWh[wh]?.available ?? 0) === 0) &&
    activeWarehouses.some((wh) => (c.byWh[wh]?.available ?? 0) > 50),
  );

  function coberturaInfo(available: number): { dias: number; color: string; label: string; pulse?: boolean } {
    if (available === 0) return { dias: 0, color: "#ef4444", label: "Crítico", pulse: true };
    if (mediaDia === 0) return { dias: Infinity, color: "#10b981", label: "OK" };
    const d = available / mediaDia;
    if (d > 15) return { dias: d, color: "#10b981", label: "OK" };
    if (d >= 7) return { dias: d, color: "#eab308", label: "Atenção" };
    return { dias: d, color: "#ef4444", label: "Repor" };
  }

  // Visão filtrada (por bodega)
  const visaoFiltrada = useMemo(() => {
    if (filtro === "consolidado") return null;
    return inventory.filter((i) => i.warehouse === filtro).sort((a, b) => a.available - b.available);
  }, [inventory, filtro]);

  // Distribuição (top 15)
  const distribuicao = useMemo(() => {
    return consolidado.slice(0, 15).map((c) => {
      const obj: any = { sku: c.sku.slice(0, 12) };
      activeWarehouses.forEach((wh) => { obj[wh] = c.byWh[wh]?.available ?? 0; });
      return obj;
    });
  }, [consolidado, activeWarehouses]);

  const whColors = ["#3b82f6", "#a855f7", "#f97316", "#10b981"];

  return (
    <section className="space-y-4">
      {inventoryErr && <div className="text-xs text-amber-500">⚠️ {inventoryErr}</div>}

      {/* ALERTAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-red-500/40">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-red-500 font-semibold flex items-center gap-1"><AlertCircle className="size-3.5" /> Sem estoque</span>
            <span className="text-xl font-bold text-red-500">{ruptura.length}</span>
          </div>
          <div className="text-[11px] text-muted-foreground truncate" title={ruptura.map((r) => r.sku).join(", ")}>
            {ruptura.slice(0, 5).map((r) => r.sku).join(", ") || "—"}{ruptura.length > 5 && ` +${ruptura.length - 5}`}
          </div>
        </Card>
        <Card className="border-amber-500/40">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-amber-500 font-semibold flex items-center gap-1"><AlertTriangle className="size-3.5" /> Cobertura &lt; 7 dias</span>
            <span className="text-xl font-bold text-amber-500">{baixa.length}</span>
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {baixa.slice(0, 5).map((r) => r.sku).join(", ") || "—"}
          </div>
        </Card>
        <Card className="border-orange-500/40">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-orange-500 font-semibold flex items-center gap-1"><Warehouse className="size-3.5" /> Desbalanceadas</span>
            <span className="text-xl font-bold text-orange-500">{desbalanceadas.length}</span>
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            Zerado numa bodega e &gt;50 na outra
          </div>
        </Card>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-1">
        {[{ id: "consolidado", label: "Consolidado" }, ...activeWarehouses.map((wh) => ({ id: wh, label: `${wh} ${MELONN_WAREHOUSES.find((w) => w.code === wh)?.name ?? ""}` }))].map((t) => (
          <button key={t.id} onClick={() => setFiltro(t.id)} className={`px-3 py-1.5 text-xs rounded-md transition ${filtro === t.id ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TABELA PRINCIPAL */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Produto</th>
                <th className="text-left px-3 py-2 font-medium">SKU</th>
                {filtro === "consolidado" ? (
                  <>
                    {activeWarehouses.map((wh) => (
                      <th key={wh} className="text-right px-3 py-2 font-medium">{wh} (disp/res)</th>
                    ))}
                    <th className="text-right px-3 py-2 font-medium">Total</th>
                    <th className="text-right px-3 py-2 font-medium">Cobertura</th>
                  </>
                ) : (
                  <>
                    <th className="text-right px-3 py-2 font-medium">Disponível</th>
                    <th className="text-right px-3 py-2 font-medium">Reservado</th>
                    <th className="text-right px-3 py-2 font-medium">Total</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading.inv ? (
                <tr><td colSpan={8} className="text-center text-muted-foreground py-8">Carregando…</td></tr>
              ) : filtro === "consolidado" ? (
                consolidado.length === 0 ? <tr><td colSpan={8} className="text-center text-muted-foreground py-8">Sem dados.</td></tr> :
                consolidado.map((c, idx) => {
                  const cov = coberturaInfo(c.available);
                  return (
                    <tr key={c.sku} className={`border-t border-border ${idx % 2 === 1 ? "bg-secondary/10" : ""}`}>
                      <td className="px-3 py-2">{c.product}</td>
                      <td className="px-3 py-2 font-mono text-xs">{c.sku}</td>
                      {activeWarehouses.map((wh) => (
                        <td key={wh} className="px-3 py-2 text-right text-xs tabular-nums">
                          {(c.byWh[wh]?.available ?? 0)} / <span className="text-muted-foreground">{c.byWh[wh]?.reserved ?? 0}</span>
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{c.available}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`inline-flex items-center gap-1 text-xs ${cov.pulse ? "animate-pulse" : ""}`} style={{ color: cov.color }}>
                          <span className="size-1.5 rounded-full" style={{ background: cov.color }} />
                          {cov.dias === Infinity ? "—" : `${cov.dias.toFixed(1)} d`}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : visaoFiltrada && visaoFiltrada.length > 0 ? (
                visaoFiltrada.map((i, idx) => (
                  <tr key={`${i.sku}-${idx}`} className={`border-t border-border ${idx % 2 === 1 ? "bg-secondary/10" : ""}`}>
                    <td className="px-3 py-2">{i.product}</td>
                    <td className="px-3 py-2 font-mono text-xs">{i.sku}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${i.available === 0 ? "text-red-500 font-bold" : i.available < 50 ? "text-amber-500 font-semibold" : ""}`}>{i.available}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{i.reserved}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{i.total}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-8">Sem dados nesta bodega.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* DISTRIBUIÇÃO */}
      {filtro === "consolidado" && distribuicao.length > 0 && (
        <Card>
          <SectionTitle icon={BarChart3} title="Distribuição entre bodegas" subtitle="Top 15 SKUs · destaca desbalanceamento" />
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={distribuicao} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="sku" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={80} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {activeWarehouses.map((wh, idx) => (
                  <Bar key={wh} dataKey={wh} stackId="a" fill={whColors[idx % whColors.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </section>
  );
}

// ============================================================
// ABA 4 — TRANSPORTADORAS
// ============================================================
function TransportadorasTab({ orders, couriers, couriersErr }: CtxBase) {
  const agregado = useMemo(() => {
    const map = new Map<string, { name: string; code: string; total: number; em_transito: number; atrasados: number; entregues: number }>();
    orders.forEach((o) => {
      const key = o.carrier_code ?? o.carrier ?? "—";
      const cur = map.get(key) ?? { name: o.carrier ?? key, code: o.carrier_code ?? key, total: 0, em_transito: 0, atrasados: 0, entregues: 0 };
      cur.total++;
      if (o.status === "in_transit") cur.em_transito++;
      if (o.status === "delivered") cur.entregues++;
      if (o.status !== "delivered" && o.status !== "cancelled" && daysSince(o.creation_date) > SLA_DAYS) cur.atrasados++;
      map.set(key, cur);
    });
    const total = orders.length;
    return Array.from(map.values()).map((c) => ({
      ...c, pct: total > 0 ? (c.total / total) * 100 : 0,
      sucesso: c.total > 0 ? ((c.entregues / c.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total);
  }, [orders]);

  const donut = useMemo(() => {
    const top = agregado.slice(0, 4);
    const outros = agregado.slice(4).reduce((s, c) => s + c.total, 0);
    const colors = ["#3b82f6", "#10b981", "#a855f7", "#f97316", "#94a3b8"];
    return [
      ...top.map((c, i) => ({ name: c.name, value: c.total, color: colors[i] })),
      ...(outros > 0 ? [{ name: "Outros", value: outros, color: colors[4] }] : []),
    ];
  }, [agregado]);

  const porCidade = useMemo(() => {
    const map = new Map<string, { cidade: string; total: number; entregues: number }>();
    orders.forEach((o) => {
      if (!o.destination_city) return;
      const cur = map.get(o.destination_city) ?? { cidade: o.destination_city, total: 0, entregues: 0 };
      cur.total++;
      if (o.status === "delivered") cur.entregues++;
      map.set(o.destination_city, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 12);
  }, [orders]);

  return (
    <section className="space-y-4">
      {couriersErr && <div className="text-xs text-amber-500">⚠️ {couriersErr}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Performance por transportadora</h3>
            <p className="text-[11px] text-muted-foreground">{agregado.length} transportadoras · {couriers.length} disponíveis no catálogo</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Transportadora</th>
                  <th className="text-right px-3 py-2 font-medium">Vol. 30d</th>
                  <th className="text-right px-3 py-2 font-medium">% total</th>
                  <th className="text-right px-3 py-2 font-medium">Em trânsito</th>
                  <th className="text-right px-3 py-2 font-medium">Atrasados</th>
                  <th className="text-right px-3 py-2 font-medium">Taxa sucesso</th>
                </tr>
              </thead>
              <tbody>
                {agregado.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-muted-foreground py-8">Sem pedidos com transportadora.</td></tr>
                ) : agregado.map((c, idx) => (
                  <tr key={c.code} className={`border-t border-border ${idx % 2 === 1 ? "bg-secondary/10" : ""}`}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{c.code}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.total}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{c.pct.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.em_transito}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${c.atrasados > 0 ? "text-red-500 font-semibold" : ""}`}>{c.atrasados}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: semaforo(c.sucesso, 90, 75) }}>{c.sucesso.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={Truck} title="Métodos de envio" subtitle="Distribuição" />
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {donut.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* COBERTURA POR CIDADE */}
      <Card>
        <SectionTitle icon={MapPin} title="Cobertura por cidade" subtitle="Top 12 destinos · % entregue" />
        {porCidade.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center">Sem dados de cidade nos pedidos.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {porCidade.map((c) => {
              const pct = c.total > 0 ? (c.entregues / c.total) * 100 : 0;
              return (
                <div key={c.cidade} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate">{c.cidade}</span>
                    <span className="text-xs tabular-nums" style={{ color: semaforo(pct, 90, 75) }}>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{c.total} pedidos · {c.entregues} entregues</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}

// ============================================================
// ABA 5 — EMBALAGENS
// ============================================================
function EmbalagensTab({ materials, setMaterials, loading, refreshMaterials }: CtxBase) {
  const criticos = materials.filter((m) => m.quantidade_atual < m.minimo);

  async function updateMaterial(id: string, patch: Partial<Material>) {
    const { error } = await supabase.from("packaging_materials").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }
  async function addMaterial() {
    const nome = prompt("Nome do novo material:");
    if (!nome) return;
    const { data, error } = await supabase.from("packaging_materials").insert({
      material: nome, quantidade_atual: 0, minimo: 0, unidade: "un",
      ordem: (materials[materials.length - 1]?.ordem ?? 0) + 1,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setMaterials((p) => [...p, data as Material]);
  }
  async function removeMaterial(id: string) {
    if (!confirm("Remover este material?")) return;
    const { error } = await supabase.from("packaging_materials").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setMaterials((p) => p.filter((m) => m.id !== id));
  }
  async function repor(m: Material) {
    const qtd = prompt(`Quantos ${m.unidade} de "${m.material}" foram repostos?`);
    if (!qtd) return;
    const n = Number(qtd);
    if (!Number.isFinite(n) || n <= 0) { toast.error("Quantidade inválida"); return; }
    await updateMaterial(m.id, { quantidade_atual: m.quantidade_atual + n });
    toast.success(`+${n} ${m.unidade} de ${m.material}`);
  }

  return (
    <section className="space-y-4">
      {/* ALERTAS */}
      {criticos.length > 0 && (
        <Card className="border-red-500/40">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 text-red-500 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-red-500">{criticos.length} materiais abaixo do mínimo</div>
              <div className="text-xs text-muted-foreground mt-1">Repor o quanto antes:</div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {criticos.map((m) => (
                  <button key={m.id} onClick={() => repor(m)} className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20">
                    {m.material} ({m.quantidade_atual}/{m.minimo}) +
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold">Materiais de embalagem</h3>
            <p className="text-[11px] text-muted-foreground">Edite inline. Use “Repor” para adicionar à quantidade atual.</p>
          </div>
          <button onClick={addMaterial} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-secondary hover:bg-secondary/80">
            <Plus className="size-3.5" /> Material
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Material</th>
                <th className="text-right px-3 py-2 font-medium w-32">Qtd. atual</th>
                <th className="text-right px-3 py-2 font-medium w-28">Mínimo</th>
                <th className="text-left px-3 py-2 font-medium w-24">Unidade</th>
                <th className="text-left px-3 py-2 font-medium w-28">Status</th>
                <th className="text-right px-3 py-2 font-medium w-32">Ação</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading.mat ? (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-8">Carregando…</td></tr>
              ) : materials.map((m, idx) => {
                const baixo = m.quantidade_atual < m.minimo;
                return (
                  <tr key={m.id} className={`border-t border-border ${idx % 2 === 1 ? "bg-secondary/10" : ""}`}>
                    <td className="px-3 py-2">
                      <input defaultValue={m.material} onBlur={(e) => e.target.value !== m.material && updateMaterial(m.id, { material: e.target.value })}
                        className="bg-transparent w-full focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" min={0} defaultValue={m.quantidade_atual}
                        onBlur={(e) => { const v = Number(e.target.value); if (v !== m.quantidade_atual) updateMaterial(m.id, { quantidade_atual: v }); }}
                        className={`bg-transparent w-24 text-right focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1 ${baixo ? "text-red-500 font-semibold" : ""}`} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" min={0} defaultValue={m.minimo}
                        onBlur={(e) => { const v = Number(e.target.value); if (v !== m.minimo) updateMaterial(m.id, { minimo: v }); }}
                        className="bg-transparent w-20 text-right focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1" />
                    </td>
                    <td className="px-3 py-2">
                      <input defaultValue={m.unidade} onBlur={(e) => e.target.value !== m.unidade && updateMaterial(m.id, { unidade: e.target.value })}
                        className="bg-transparent w-16 focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1" />
                    </td>
                    <td className="px-3 py-2">
                      {baixo ? <span className="inline-flex items-center gap-1 text-xs text-red-500"><AlertTriangle className="size-3" /> Repor</span>
                        : <span className="text-xs text-emerald-500">OK</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => repor(m)} className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20">+ Repor</button>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button onClick={() => removeMaterial(m.id)} className="text-muted-foreground hover:text-red-500" aria-label="Remover">
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="text-[11px] text-muted-foreground">
        Histórico detalhado de reposições requer uma tabela dedicada — me peça para adicionar se quiser registro completo com data, quantidade e responsável.
      </div>
      <div className="hidden">{refreshMaterials.name}</div>
    </section>
  );
}

// ============================================================
// SETTINGS MODAL
// ============================================================
function SettingsModal({ onClose, onSaved }: { onClose: () => void; onSaved?: (c: MelonnConfig) => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [defaults, setDefaults] = useState<MelonnConfig | null>(null);
  const [cfg, setCfg] = useState<MelonnConfig>({ baseUrl: "", ordersPath: "", inventoryPath: "", couriersPath: "", warehouseCodes: [] });
  const [tests, setTests] = useState<Record<string, { ok?: boolean; msg?: string; loading?: boolean }>>({});

  useEffect(() => {
    getMelonnConfig().then((r) => { setCfg(r.config); setDefaults(r.defaults); setHasApiKey(r.hasApiKey); setLoading(false); });
  }, []);

  async function save() {
    setSaving(true);
    try {
      const r = await saveMelonnConfig({ data: cfg });
      setCfg(r.config); onSaved?.(r.config);
      toast.success("Configuração salva");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    } finally { setSaving(false); }
  }

  async function test(endpoint: "orders" | "inventory" | "couriers") {
    setTests((t) => ({ ...t, [endpoint]: { loading: true } }));
    await saveMelonnConfig({ data: cfg }).catch(() => null);
    const r = await testMelonnEndpoint({ data: { endpoint } });
    setTests((t) => ({ ...t, [endpoint]: r.ok ? { ok: true, msg: `OK · ${r.sample?.slice(0, 120)}…` } : { ok: false, msg: r.error } }));
  }

  function pathField(label: string, key: "baseUrl" | "ordersPath" | "inventoryPath" | "couriersPath", endpoint?: "orders" | "inventory" | "couriers") {
    const t = endpoint ? tests[endpoint] : undefined;
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
          <span>{label}</span>
          {defaults && <button type="button" onClick={() => setCfg((c) => ({ ...c, [key]: defaults[key] as string }))} className="text-[10px] text-muted-foreground hover:text-foreground underline">restaurar padrão</button>}
        </label>
        <div className="flex gap-2">
          <input value={cfg[key] as string} onChange={(e) => setCfg((c) => ({ ...c, [key]: e.target.value }))} className="flex-1 px-3 py-2 rounded-md bg-secondary/40 border border-border text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
          {endpoint && (
            <button type="button" onClick={() => test(endpoint)} disabled={t?.loading} className="flex items-center gap-1 px-2.5 text-xs rounded-md bg-secondary hover:bg-secondary/80 disabled:opacity-50">
              <PlugZap className="size-3.5" /> Testar
            </button>
          )}
        </div>
        {t?.msg && <div className={`text-[11px] ${t.ok ? "text-emerald-500" : "text-amber-500"}`}>{t.msg}</div>}
        {defaults && <div className="text-[10px] text-muted-foreground">padrão: <code>{defaults[key] as string}</code></div>}
      </div>
    );
  }

  function toggleWh(code: string) {
    setCfg((c) => {
      const set = new Set(c.warehouseCodes);
      if (set.has(code)) set.delete(code); else set.add(code);
      return { ...c, warehouseCodes: Array.from(set) };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold">Configurações Melonn</h3>
            <p className="text-xs text-muted-foreground">Base URL, paths e bodegas ativas.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {!hasApiKey && (
            <div className="text-xs p-2 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/30">
              ⚠️ MELONN_API_KEY não está configurado.
            </div>
          )}
          {loading ? <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div> : (
            <>
              {pathField("Base URL", "baseUrl")}
              {pathField("Endpoint · Pedidos", "ordersPath", "orders")}
              {pathField("Endpoint · Estoque", "inventoryPath", "inventory")}
              {pathField("Endpoint · Transportadoras", "couriersPath", "couriers")}
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Warehouse className="size-3.5" /> Bodegas ativas
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MELONN_WAREHOUSES.map((w) => {
                    const active = cfg.warehouseCodes.includes(w.code);
                    return (
                      <button key={w.code} type="button" onClick={() => toggleWh(w.code)}
                        className={`flex items-center justify-between px-3 py-2 rounded-md border text-sm transition ${active ? "bg-primary/10 border-primary" : "bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/50"}`}>
                        <span className="font-mono text-xs">{w.code}</span>
                        <span className="text-[11px]">{w.name}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[10px] text-muted-foreground">Selecionadas: <code>{cfg.warehouseCodes.join(", ") || "—"}</code></div>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded-md hover:bg-secondary/60">Cancelar</button>
          <button onClick={save} disabled={saving || loading} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

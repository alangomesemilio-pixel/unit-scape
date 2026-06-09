import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Briefcase, RefreshCw, AlertTriangle, Users, Package, DollarSign,
  Target, TrendingUp, ShoppingCart, X, Download, Search,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from "recharts";
import { fetchB2BSheet, type B2BRow } from "@/lib/b2b-sheets.functions";
import { loadB2BCache, saveB2BCache, clearB2BCache, isFresh, B2B_CACHE_TTL_MS } from "@/lib/b2b-cache";

// ============================================================
// Helpers
// ============================================================
const BRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n || 0);
const BRLfull = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const PCT = (n: number) => `${(n || 0).toFixed(1)}%`;
const NUM = (n: number) => new Intl.NumberFormat("pt-BR").format(n || 0);
const DT = (iso: string) => {
  if (!iso) return "—";
  const d = iso.split("-");
  if (d.length === 3) return `${d[2]}/${d[1]}/${d[0]}`;
  return iso;
};

function daysAgo(iso: string): number {
  if (!iso) return 99999;
  const d = new Date(iso + "T00:00:00");
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function monthKey(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 7); // YYYY-MM
}

function weekKey(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

type Period = "month" | "30d" | "90d" | "year" | "custom";

function periodFilter(rows: B2BRow[], period: Period, custom?: { from: string; to: string }): B2BRow[] {
  if (!rows.length) return rows;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  let from = "";
  let to = today;
  if (period === "month") {
    from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  } else if (period === "30d") {
    const d = new Date(now); d.setDate(d.getDate() - 30); from = d.toISOString().slice(0, 10);
  } else if (period === "90d") {
    const d = new Date(now); d.setDate(d.getDate() - 90); from = d.toISOString().slice(0, 10);
  } else if (period === "year") {
    from = `${now.getFullYear()}-01-01`;
  } else if (period === "custom" && custom) {
    from = custom.from; to = custom.to;
  }
  return rows.filter(r => r.data >= from && r.data <= to);
}

function semaforo(value: number, target: number, higherIsBetter = true): "g" | "y" | "r" {
  if (!target) return "y";
  const ratio = value / target;
  if (higherIsBetter) {
    if (ratio >= 1) return "g";
    if (ratio >= 0.7) return "y";
    return "r";
  } else {
    if (ratio <= 1) return "g";
    if (ratio <= 1.3) return "y";
    return "r";
  }
}

const semColor = (s: "g" | "y" | "r") =>
  s === "g" ? "text-emerald-400" : s === "y" ? "text-amber-400" : "text-rose-400";
const semBg = (s: "g" | "y" | "r") =>
  s === "g" ? "bg-emerald-500/10 border-emerald-500/30" : s === "y" ? "bg-amber-500/10 border-amber-500/30" : "bg-rose-500/10 border-rose-500/30";

// ============================================================
// MAIN COMPONENT
// ============================================================
type Tab = "visao" | "clientes" | "produtos" | "vendedores" | "pedidos";

export function B2BDashboard() {
  const fetchSheet = useServerFn(fetchB2BSheet);
  const [rows, setRows] = useState<B2BRow[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("visao");

  // Filters
  const [period, setPeriod] = useState<Period>("month");
  const [customRange, setCustomRange] = useState({ from: "", to: "" });
  const [filterVendedor, setFilterVendedor] = useState("Todos");
  const [filterProduto, setFilterProduto] = useState("Todos");
  const [filterEstado, setFilterEstado] = useState("Todos");

  // Side panels
  const [clienteDetail, setClienteDetail] = useState<string | null>(null);
  const [produtoDetail, setProdutoDetail] = useState<string | null>(null);

  const refresh = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      if (!force) {
        const cached = loadB2BCache();
        if (isFresh(cached) && cached) {
          setRows(cached.data.rows);
          setFetchedAt(cached.data.fetchedAt);
          setLoading(false);
          return;
        }
      }
      const result = await fetchSheet();
      setRows(result.rows);
      setFetchedAt(result.fetchedAt);
      saveB2BCache(result);
      if (force) toast.success(`Planilha sincronizada · ${result.rows.length} linhas`);
    } catch (e: any) {
      const msg = e?.message || String(e);
      setError(msg);
      if (msg.includes("GOOGLE_SERVICE_ACCOUNT_JSON")) {
        toast.error("Configure GOOGLE_SERVICE_ACCOUNT_JSON nas variáveis de ambiente");
      } else {
        toast.error("Erro ao ler planilha: " + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Try cache first; fetch if no fresh cache
    const cached = loadB2BCache();
    if (isFresh(cached) && cached) {
      setRows(cached.data.rows);
      setFetchedAt(cached.data.fetchedAt);
    } else {
      refresh(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unique values for filter dropdowns
  const allVendedores = useMemo(() => Array.from(new Set(rows.map(r => r.vendedor).filter(Boolean))).sort(), [rows]);
  const allProdutos = useMemo(() => Array.from(new Set(rows.map(r => r.sku).filter(Boolean))).sort(), [rows]);
  const allEstados = useMemo(() => Array.from(new Set(rows.map(r => r.estado).filter(Boolean))).sort(), [rows]);

  // Apply period + filters
  const filtered = useMemo(() => {
    let f = periodFilter(rows, period, customRange);
    if (filterVendedor !== "Todos") f = f.filter(r => r.vendedor === filterVendedor);
    if (filterProduto !== "Todos") f = f.filter(r => r.sku === filterProduto);
    if (filterEstado !== "Todos") f = f.filter(r => r.estado === filterEstado);
    return f;
  }, [rows, period, customRange, filterVendedor, filterProduto, filterEstado]);

  // Header KPIs (current month for "Receita B2B/mês"; others on filtered)
  const headerKpis = useMemo(() => {
    const mes = periodFilter(rows, "month");
    const receitaMes = mes.reduce((s, r) => s + r.valor_total, 0);
    const margemAvg = mes.length ? mes.reduce((s, r) => s + r.margem_pct, 0) / mes.length : 0;
    const ticketAvg = mes.length ? mes.reduce((s, r) => s + r.ticket_medio_pago, 0) / mes.length : 0;
    const clientesMes = new Set(mes.map(r => r.cnpj || r.cliente).filter(Boolean)).size;
    const cacSum = mes.reduce((s, r) => s + r.cac, 0);
    const cacMedio = clientesMes ? cacSum / clientesMes : 0;
    const pedidosMes = mes.length;

    // MoM pedidos
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
    const prevRows = rows.filter(r => monthKey(r.data) === prevKey);
    const pedidosMoM = prevRows.length ? ((pedidosMes - prevRows.length) / prevRows.length) * 100 : 0;

    return { receitaMes, margemAvg, ticketAvg, clientesMes, cacMedio, pedidosMes, pedidosMoM };
  }, [rows]);

  const cacheAgeMin = fetchedAt ? Math.floor((Date.now() - new Date(fetchedAt).getTime()) / 60000) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 space-y-4">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
            <Briefcase className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Canal B2B</h1>
            <p className="text-xs text-slate-400">
              {fetchedAt ? `Planilha atualizada às ${new Date(fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · ${cacheAgeMin}min atrás` : "Carregando…"}
              {" · "}{rows.length} linhas
            </p>
          </div>
        </div>
        <button
          onClick={() => { clearB2BCache(); refresh(true); }}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Sincronizando…" : "Sincronizar planilha"}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
          <div className="text-sm text-rose-200">{error}</div>
        </div>
      )}

      {/* HEADER KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Receita B2B/mês" value={BRL(headerKpis.receitaMes)} target="R$ 300k" sem={semaforo(headerKpis.receitaMes, 300000, true)} icon={DollarSign} />
        <KpiCard label="Margem B2B" value={PCT(headerKpis.margemAvg)} target="≥ 45%" sem={semaforo(headerKpis.margemAvg, 45, true)} icon={Target} />
        <KpiCard label="Ticket médio" value={BRL(headerKpis.ticketAvg)} target="≥ R$ 3.5k" sem={semaforo(headerKpis.ticketAvg, 3500, true)} icon={ShoppingCart} />
        <KpiCard label="Clientes ativos" value={NUM(headerKpis.clientesMes)} target="≥ 25" sem={semaforo(headerKpis.clientesMes, 25, true)} icon={Users} />
        <KpiCard label="CAC B2B" value={BRL(headerKpis.cacMedio)} target="≤ R$ 380" sem={semaforo(headerKpis.cacMedio, 380, false)} icon={TrendingUp} />
        <KpiCard label="Pedidos do mês" value={NUM(headerKpis.pedidosMes)} target={`${headerKpis.pedidosMoM >= 0 ? "+" : ""}${headerKpis.pedidosMoM.toFixed(0)}% MoM`} sem={headerKpis.pedidosMoM >= 0 ? "g" : "r"} icon={Package} />
      </div>

      {/* TABS */}
      <div className="flex gap-1 border-b border-slate-800 overflow-x-auto">
        {([
          ["visao", "Visão geral"],
          ["clientes", "Clientes"],
          ["produtos", "Produtos"],
          ["vendedores", "Vendedores"],
          ["pedidos", "Pedidos"],
        ] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === id ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap gap-2 items-center bg-slate-900/50 border border-slate-800 rounded-lg p-3">
        <Filter label="Período">
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm">
            <option value="month">Este mês</option>
            <option value="30d">30 dias</option>
            <option value="90d">90 dias</option>
            <option value="year">Este ano</option>
            <option value="custom">Custom</option>
          </select>
        </Filter>
        {period === "custom" && (
          <>
            <input type="date" value={customRange.from} onChange={(e) => setCustomRange(c => ({ ...c, from: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm" />
            <input type="date" value={customRange.to} onChange={(e) => setCustomRange(c => ({ ...c, to: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm" />
          </>
        )}
        <Filter label="Vendedor">
          <select value={filterVendedor} onChange={(e) => setFilterVendedor(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm">
            <option>Todos</option>
            {allVendedores.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </Filter>
        <Filter label="Produto">
          <select value={filterProduto} onChange={(e) => setFilterProduto(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm">
            <option>Todos</option>
            {allProdutos.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </Filter>
        <Filter label="Estado">
          <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm">
            <option>Todos</option>
            {allEstados.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </Filter>
        <div className="ml-auto text-xs text-slate-400">
          {filtered.length} pedidos no filtro
        </div>
      </div>

      {/* TAB CONTENT */}
      {tab === "visao" && <VisaoGeralTab rows={filtered} allRows={rows} />}
      {tab === "clientes" && <ClientesTab rows={filtered} onOpen={setClienteDetail} />}
      {tab === "produtos" && <ProdutosTab rows={filtered} allRows={rows} onOpen={setProdutoDetail} />}
      {tab === "vendedores" && <VendedoresTab rows={filtered} allRows={rows} />}
      {tab === "pedidos" && <PedidosTab rows={filtered} />}

      {/* Side panels */}
      {clienteDetail && <ClienteDetailPanel cliente={clienteDetail} rows={rows} onClose={() => setClienteDetail(null)} />}
      {produtoDetail && <ProdutoDetailPanel sku={produtoDetail} rows={rows} onClose={() => setProdutoDetail(null)} />}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================
function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-400">
      <span>{label}:</span>
      {children}
    </label>
  );
}

function KpiCard({ label, value, target, sem, icon: Icon }: { label: string; value: string; target: string; sem: "g" | "y" | "r"; icon: any }) {
  return (
    <div className={`p-3 rounded-lg border ${semBg(sem)}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        <Icon className={`w-3.5 h-3.5 ${semColor(sem)}`} />
      </div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] text-slate-500">Meta: {target}</div>
    </div>
  );
}

// --- TAB: VISÃO GERAL ---
function VisaoGeralTab({ rows, allRows }: { rows: B2BRow[]; allRows: B2BRow[] }) {
  // Chart 1: Receita MoM (use allRows for full history of last 12 months)
  const mom = useMemo(() => {
    const map = new Map<string, { mes: string; receita: number; lucro: number; custo: number }>();
    allRows.forEach(r => {
      const k = monthKey(r.data);
      if (!k) return;
      const cur = map.get(k) || { mes: k, receita: 0, lucro: 0, custo: 0 };
      cur.receita += r.valor_total;
      cur.lucro += r.lucro_liquido;
      cur.custo += r.custo_total;
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-12);
  }, [allRows]);

  // Chart 2: Margem por produto
  const margemProd = useMemo(() => {
    const map = new Map<string, { sku: string; valor: number; margem: number }>();
    rows.forEach(r => {
      if (!r.sku) return;
      const cur = map.get(r.sku) || { sku: r.sku, valor: 0, margem: 0 };
      cur.valor += r.valor_total;
      cur.margem += r.margem;
      map.set(r.sku, cur);
    });
    return Array.from(map.values())
      .map(x => ({ sku: x.sku, margemPct: x.valor > 0 ? (x.margem / x.valor) * 100 : 0 }))
      .sort((a, b) => b.margemPct - a.margemPct)
      .slice(0, 10);
  }, [rows]);

  // Chart 3: Receita por estado
  const receitaEstado = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(r => {
      if (!r.estado) return;
      map.set(r.estado, (map.get(r.estado) || 0) + r.valor_total);
    });
    return Array.from(map.entries()).map(([estado, valor]) => ({ estado, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [rows]);

  // Chart 4: Semanal últimas 12 semanas
  const semanal = useMemo(() => {
    const map = new Map<string, { semana: string; receita: number; pedidos: number }>();
    allRows.forEach(r => {
      const k = weekKey(r.data);
      if (!k) return;
      const cur = map.get(k) || { semana: k, receita: 0, pedidos: 0 };
      cur.receita += r.valor_total;
      cur.pedidos += 1;
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.semana.localeCompare(b.semana)).slice(-12);
  }, [allRows]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title="Receita MoM (últimos 12 meses)">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={mom}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="mes" stroke="#94a3b8" fontSize={11} />
            <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} formatter={(v: any) => BRL(Number(v))} />
            <Legend />
            <Bar dataKey="receita" name="Receita" fill="#3b82f6" />
            <Bar dataKey="lucro" name="Lucro líquido" fill="#10b981" />
            <Line type="monotone" dataKey="custo" name="Custo" stroke="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Margem por produto (top 10)">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={margemProd} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis type="number" stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${v.toFixed(0)}%`} />
            <YAxis dataKey="sku" type="category" stroke="#94a3b8" fontSize={10} width={120} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} formatter={(v: any) => PCT(Number(v))} />
            <Bar dataKey="margemPct" name="Margem %">
              {margemProd.map((entry, i) => (
                <Cell key={i} fill={entry.margemPct >= 45 ? "#10b981" : entry.margemPct >= 30 ? "#eab308" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Receita por estado (top 10)">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={receitaEstado} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis type="number" stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <YAxis dataKey="estado" type="category" stroke="#94a3b8" fontSize={11} width={110} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} formatter={(v: any) => BRL(Number(v))} />
            <Bar dataKey="valor" name="Receita" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Evolução semanal (últimas 12 semanas)">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={semanal}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="semana" stroke="#94a3b8" fontSize={10} />
            <YAxis yAxisId="left" stroke="#3b82f6" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <YAxis yAxisId="right" orientation="right" stroke="#a855f7" fontSize={11} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="receita" name="Receita" stroke="#3b82f6" />
            <Line yAxisId="right" type="monotone" dataKey="pedidos" name="Pedidos" stroke="#a855f7" />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// --- TAB: CLIENTES ---
function ClientesTab({ rows, onOpen }: { rows: B2BRow[]; onOpen: (c: string) => void }) {
  const clientes = useMemo(() => {
    const map = new Map<string, {
      cliente: string; cnpj: string; cidade: string; estado: string;
      pedidos: number; receita: number; margem: number; ultimo: string; vendedor: string;
    }>();
    rows.forEach(r => {
      const k = r.cliente || r.cnpj || "—";
      const cur = map.get(k) || { cliente: r.cliente, cnpj: r.cnpj, cidade: r.cidade, estado: r.estado, pedidos: 0, receita: 0, margem: 0, ultimo: "", vendedor: r.vendedor };
      cur.pedidos += 1;
      cur.receita += r.valor_total;
      cur.margem += r.margem;
      if (r.data > cur.ultimo) cur.ultimo = r.data;
      map.set(k, cur);
    });
    return Array.from(map.values())
      .map(c => ({
        ...c,
        ticket: c.pedidos ? c.receita / c.pedidos : 0,
        margemPct: c.receita > 0 ? (c.margem / c.receita) * 100 : 0,
        status: daysAgo(c.ultimo) <= 30 ? "ativo" : daysAgo(c.ultimo) <= 60 ? "risco" : "inativo",
      }))
      .sort((a, b) => b.receita - a.receita);
  }, [rows]);

  const ativos = clientes.filter(c => c.status === "ativo").length;
  const risco = clientes.filter(c => c.status === "risco").length;
  const inativos = clientes.filter(c => c.status === "inativo").length;
  const totalReceita = clientes.reduce((s, c) => s + c.receita, 0);
  const ltv = clientes.length ? totalReceita / clientes.length : 0;

  // Top 5 vs outros
  const top5 = clientes.slice(0, 5);
  const top5Sum = top5.reduce((s, c) => s + c.receita, 0);
  const outros = totalReceita - top5Sum;
  const donutData = [
    ...top5.map(c => ({ name: c.cliente, value: c.receita })),
    { name: "Outros", value: outros },
  ];
  const palette = ["#3b82f6", "#10b981", "#a855f7", "#eab308", "#ef4444", "#64748b"];

  // Concentration alert
  const topShare = totalReceita ? (clientes[0]?.receita || 0) / totalReceita * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MiniCard label="Total clientes" value={NUM(clientes.length)} />
        <MiniCard label="Ativos (30d)" value={NUM(ativos)} tone="g" />
        <MiniCard label="Em risco (31-60d)" value={NUM(risco)} tone="y" />
        <MiniCard label="Inativos (>60d)" value={NUM(inativos)} tone="r" />
        <MiniCard label="LTV médio" value={BRL(ltv)} />
        <MiniCard label="Top cliente %" value={`${topShare.toFixed(1)}%`} tone={topShare > 30 ? "r" : "g"} />
      </div>

      {topShare > 30 && clientes[0] && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-sm text-amber-200">
            <b>{clientes[0].cliente}</b> representa {topShare.toFixed(1)}% da receita B2B — risco de concentração
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Distribuição de receita (top 5 vs outros)">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100}>
                {donutData.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} formatter={(v: any) => BRL(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <div className="lg:col-span-2">
          <Card title={`Clientes (${clientes.length})`}>
            <div className="overflow-auto max-h-[420px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-900 text-slate-400">
                  <tr>
                    <th className="text-left p-2">Cliente</th>
                    <th className="text-left p-2">CNPJ</th>
                    <th className="text-left p-2">Local</th>
                    <th className="text-right p-2">Pedidos</th>
                    <th className="text-right p-2">Receita</th>
                    <th className="text-right p-2">Ticket</th>
                    <th className="text-right p-2">Margem</th>
                    <th className="text-left p-2">Último</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.slice(0, 100).map((c, i) => (
                    <tr key={i} onClick={() => onOpen(c.cliente)} className="border-t border-slate-800 hover:bg-slate-800/50 cursor-pointer">
                      <td className="p-2 font-medium">{c.cliente}</td>
                      <td className="p-2 text-slate-400">{c.cnpj}</td>
                      <td className="p-2 text-slate-400">{c.cidade}/{c.estado}</td>
                      <td className="p-2 text-right">{c.pedidos}</td>
                      <td className="p-2 text-right">{BRL(c.receita)}</td>
                      <td className="p-2 text-right">{BRL(c.ticket)}</td>
                      <td className="p-2 text-right">{PCT(c.margemPct)}</td>
                      <td className="p-2">{DT(c.ultimo)}</td>
                      <td className="p-2">
                        <span className={c.status === "ativo" ? "text-emerald-400" : c.status === "risco" ? "text-amber-400" : "text-rose-400"}>
                          {c.status === "ativo" ? "🟢 Ativo" : c.status === "risco" ? "🟡 Risco" : "🔴 Inativo"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// --- TAB: PRODUTOS ---
function ProdutosTab({ rows, allRows, onOpen }: { rows: B2BRow[]; allRows: B2BRow[]; onOpen: (sku: string) => void }) {
  const produtos = useMemo(() => {
    const map = new Map<string, { produto: string; sku: string; unidades: number; receita: number; custo: number; pedidos: number }>();
    rows.forEach(r => {
      if (!r.sku) return;
      const cur = map.get(r.sku) || { produto: r.produto, sku: r.sku, unidades: 0, receita: 0, custo: 0, pedidos: 0 };
      cur.unidades += r.quantidade;
      cur.receita += r.valor_total;
      cur.custo += r.custo_total;
      cur.pedidos += 1;
      map.set(r.sku, cur);
    });
    return Array.from(map.values()).map(p => ({
      ...p,
      margemRS: p.receita - p.custo,
      margemPct: p.receita > 0 ? ((p.receita - p.custo) / p.receita) * 100 : 0,
      ticket: p.pedidos ? p.receita / p.pedidos : 0,
    })).sort((a, b) => b.receita - a.receita);
  }, [rows]);

  const maisVendido = produtos.length ? [...produtos].sort((a, b) => b.unidades - a.unidades)[0] : null;
  const maisLucrativo = produtos.length ? [...produtos].sort((a, b) => b.margemRS - a.margemRS)[0] : null;
  const maiorMargemPct = produtos.length ? [...produtos].sort((a, b) => b.margemPct - a.margemPct)[0] : null;

  // MoM: produto em queda
  const now = new Date();
  const curK = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevK = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  const prodMoM = new Map<string, { cur: number; prev: number }>();
  allRows.forEach(r => {
    const k = monthKey(r.data);
    if (!r.sku || (k !== curK && k !== prevK)) return;
    const cur = prodMoM.get(r.sku) || { cur: 0, prev: 0 };
    if (k === curK) cur.cur += r.valor_total; else cur.prev += r.valor_total;
    prodMoM.set(r.sku, cur);
  });
  let emQueda: { sku: string; drop: number } | null = null;
  prodMoM.forEach((v, sku) => {
    if (v.prev > 0) {
      const drop = ((v.cur - v.prev) / v.prev) * 100;
      const cur = emQueda;
      if (drop < 0 && (!cur || drop < cur.drop)) emQueda = { sku, drop };
    }
  });

  const palette = ["#3b82f6", "#10b981", "#a855f7", "#eab308", "#ef4444", "#06b6d4", "#f97316", "#ec4899"];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniCard label="Mais vendido" value={maisVendido?.sku || "—"} sub={maisVendido ? `${NUM(maisVendido.unidades)} un` : ""} />
        <MiniCard label="Mais lucrativo" value={maisLucrativo?.sku || "—"} sub={maisLucrativo ? BRL(maisLucrativo.margemRS) : ""} />
        <MiniCard label="Maior margem %" value={maiorMargemPct?.sku || "—"} sub={maiorMargemPct ? PCT(maiorMargemPct.margemPct) : ""} />
        {(() => { const eq = emQueda as { sku: string; drop: number } | null; return (
          <MiniCard label="Em queda (MoM)" value={eq?.sku || "—"} sub={eq ? `${eq.drop.toFixed(1)}%` : ""} tone={eq ? "r" : "g"} />
        ); })()}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Mix de produtos (% receita)">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={produtos.slice(0, 8).map(p => ({ name: p.sku, value: p.receita }))} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={110}>
                {produtos.slice(0, 8).map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} formatter={(v: any) => BRL(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Margem por produto (R$)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={produtos.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <YAxis dataKey="sku" type="category" stroke="#94a3b8" fontSize={10} width={120} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} formatter={(v: any) => BRL(Number(v))} />
              <Bar dataKey="margemRS" name="Margem R$" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title={`Performance por SKU (${produtos.length})`}>
        <div className="overflow-auto max-h-[400px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-900 text-slate-400">
              <tr>
                <th className="text-left p-2">Produto</th>
                <th className="text-left p-2">SKU</th>
                <th className="text-right p-2">Unidades</th>
                <th className="text-right p-2">Receita</th>
                <th className="text-right p-2">Custo</th>
                <th className="text-right p-2">Margem R$</th>
                <th className="text-right p-2">Margem %</th>
                <th className="text-right p-2">Ticket</th>
                <th className="text-right p-2">Pedidos</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p, i) => (
                <tr key={i} onClick={() => onOpen(p.sku)} className="border-t border-slate-800 hover:bg-slate-800/50 cursor-pointer">
                  <td className="p-2">{p.produto}</td>
                  <td className="p-2 font-medium">{p.sku}</td>
                  <td className="p-2 text-right">{NUM(p.unidades)}</td>
                  <td className="p-2 text-right">{BRL(p.receita)}</td>
                  <td className="p-2 text-right">{BRL(p.custo)}</td>
                  <td className="p-2 text-right">{BRL(p.margemRS)}</td>
                  <td className={`p-2 text-right ${semColor(semaforo(p.margemPct, 45, true))}`}>{PCT(p.margemPct)}</td>
                  <td className="p-2 text-right">{BRL(p.ticket)}</td>
                  <td className="p-2 text-right">{p.pedidos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// --- TAB: VENDEDORES ---
function VendedoresTab({ rows, allRows }: { rows: B2BRow[]; allRows: B2BRow[] }) {
  const [metas, setMetas] = useState<Record<string, number>>({});

  const vendedores = useMemo(() => {
    const map = new Map<string, { vendedor: string; pedidos: number; receita: number; margem: number }>();
    rows.forEach(r => {
      if (!r.vendedor) return;
      const cur = map.get(r.vendedor) || { vendedor: r.vendedor, pedidos: 0, receita: 0, margem: 0 };
      cur.pedidos += 1;
      cur.receita += r.valor_total;
      cur.margem += r.margem;
      map.set(r.vendedor, cur);
    });
    return Array.from(map.values()).map(v => ({
      ...v,
      ticket: v.pedidos ? v.receita / v.pedidos : 0,
      margemPct: v.receita > 0 ? (v.margem / v.receita) * 100 : 0,
      meta: metas[v.vendedor] || 100000,
    })).sort((a, b) => b.receita - a.receita);
  }, [rows, metas]);

  // Evolução 6 meses por vendedor
  const evo = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const map = new Map<string, Record<string, number>>();
    months.forEach(m => map.set(m, { mes: m } as any));
    allRows.forEach(r => {
      const k = monthKey(r.data);
      if (!months.includes(k) || !r.vendedor) return;
      const row: any = map.get(k)!;
      row[r.vendedor] = (row[r.vendedor] || 0) + r.valor_total;
    });
    return Array.from(map.values()) as any[];
  }, [allRows]);

  const allVend = Array.from(new Set(allRows.map(r => r.vendedor).filter(Boolean)));
  const palette = ["#3b82f6", "#10b981", "#a855f7", "#eab308", "#ef4444", "#06b6d4"];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {vendedores.map(v => {
          const pct = v.meta ? (v.receita / v.meta) * 100 : 0;
          const sem = semaforo(pct, 100, true);
          return (
            <div key={v.vendedor} className={`p-4 rounded-lg border ${semBg(sem)}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold">{v.vendedor}</h3>
                <span className={`text-sm font-bold ${semColor(sem)}`}>{pct.toFixed(0)}%</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><div className="text-slate-400">Pedidos</div><div className="font-bold">{v.pedidos}</div></div>
                <div><div className="text-slate-400">Receita</div><div className="font-bold">{BRL(v.receita)}</div></div>
                <div><div className="text-slate-400">Ticket médio</div><div className="font-bold">{BRL(v.ticket)}</div></div>
                <div><div className="text-slate-400">Margem</div><div className="font-bold">{PCT(v.margemPct)}</div></div>
              </div>
              <div className="mt-2">
                <label className="text-[10px] text-slate-400">Meta R$</label>
                <input
                  type="number"
                  value={v.meta}
                  onChange={(e) => setMetas(m => ({ ...m, [v.vendedor]: Number(e.target.value) }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs mt-1"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Ranking por receita">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={vendedores} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <YAxis dataKey="vendedor" type="category" stroke="#94a3b8" fontSize={11} width={100} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} formatter={(v: any) => BRL(Number(v))} />
              <Bar dataKey="receita" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Evolução 6 meses">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={evo}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="mes" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} formatter={(v: any) => BRL(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {allVend.map((v, i) => <Line key={v} type="monotone" dataKey={v} stroke={palette[i % palette.length]} />)}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Tabela comparativa">
        <table className="w-full text-xs">
          <thead className="text-slate-400">
            <tr>
              <th className="text-left p-2">Vendedor</th>
              <th className="text-right p-2">Pedidos</th>
              <th className="text-right p-2">Receita</th>
              <th className="text-right p-2">Ticket médio</th>
              <th className="text-right p-2">Margem</th>
              <th className="text-right p-2">% Meta</th>
            </tr>
          </thead>
          <tbody>
            {vendedores.map(v => {
              const pct = v.meta ? (v.receita / v.meta) * 100 : 0;
              return (
                <tr key={v.vendedor} className="border-t border-slate-800">
                  <td className="p-2 font-medium">{v.vendedor}</td>
                  <td className="p-2 text-right">{v.pedidos}</td>
                  <td className="p-2 text-right">{BRL(v.receita)}</td>
                  <td className="p-2 text-right">{BRL(v.ticket)}</td>
                  <td className="p-2 text-right">{PCT(v.margemPct)}</td>
                  <td className={`p-2 text-right ${semColor(semaforo(pct, 100, true))}`}>{pct.toFixed(0)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// --- TAB: PEDIDOS ---
function PedidosTab({ rows }: { rows: B2BRow[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof B2BRow>("data");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const filtered = useMemo(() => {
    let f = rows;
    if (search) {
      const q = search.toLowerCase();
      f = f.filter(r => (r.cliente || "").toLowerCase().includes(q) || (r.cnpj || "").toLowerCase().includes(q));
    }
    return [...f].sort((a, b) => {
      const av = a[sortKey] as any;
      const bv = b[sortKey] as any;
      if (typeof av === "number" && typeof bv === "number") return sortDesc ? bv - av : av - bv;
      return sortDesc ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
    });
  }, [rows, search, sortKey, sortDesc]);

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const exportCSV = () => {
    const headers = ["Data", "Cliente", "CNPJ", "Produto", "SKU", "Qtd", "Valor", "Custo", "Frete", "Fulfillment", "Margem R$", "Margem %", "Vendedor", "Cidade", "Estado"];
    const lines = [headers.join(",")];
    filtered.forEach(r => {
      lines.push([
        DT(r.data), `"${r.cliente}"`, r.cnpj, `"${r.produto}"`, r.sku, r.quantidade,
        r.valor_total.toFixed(2), r.custo_total.toFixed(2), r.frete.toFixed(2), r.fulfillment.toFixed(2),
        r.margem.toFixed(2), r.margem_pct.toFixed(2), r.vendedor, r.cidade, r.estado,
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `pedidos_b2b_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const sortBy = (k: keyof B2BRow) => {
    if (sortKey === k) setSortDesc(!sortDesc);
    else { setSortKey(k); setSortDesc(true); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-2 top-2.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar por cliente ou CNPJ"
            className="w-full bg-slate-900 border border-slate-800 rounded px-8 py-2 text-sm"
          />
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      <Card title={`${filtered.length} pedidos`}>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-400">
              <tr>
                {([
                  ["data", "Data"], ["cliente", "Cliente"], ["produto", "Produto"], ["sku", "SKU"],
                  ["quantidade", "Qtd"], ["valor_total", "Valor"], ["custo_total", "Custo"],
                  ["frete", "Frete"], ["fulfillment", "Fulfillment"], ["margem", "Margem R$"],
                  ["margem_pct", "Margem %"], ["vendedor", "Vendedor"], ["cidade", "Cidade"], ["estado", "UF"],
                ] as [keyof B2BRow, string][]).map(([k, label]) => (
                  <th key={k} className="text-left p-2 cursor-pointer hover:text-slate-200" onClick={() => sortBy(k)}>
                    {label} {sortKey === k ? (sortDesc ? "↓" : "↑") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((r, i) => (
                <tr key={i} className={`border-t border-slate-800 hover:bg-slate-800/50 ${r.margem_pct < 20 ? "text-rose-400" : ""}`}>
                  <td className="p-2">{DT(r.data)}</td>
                  <td className="p-2">{r.cliente}</td>
                  <td className="p-2">{r.produto}</td>
                  <td className="p-2">{r.sku}</td>
                  <td className="p-2">{r.quantidade}</td>
                  <td className="p-2">{BRL(r.valor_total)}</td>
                  <td className="p-2">{BRL(r.custo_total)}</td>
                  <td className="p-2">{BRL(r.frete)}</td>
                  <td className="p-2">{BRL(r.fulfillment)}</td>
                  <td className="p-2">{BRL(r.margem)}</td>
                  <td className="p-2">{PCT(r.margem_pct)}</td>
                  <td className="p-2">{r.vendedor}</td>
                  <td className="p-2">{r.cidade}</td>
                  <td className="p-2">{r.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
            <span>Página {page + 1} de {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1 bg-slate-800 rounded disabled:opacity-30">‹</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="px-3 py-1 bg-slate-800 rounded disabled:opacity-30">›</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// --- Helpers UI ---
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
      <h3 className="text-sm font-bold mb-3 text-slate-200">{title}</h3>
      {children}
    </div>
  );
}

function MiniCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "g" | "y" | "r" }) {
  return (
    <div className={`p-3 rounded-lg border ${tone ? semBg(tone) : "bg-slate-900/50 border-slate-800"}`}>
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-lg font-bold ${tone ? semColor(tone) : ""}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

// --- Side panels ---
function ClienteDetailPanel({ cliente, rows, onClose }: { cliente: string; rows: B2BRow[]; onClose: () => void }) {
  const clientRows = rows.filter(r => r.cliente === cliente).sort((a, b) => b.data.localeCompare(a.data));
  const total = clientRows.reduce((s, r) => s + r.valor_total, 0);
  const margemTotal = clientRows.reduce((s, r) => s + r.margem, 0);
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-2xl bg-slate-950 border-l border-slate-800 p-5 overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{cliente}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <MiniCard label="Pedidos" value={NUM(clientRows.length)} />
          <MiniCard label="Receita" value={BRL(total)} />
          <MiniCard label="Margem" value={PCT(total > 0 ? margemTotal / total * 100 : 0)} />
        </div>
        <table className="w-full text-xs">
          <thead className="text-slate-400"><tr>
            <th className="text-left p-2">Data</th>
            <th className="text-left p-2">Produto</th>
            <th className="text-right p-2">Qtd</th>
            <th className="text-right p-2">Valor</th>
            <th className="text-right p-2">Margem %</th>
          </tr></thead>
          <tbody>
            {clientRows.map((r, i) => (
              <tr key={i} className="border-t border-slate-800">
                <td className="p-2">{DT(r.data)}</td>
                <td className="p-2">{r.produto}</td>
                <td className="p-2 text-right">{r.quantidade}</td>
                <td className="p-2 text-right">{BRL(r.valor_total)}</td>
                <td className="p-2 text-right">{PCT(r.margem_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProdutoDetailPanel({ sku, rows, onClose }: { sku: string; rows: B2BRow[]; onClose: () => void }) {
  const skuRows = rows.filter(r => r.sku === sku);
  const total = skuRows.reduce((s, r) => s + r.valor_total, 0);
  const unidades = skuRows.reduce((s, r) => s + r.quantidade, 0);
  const margem = skuRows.reduce((s, r) => s + r.margem, 0);
  const clientes = new Set(skuRows.map(r => r.cliente)).size;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-xl bg-slate-950 border-l border-slate-800 p-5 overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{sku}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <MiniCard label="Unidades" value={NUM(unidades)} />
          <MiniCard label="Receita" value={BRL(total)} />
          <MiniCard label="Margem" value={PCT(total > 0 ? margem / total * 100 : 0)} />
          <MiniCard label="Clientes únicos" value={NUM(clientes)} />
        </div>
      </div>
    </div>
  );
}

export default B2BDashboard;

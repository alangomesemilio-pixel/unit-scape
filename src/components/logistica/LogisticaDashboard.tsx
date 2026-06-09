import { useEffect, useMemo, useState } from "react";
import {
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Boxes,
  AlertTriangle,
  Plus,
  Trash2,
  Gauge,
  Clock,
  Undo2,
  DollarSign,
  Settings,
  X,
  PlugZap,
  ExternalLink,
  Pause,
  Cog,
  Send,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getMelonnOrders,
  getMelonnInventory,
  getMelonnMetrics,
  getMelonnConfig,
  saveMelonnConfig,
  testMelonnEndpoint,
  melonnStatusLabel,
  MELONN_STATUSES,
  MELONN_WAREHOUSES,
  type MelonnOrder,
  type MelonnInventoryItem,
  type MelonnMetrics,
  type MelonnOrderStatus,
  type MelonnConfig,
} from "@/lib/melonn.functions";

type Material = {
  id: string;
  material: string;
  quantidade_atual: number;
  minimo: number;
  unidade: string;
  ordem: number;
};

const STATUS_META: Record<MelonnOrderStatus, { icon: typeof Package; color: string }> = {
  picking:    { icon: Package,      color: "#eab308" }, // 🟡
  processing: { icon: Cog,          color: "#f97316" }, // 🟠
  ready:      { icon: Send,         color: "#3b82f6" }, // 🔵
  in_transit: { icon: Truck,        color: "var(--soma-coral)" },
  delivered:  { icon: CheckCircle2, color: "#10b981" }, // 🟢
  on_hold:    { icon: Pause,        color: "#94a3b8" }, // ⏸️
  cancelled:  { icon: XCircle,      color: "#ef4444" }, // 🔴
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${className}`}>{children}</div>
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

export function LogisticaDashboard() {
  const [orders, setOrders] = useState<MelonnOrder[]>([]);
  const [ordersErr, setOrdersErr] = useState<string | undefined>();
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [inventory, setInventory] = useState<MelonnInventoryItem[]>([]);
  const [inventoryErr, setInventoryErr] = useState<string | undefined>();
  const [loadingInv, setLoadingInv] = useState(true);
  const [invFilter, setInvFilter] = useState<string>("all");

  const [metrics, setMetrics] = useState<MelonnMetrics | null>(null);
  const [metricsErr, setMetricsErr] = useState<string | undefined>();

  const [materials, setMaterials] = useState<Material[]>([]);
  const [loadingMat, setLoadingMat] = useState(true);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeWarehouses, setActiveWarehouses] = useState<string[]>(["MED-3", "BOG-2"]);

  async function refreshOrders() {
    setLoadingOrders(true);
    const r = await getMelonnOrders();
    setOrders(r.orders);
    setOrdersErr(r.error);
    setLoadingOrders(false);
  }
  async function refreshInventory() {
    setLoadingInv(true);
    const r = await getMelonnInventory();
    setInventory(r.items);
    setInventoryErr(r.error);
    setLoadingInv(false);
  }
  async function refreshMetrics() {
    const r = await getMelonnMetrics();
    setMetrics(r.metrics);
    setMetricsErr(r.error);
  }
  async function refreshMaterials() {
    setLoadingMat(true);
    const { data, error } = await supabase
      .from("packaging_materials")
      .select("*")
      .order("ordem", { ascending: true });
    if (error) toast.error(error.message);
    setMaterials((data as Material[]) ?? []);
    setLoadingMat(false);
  }

  useEffect(() => {
    getMelonnConfig().then((r) => setActiveWarehouses(r.config.warehouseCodes));
    refreshOrders();
    refreshInventory();
    refreshMetrics();
    refreshMaterials();
  }, []);

  const ordersByStatus = useMemo(() => {
    const map = {
      picking: 0, processing: 0, ready: 0, in_transit: 0,
      delivered: 0, cancelled: 0, on_hold: 0,
    } as Record<MelonnOrderStatus, number>;
    orders.forEach((o) => { map[o.status] = (map[o.status] ?? 0) + 1; });
    return map;
  }, [orders]);

  // Inventário filtrado + consolidação por SKU
  const filteredInventory = useMemo(() => {
    return invFilter === "all" ? inventory : inventory.filter((i) => i.warehouse === invFilter);
  }, [inventory, invFilter]);

  const consolidatedBySku = useMemo(() => {
    const map = new Map<string, { sku: string; product: string; available: number; reserved: number; total: number; warehouses: string[] }>();
    inventory.forEach((i) => {
      const cur = map.get(i.sku) ?? { sku: i.sku, product: i.product, available: 0, reserved: 0, total: 0, warehouses: [] };
      cur.available += i.available; cur.reserved += i.reserved; cur.total += i.total;
      if (!cur.warehouses.includes(i.warehouse)) cur.warehouses.push(i.warehouse);
      map.set(i.sku, cur);
    });
    return Array.from(map.values());
  }, [inventory]);

  async function updateMaterial(id: string, patch: Partial<Material>) {
    const { error } = await supabase.from("packaging_materials").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  async function addMaterial() {
    const nome = prompt("Nome do novo material:");
    if (!nome) return;
    const { data, error } = await supabase
      .from("packaging_materials")
      .insert({
        material: nome, quantidade_atual: 0, minimo: 0, unidade: "un",
        ordem: (materials[materials.length - 1]?.ordem ?? 0) + 1,
      })
      .select().single();
    if (error) { toast.error(error.message); return; }
    setMaterials((p) => [...p, data as Material]);
  }

  async function removeMaterial(id: string) {
    if (!confirm("Remover este material?")) return;
    const { error } = await supabase.from("packaging_materials").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setMaterials((p) => p.filter((m) => m.id !== id));
  }

  function inventoryAlertClass(available: number) {
    if (available < 50) return "text-red-500 font-semibold";
    if (available < 100) return "text-amber-500 font-semibold";
    return "text-foreground";
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8 bg-background">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logística</h1>
          <p className="text-sm text-muted-foreground">
            Integração Melonn · pedidos, estoque, materiais e métricas operacionais.
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <Warehouse className="size-3" />
            Bodegas ativas: {activeWarehouses.join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-sm hover:bg-secondary/80"
          >
            <Settings className="size-4" /> Configurações
          </button>
          <button
            onClick={() => { refreshOrders(); refreshInventory(); refreshMetrics(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-sm hover:bg-secondary/80"
          >
            <RefreshCw className="size-4" /> Atualizar Melonn
          </button>
        </div>
      </header>

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onSaved={(c) => setActiveWarehouses(c.warehouseCodes)}
        />
      )}

      {/* SEÇÃO 1 — PEDIDOS */}
      <section>
        <SectionTitle icon={Package} title="Status de pedidos" subtitle="Últimos 30 dias · /sell-orders" />
        {ordersErr && <div className="text-xs text-amber-500 mb-2">⚠️ {ordersErr}</div>}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-4">
          {MELONN_STATUSES.map((s) => {
            const meta = STATUS_META[s];
            const Icon = meta.icon;
            return (
              <Card key={s}>
                <div className="flex items-center justify-between mb-1">
                  <Icon className="size-4" style={{ color: meta.color }} />
                </div>
                <div className="text-2xl font-bold">{ordersByStatus[s]}</div>
                <div className="text-[11px] text-muted-foreground">{melonnStatusLabel(s)}</div>
              </Card>
            );
          })}
        </div>
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Pedido</th>
                  <th className="text-left px-3 py-2 font-medium">Cliente</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Transportadora</th>
                  <th className="text-left px-3 py-2 font-medium">Bodega</th>
                  <th className="text-left px-3 py-2 font-medium">Data</th>
                  <th className="text-left px-3 py-2 font-medium">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium">Rastreio</th>
                </tr>
              </thead>
              <tbody>
                {loadingOrders ? (
                  <tr><td colSpan={8} className="text-center text-muted-foreground py-6">Carregando…</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={8} className="text-center text-muted-foreground py-6">Nenhum pedido retornado.</td></tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">{o.number}</td>
                      <td className="px-3 py-2">{o.customer}</td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px]"
                          style={{
                            background: `${STATUS_META[o.status].color}22`,
                            color: STATUS_META[o.status].color,
                          }}
                        >
                          {melonnStatusLabel(o.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2">{o.carrier ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{o.warehouse ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {o.creation_date ? new Date(o.creation_date).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${o.is_b2b ? "bg-blue-500/15 text-blue-500" : "bg-secondary text-muted-foreground"}`}>
                          {o.is_b2b ? "B2B" : "B2C"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {o.tracking_link ? (
                          <a
                            href={o.tracking_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-mono"
                          >
                            {o.internal_number ?? "rastrear"}
                            <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          <span className="font-mono text-xs">{o.internal_number ?? "—"}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* SEÇÃO 2 — INVENTÁRIO */}
      <section>
        <SectionTitle
          icon={Boxes}
          title="Inventário em tempo real"
          subtitle="Alerta amarelo < 100 · alerta vermelho < 50"
        />
        {inventoryErr && <div className="text-xs text-amber-500 mb-2">⚠️ {inventoryErr}</div>}

        {/* Tabs de bodega */}
        <div className="flex items-center gap-1 mb-3">
          {[
            { id: "all", label: "Todos" },
            ...activeWarehouses.map((wh) => {
              const meta = MELONN_WAREHOUSES.find((w) => w.code === wh);
              return { id: wh, label: `${wh}${meta ? " · " + meta.name : ""}` };
            }),
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setInvFilter(t.id)}
              className={`px-3 py-1.5 text-xs rounded-md transition ${
                invFilter === t.id ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Produto</th>
                  <th className="text-left px-3 py-2 font-medium">SKU</th>
                  <th className="text-left px-3 py-2 font-medium">Bodega</th>
                  <th className="text-right px-3 py-2 font-medium">Disponível</th>
                  <th className="text-right px-3 py-2 font-medium">Reservado</th>
                  <th className="text-right px-3 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {loadingInv ? (
                  <tr><td colSpan={6} className="text-center text-muted-foreground py-6">Carregando…</td></tr>
                ) : filteredInventory.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-muted-foreground py-6">Sem dados de inventário.</td></tr>
                ) : (
                  filteredInventory.map((i, idx) => (
                    <tr key={`${i.warehouse}-${i.sku}-${idx}`} className="border-t border-border">
                      <td className="px-3 py-2">{i.product}</td>
                      <td className="px-3 py-2 font-mono text-xs">{i.sku}</td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary font-mono">{i.warehouse}</span>
                      </td>
                      <td className={`px-3 py-2 text-right ${inventoryAlertClass(i.available)}`}>{i.available}</td>
                      <td className="px-3 py-2 text-right">{i.reserved}</td>
                      <td className="px-3 py-2 text-right">{i.total}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Consolidado por SKU */}
        {invFilter === "all" && consolidatedBySku.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Consolidado por SKU (soma das bodegas)</h3>
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Produto</th>
                      <th className="text-left px-3 py-2 font-medium">SKU</th>
                      <th className="text-left px-3 py-2 font-medium">Bodegas</th>
                      <th className="text-right px-3 py-2 font-medium">Disp. total</th>
                      <th className="text-right px-3 py-2 font-medium">Res. total</th>
                      <th className="text-right px-3 py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidatedBySku.map((c) => (
                      <tr key={c.sku} className="border-t border-border">
                        <td className="px-3 py-2">{c.product}</td>
                        <td className="px-3 py-2 font-mono text-xs">{c.sku}</td>
                        <td className="px-3 py-2 text-[11px] font-mono">{c.warehouses.join(" + ")}</td>
                        <td className={`px-3 py-2 text-right ${inventoryAlertClass(c.available)}`}>{c.available}</td>
                        <td className="px-3 py-2 text-right">{c.reserved}</td>
                        <td className="px-3 py-2 text-right">{c.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </section>

      {/* SEÇÃO 3 — MATERIAIS */}
      <section>
        <SectionTitle
          icon={AlertTriangle}
          title="Materiais de embalagem"
          subtitle="Edite manualmente · alerta quando abaixo do mínimo"
        >
          <button
            onClick={addMaterial}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-secondary hover:bg-secondary/80"
          >
            <Plus className="size-3.5" /> Material
          </button>
        </SectionTitle>
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Material</th>
                  <th className="text-right px-3 py-2 font-medium w-32">Qtd. atual</th>
                  <th className="text-right px-3 py-2 font-medium w-28">Mínimo</th>
                  <th className="text-left px-3 py-2 font-medium w-24">Unidade</th>
                  <th className="text-left px-3 py-2 font-medium w-32">Status</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {loadingMat ? (
                  <tr><td colSpan={6} className="text-center text-muted-foreground py-6">Carregando…</td></tr>
                ) : (
                  materials.map((m) => {
                    const baixo = m.quantidade_atual < m.minimo;
                    return (
                      <tr key={m.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          <input
                            defaultValue={m.material}
                            onBlur={(e) =>
                              e.target.value !== m.material && updateMaterial(m.id, { material: e.target.value })
                            }
                            className="bg-transparent w-full focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number" min={0} defaultValue={m.quantidade_atual}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (v !== m.quantidade_atual) updateMaterial(m.id, { quantidade_atual: v });
                            }}
                            className={`bg-transparent w-24 text-right focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1 ${
                              baixo ? "text-red-500 font-semibold" : ""
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number" min={0} defaultValue={m.minimo}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (v !== m.minimo) updateMaterial(m.id, { minimo: v });
                            }}
                            className="bg-transparent w-20 text-right focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            defaultValue={m.unidade}
                            onBlur={(e) =>
                              e.target.value !== m.unidade && updateMaterial(m.id, { unidade: e.target.value })
                            }
                            className="bg-transparent w-16 focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1"
                          />
                        </td>
                        <td className="px-3 py-2">
                          {baixo ? (
                            <span className="inline-flex items-center gap-1 text-xs text-red-500">
                              <AlertTriangle className="size-3" /> Repor
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-500">OK</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button
                            onClick={() => removeMaterial(m.id)}
                            className="text-muted-foreground hover:text-red-500"
                            aria-label="Remover material"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* SEÇÃO 4 — MÉTRICAS */}
      <section>
        <SectionTitle icon={Gauge} title="Métricas operacionais" subtitle="Derivadas dos últimos 30 dias" />
        {metricsErr && <div className="text-xs text-amber-500 mb-2">⚠️ {metricsErr}</div>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            icon={Gauge} label="Taxa de entrega"
            value={metrics ? `${metrics.delivery_sla_pct.toFixed(1)}%` : "—"}
            goal="" ok={!!metrics && metrics.delivery_sla_pct >= 80}
          />
          <MetricCard
            icon={Clock} label="Tempo médio de separação"
            value={metrics ? `${metrics.avg_picking_minutes.toFixed(0)} min` : "—"}
            goal="" ok
          />
          <MetricCard
            icon={Undo2} label="Taxa de devolução"
            value={metrics ? `${metrics.return_rate_pct.toFixed(1)}%` : "—"}
            goal="Meta < 3%" ok={!!metrics && metrics.return_rate_pct < 3}
          />
          <MetricCard
            icon={DollarSign} label="Custo logístico/pedido"
            value={metrics ? metrics.cost_per_order.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
            goal="" ok
          />
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon, label, value, goal, ok,
}: { icon: any; label: string; value: string; goal: string; ok: boolean }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <Icon className="size-4 text-muted-foreground" />
        {goal && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${ok ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"}`}>
            {goal}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );
}

function SettingsModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved?: (cfg: MelonnConfig) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [defaults, setDefaults] = useState<MelonnConfig | null>(null);
  const [cfg, setCfg] = useState<MelonnConfig>({
    baseUrl: "",
    ordersPath: "",
    inventoryPath: "",
    couriersPath: "",
    warehouseCodes: [],
  });
  const [tests, setTests] = useState<Record<string, { ok?: boolean; msg?: string; loading?: boolean }>>({});

  useEffect(() => {
    getMelonnConfig().then((r) => {
      setCfg(r.config);
      setDefaults(r.defaults);
      setHasApiKey(r.hasApiKey);
      setLoading(false);
    });
  }, []);

  async function save() {
    setSaving(true);
    try {
      const r = await saveMelonnConfig({ data: cfg });
      setCfg(r.config);
      onSaved?.(r.config);
      toast.success("Configuração salva");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function test(endpoint: "orders" | "inventory" | "couriers") {
    setTests((t) => ({ ...t, [endpoint]: { loading: true } }));
    await saveMelonnConfig({ data: cfg }).catch(() => null);
    const r = await testMelonnEndpoint({ data: { endpoint } });
    setTests((t) => ({
      ...t,
      [endpoint]: r.ok
        ? { ok: true, msg: `OK · ${r.sample?.slice(0, 120)}…` }
        : { ok: false, msg: r.error },
    }));
  }

  function pathField(
    label: string,
    key: "baseUrl" | "ordersPath" | "inventoryPath" | "couriersPath",
    endpoint?: "orders" | "inventory" | "couriers",
  ) {
    const t = endpoint ? tests[endpoint] : undefined;
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
          <span>{label}</span>
          {defaults && (
            <button
              type="button"
              onClick={() => setCfg((c) => ({ ...c, [key]: defaults[key] as string }))}
              className="text-[10px] text-muted-foreground hover:text-foreground underline"
            >
              restaurar padrão
            </button>
          )}
        </label>
        <div className="flex gap-2">
          <input
            value={cfg[key] as string}
            onChange={(e) => setCfg((c) => ({ ...c, [key]: e.target.value }))}
            className="flex-1 px-3 py-2 rounded-md bg-secondary/40 border border-border text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          {endpoint && (
            <button
              type="button"
              onClick={() => test(endpoint)}
              disabled={t?.loading}
              className="flex items-center gap-1 px-2.5 text-xs rounded-md bg-secondary hover:bg-secondary/80 disabled:opacity-50"
            >
              <PlugZap className="size-3.5" /> Testar
            </button>
          )}
        </div>
        {t?.msg && (
          <div className={`text-[11px] ${t.ok ? "text-emerald-500" : "text-amber-500"}`}>{t.msg}</div>
        )}
        {defaults && (
          <div className="text-[10px] text-muted-foreground">
            padrão: <code>{defaults[key] as string}</code>
          </div>
        )}
      </div>
    );
  }

  function toggleWarehouse(code: string) {
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
            <p className="text-xs text-muted-foreground">
              Base URL, paths e bodegas ativas. As mudanças passam a valer no próximo fetch.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {!hasApiKey && (
            <div className="text-xs p-2 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/30">
              ⚠️ MELONN_API_KEY não está configurado. Adicione o secret no Lovable Cloud.
            </div>
          )}
          {loading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div>
          ) : (
            <>
              {pathField("Base URL", "baseUrl")}
              {pathField("Endpoint · Pedidos", "ordersPath", "orders")}
              {pathField("Endpoint · Estoque", "inventoryPath", "inventory")}
              {pathField("Endpoint · Transportadoras", "couriersPath", "couriers")}

              <div className="space-y-2 pt-2 border-t border-border">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Warehouse className="size-3.5" />
                  Bodegas ativas (warehouse_code) — selecione todas que devem ser consultadas
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MELONN_WAREHOUSES.map((w) => {
                    const active = cfg.warehouseCodes.includes(w.code);
                    return (
                      <button
                        key={w.code}
                        type="button"
                        onClick={() => toggleWarehouse(w.code)}
                        className={`flex items-center justify-between px-3 py-2 rounded-md border text-sm transition ${
                          active
                            ? "bg-primary/10 border-primary text-foreground"
                            : "bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/50"
                        }`}
                      >
                        <span className="font-mono text-xs">{w.code}</span>
                        <span className="text-[11px]">{w.name}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Selecionadas: <code>{cfg.warehouseCodes.join(", ") || "—"}</code> · padrão: <code>MED-3, BOG-2</code>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded-md hover:bg-secondary/60">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving || loading}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Salvar configurações"}
          </button>
        </div>
      </div>
    </div>
  );
}

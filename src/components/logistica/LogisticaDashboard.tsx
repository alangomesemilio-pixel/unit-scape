import { useEffect, useMemo, useState } from "react";
import {
  Package,
  Truck,
  CheckCircle2,
  RotateCcw,
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
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getMelonnOrders,
  getMelonnInventory,
  getMelonnMetrics,
  melonnStatusLabel,
  MELONN_STATUSES,
  type MelonnOrder,
  type MelonnInventoryItem,
  type MelonnMetrics,
  type MelonnOrderStatus,
} from "@/lib/melonn.functions";

type Material = {
  id: string;
  material: string;
  quantidade_atual: number;
  minimo: number;
  unidade: string;
  ordem: number;
};

const STATUS_META: Record<
  MelonnOrderStatus,
  { icon: typeof Package; color: string }
> = {
  picking: { icon: Package, color: "var(--soma-lavender)" },
  shipped: { icon: Truck, color: "var(--soma-coral)" },
  delivered: { icon: CheckCircle2, color: "#10b981" },
  returned: { icon: RotateCcw, color: "#f59e0b" },
  cancelled: { icon: XCircle, color: "#ef4444" },
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
  // ===== Pedidos =====
  const [orders, setOrders] = useState<MelonnOrder[]>([]);
  const [ordersErr, setOrdersErr] = useState<string | undefined>();
  const [loadingOrders, setLoadingOrders] = useState(true);

  // ===== Inventário =====
  const [inventory, setInventory] = useState<MelonnInventoryItem[]>([]);
  const [inventoryErr, setInventoryErr] = useState<string | undefined>();
  const [loadingInv, setLoadingInv] = useState(true);

  // ===== Métricas =====
  const [metrics, setMetrics] = useState<MelonnMetrics | null>(null);
  const [metricsErr, setMetricsErr] = useState<string | undefined>();

  // ===== Materiais =====
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loadingMat, setLoadingMat] = useState(true);

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
    refreshOrders();
    refreshInventory();
    refreshMetrics();
    refreshMaterials();
  }, []);

  const ordersByStatus = useMemo(() => {
    const map: Record<MelonnOrderStatus, number> = {
      picking: 0,
      shipped: 0,
      delivered: 0,
      returned: 0,
      cancelled: 0,
    };
    orders.forEach((o) => {
      map[o.status] = (map[o.status] ?? 0) + 1;
    });
    return map;
  }, [orders]);

  async function updateMaterial(id: string, patch: Partial<Material>) {
    const { error } = await supabase
      .from("packaging_materials")
      .update(patch)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  async function addMaterial() {
    const nome = prompt("Nome do novo material:");
    if (!nome) return;
    const { data, error } = await supabase
      .from("packaging_materials")
      .insert({
        material: nome,
        quantidade_atual: 0,
        minimo: 0,
        unidade: "un",
        ordem: (materials[materials.length - 1]?.ordem ?? 0) + 1,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setMaterials((p) => [...p, data as Material]);
  }

  async function removeMaterial(id: string) {
    if (!confirm("Remover este material?")) return;
    const { error } = await supabase.from("packaging_materials").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
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
        </div>
        <button
          onClick={() => {
            refreshOrders();
            refreshInventory();
            refreshMetrics();
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-sm hover:bg-secondary/80"
        >
          <RefreshCw className="size-4" />
          Atualizar Melonn
        </button>
      </header>

      {/* SEÇÃO 1 — STATUS DE PEDIDOS */}
      <section>
        <SectionTitle icon={Package} title="Status de pedidos" subtitle="Fonte: API Melonn" />
        {ordersErr && (
          <div className="text-xs text-amber-500 mb-2">⚠️ {ordersErr}</div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          {MELONN_STATUSES.map((s) => {
            const meta = STATUS_META[s];
            const Icon = meta.icon;
            return (
              <Card key={s}>
                <div className="flex items-center justify-between mb-1">
                  <Icon className="size-4" style={{ color: meta.color }} />
                </div>
                <div className="text-2xl font-bold">{ordersByStatus[s]}</div>
                <div className="text-xs text-muted-foreground">{melonnStatusLabel(s)}</div>
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
                  <th className="text-left px-3 py-2 font-medium">Prev. entrega</th>
                  <th className="text-left px-3 py-2 font-medium">Rastreio</th>
                </tr>
              </thead>
              <tbody>
                {loadingOrders ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted-foreground py-6">
                      Carregando…
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted-foreground py-6">
                      Nenhum pedido retornado.
                    </td>
                  </tr>
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
                      <td className="px-3 py-2">
                        {o.estimated_delivery
                          ? new Date(o.estimated_delivery).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{o.tracking_code ?? "—"}</td>
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
        {inventoryErr && (
          <div className="text-xs text-amber-500 mb-2">⚠️ {inventoryErr}</div>
        )}
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Produto</th>
                  <th className="text-left px-3 py-2 font-medium">SKU</th>
                  <th className="text-right px-3 py-2 font-medium">Disponível</th>
                  <th className="text-right px-3 py-2 font-medium">Reservado</th>
                  <th className="text-right px-3 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {loadingInv ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted-foreground py-6">
                      Carregando…
                    </td>
                  </tr>
                ) : inventory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted-foreground py-6">
                      Sem dados de inventário.
                    </td>
                  </tr>
                ) : (
                  inventory.map((i) => (
                    <tr key={i.sku} className="border-t border-border">
                      <td className="px-3 py-2">{i.product}</td>
                      <td className="px-3 py-2 font-mono text-xs">{i.sku}</td>
                      <td className={`px-3 py-2 text-right ${inventoryAlertClass(i.available)}`}>
                        {i.available}
                      </td>
                      <td className="px-3 py-2 text-right">{i.reserved}</td>
                      <td className="px-3 py-2 text-right">{i.total}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* SEÇÃO 3 — MATERIAIS DE EMBALAGEM */}
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
                  <tr>
                    <td colSpan={6} className="text-center text-muted-foreground py-6">
                      Carregando…
                    </td>
                  </tr>
                ) : (
                  materials.map((m) => {
                    const baixo = m.quantidade_atual < m.minimo;
                    return (
                      <tr key={m.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          <input
                            defaultValue={m.material}
                            onBlur={(e) =>
                              e.target.value !== m.material &&
                              updateMaterial(m.id, { material: e.target.value })
                            }
                            className="bg-transparent w-full focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            defaultValue={m.quantidade_atual}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (v !== m.quantidade_atual)
                                updateMaterial(m.id, { quantidade_atual: v });
                            }}
                            className={`bg-transparent w-24 text-right focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1 ${
                              baixo ? "text-red-500 font-semibold" : ""
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            defaultValue={m.minimo}
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
                              e.target.value !== m.unidade &&
                              updateMaterial(m.id, { unidade: e.target.value })
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

      {/* SEÇÃO 4 — MÉTRICAS OPERACIONAIS */}
      <section>
        <SectionTitle icon={Gauge} title="Métricas operacionais" subtitle="Fonte: API Melonn" />
        {metricsErr && (
          <div className="text-xs text-amber-500 mb-2">⚠️ {metricsErr}</div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            icon={Gauge}
            label="SLA de entrega"
            value={metrics ? `${metrics.delivery_sla_pct.toFixed(1)}%` : "—"}
            goal="Meta 98%"
            ok={!!metrics && metrics.delivery_sla_pct >= 98}
          />
          <MetricCard
            icon={Clock}
            label="Tempo médio de separação"
            value={metrics ? `${metrics.avg_picking_minutes.toFixed(0)} min` : "—"}
            goal=""
            ok={true}
          />
          <MetricCard
            icon={Undo2}
            label="Taxa de devolução"
            value={metrics ? `${metrics.return_rate_pct.toFixed(1)}%` : "—"}
            goal="Meta < 3%"
            ok={!!metrics && metrics.return_rate_pct < 3}
          />
          <MetricCard
            icon={DollarSign}
            label="Custo logístico/pedido"
            value={
              metrics
                ? metrics.cost_per_order.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })
                : "—"
            }
            goal=""
            ok={true}
          />
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  goal,
  ok,
}: {
  icon: any;
  label: string;
  value: string;
  goal: string;
  ok: boolean;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <Icon className="size-4 text-muted-foreground" />
        {goal && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              ok ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"
            }`}
          >
            {goal}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );
}

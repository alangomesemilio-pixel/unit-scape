import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  ReactFlowProvider,
  BackgroundVariant,
} from "reactflow";
import { OrgNode } from "./OrgNode";
import { NodeEditor } from "./NodeEditor";
import { initialNodes, initialEdges, type OrgNodeData } from "@/lib/org-data";
import { useServerFn } from "@tanstack/react-start";
import { getSomaKv, setSomaKv } from "@/lib/soma-store.functions";
import { Button } from "@/components/ui/button";
import { Plus, Presentation, Pencil, Download, Upload, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "grax-org-v1";
const KV_KEY = "org.state.v1";
const nodeTypes = { org: OrgNode };

interface SavedState {
  nodes: Node<OrgNodeData>[];
  edges: Edge[];
}

function loadSaved(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedState;
  } catch {
    return null;
  }
}

function Inner() {
  const saved = useMemo(() => loadSaved(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<OrgNodeData>(
    saved?.nodes ?? initialNodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(saved?.edges ?? initialEdges);
  const [editing, setEditing] = useState<Node<OrgNodeData> | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [saving, setSaving] = useState(false);
  const hydratedRef = useRef(false);

  const fetchKv = useServerFn(getSomaKv);
  const writeKv = useServerFn(setSomaKv);

  // hydrate from server (shared across users)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchKv({ data: { key: KV_KEY } });
        if (!cancelled && res?.value) {
          const v = res.value as unknown as SavedState;
          if (v.nodes && v.edges) {
            setNodes(v.nodes);
            setEdges(v.edges);
          }
        }
      } catch {
        // keep local fallback
      } finally {
        hydratedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchKv, setNodes, setEdges]);

  // autosave to localStorage (local draft)
  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
    }, 400);
    return () => clearTimeout(t);
  }, [nodes, edges]);

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, type: "smoothstep" }, eds)),
    [setEdges]
  );

  const handleNodeDoubleClick = useCallback((_: unknown, node: Node<OrgNodeData>) => {
    setEditing(node);
  }, []);

  const saveNode = (id: string, data: OrgNodeData) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data } : n)));
    toast.success("Cargo atualizado");
  };

  const deleteNode = (id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    toast.success("Cargo removido");
  };

  const addNode = () => {
    const id = `n-${Date.now()}`;
    const newNode: Node<OrgNodeData> = {
      id,
      type: "org",
      position: { x: 200, y: 200 },
      data: {
        name: "Novo cargo",
        role: "Cargo",
        level: "team",
        responsibilities: [],
        kpis: [],
      },
    };
    setNodes((ns) => [...ns, newNode]);
    setEditing(newNode);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "grax-organograma.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const parsed = JSON.parse(text) as SavedState;
        setNodes(parsed.nodes);
        setEdges(parsed.edges);
        toast.success("Estrutura importada");
      } catch {
        toast.error("Arquivo inválido");
      }
    };
    input.click();
  };

  const reset = () => {
    if (!confirm("Restaurar estrutura inicial? Suas edições serão perdidas.")) return;
    setNodes(initialNodes);
    setEdges(initialEdges);
    localStorage.removeItem(STORAGE_KEY);
  };

  const saveToServer = async () => {
    setSaving(true);
    try {
      await writeKv({ data: { key: KV_KEY, value: { nodes, edges } as unknown as Record<string, unknown> } });
      toast.success("Organograma salvo — visível para todos");
    } catch {
      toast.error("Falha ao salvar no servidor");
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className={`h-full w-full flex flex-col bg-background ${presenting ? "present-mode" : ""}`}>
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/50 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
            G
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">GRAx Group</h1>
            <p className="text-xs text-muted-foreground leading-tight">Organograma estratégico</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!presenting && (
            <>
              <Button variant="outline" size="sm" onClick={addNode}>
                <Plus className="size-4 mr-1" /> Cargo
              </Button>
              <Button variant="outline" size="sm" onClick={importJson}>
                <Upload className="size-4 mr-1" /> Importar
              </Button>
              <Button variant="outline" size="sm" onClick={exportJson}>
                <Download className="size-4 mr-1" /> Exportar
              </Button>
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="size-4 mr-1" /> Reset
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant={presenting ? "default" : "secondary"}
            onClick={() => setPresenting((p) => !p)}
          >
            {presenting ? <Pencil className="size-4 mr-1" /> : <Presentation className="size-4 mr-1" />}
            {presenting ? "Editar" : "Apresentar"}
          </Button>
        </div>
      </header>

      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={handleNodeDoubleClick}
          nodesDraggable={!presenting}
          nodesConnectable={!presenting}
          elementsSelectable
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.15}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="oklch(0.32 0.03 260)" />
          {!presenting && <Controls showInteractive={false} />}
          {!presenting && (
            <MiniMap
              pannable
              zoomable
              nodeColor={(n) => {
                const lvl = (n.data as OrgNodeData)?.level ?? "team";
                const map: Record<string, string> = {
                  ceo: "#e9b75c",
                  coo: "#5cc1e0",
                  intl: "#d27be0",
                  director: "#e8855a",
                  head: "#7bd09e",
                  team: "#6b6f87",
                };
                return map[lvl];
              }}
              maskColor="rgba(0,0,0,0.5)"
            />
          )}
        </ReactFlow>

        {!presenting && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur border border-border rounded-full px-4 py-2 text-xs text-muted-foreground shadow-lg">
            Clique duplo em um cargo para editar nome, responsabilidades e KPIs · Arraste para reposicionar · Conecte pelas alças
          </div>
        )}

        {/* Legend */}
        <div className="absolute top-4 left-4 bg-card/90 backdrop-blur border border-border rounded-lg p-3 text-xs space-y-1.5">
          <div className="font-semibold mb-1 text-foreground">Níveis</div>
          {[
            { l: "CEO / Direção", c: "var(--level-ceo)" },
            { l: "COO / Operações", c: "var(--level-coo)" },
            { l: "Internacional", c: "var(--level-intl)" },
            { l: "Diretor", c: "var(--level-director)" },
            { l: "Head", c: "var(--level-head)" },
            { l: "Time", c: "var(--level-team)" },
          ].map((i) => (
            <div key={i.l} className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2.5 rounded-full" style={{ background: i.c }} />
              {i.l}
            </div>
          ))}
        </div>
      </div>

      <NodeEditor
        node={editing}
        onClose={() => setEditing(null)}
        onSave={saveNode}
        onDelete={deleteNode}
      />
    </div>
  );
}

export function OrgChart() {
  return (
    <ReactFlowProvider>
      <Inner />
    </ReactFlowProvider>
  );
}

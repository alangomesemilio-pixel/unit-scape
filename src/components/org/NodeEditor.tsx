import { useEffect, useState } from "react";
import type { Node } from "reactflow";
import type { OrgNodeData, Level } from "@/lib/org-data";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

interface Props {
  node: Node<OrgNodeData> | null;
  onClose: () => void;
  onSave: (id: string, data: OrgNodeData) => void;
  onDelete: (id: string) => void;
}

export function NodeEditor({ node, onClose, onSave, onDelete }: Props) {
  const [data, setData] = useState<OrgNodeData | null>(null);

  useEffect(() => {
    setData(node ? { ...node.data } : null);
  }, [node]);

  if (!node || !data) return null;

  const update = (patch: Partial<OrgNodeData>) =>
    setData((d) => (d ? { ...d, ...patch } : d));

  const save = () => {
    onSave(node.id, data);
    onClose();
  };

  return (
    <Sheet open={!!node} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-card">
        <SheetHeader>
          <SheetTitle>Editar cargo</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={data.name} onChange={(e) => update({ name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Cargo</Label>
            <Input value={data.role} onChange={(e) => update({ role: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Área</Label>
            <Input value={data.area ?? ""} onChange={(e) => update({ area: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Nível</Label>
            <Select value={data.level} onValueChange={(v) => update({ level: v as Level })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ceo">CEO / Direção</SelectItem>
                <SelectItem value="coo">COO / Operações</SelectItem>
                <SelectItem value="intl">Internacional</SelectItem>
                <SelectItem value="head">Head / Diretor</SelectItem>
                <SelectItem value="team">Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reporta para</Label>
            <Input value={data.reportsTo ?? ""} onChange={(e) => update({ reportsTo: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Responsabilidades (uma por linha)</Label>
            <Textarea
              rows={6}
              value={data.responsibilities.join("\n")}
              onChange={(e) =>
                update({ responsibilities: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label className="text-primary">KPIs (um por linha)</Label>
            <Textarea
              rows={5}
              value={data.kpis.join("\n")}
              onChange={(e) =>
                update({ kpis: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })
              }
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={save} className="flex-1">Salvar</Button>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => { onDelete(node.id); onClose(); }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

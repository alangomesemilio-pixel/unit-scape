import { Handle, Position, type NodeProps } from "reactflow";
import { memo } from "react";
import type { OrgNodeData } from "@/lib/org-data";
import { cn } from "@/lib/utils";

const levelStyles: Record<OrgNodeData["level"], string> = {
  ceo: "border-[var(--level-ceo)] shadow-[0_0_0_1px_var(--level-ceo)]",
  coo: "border-[var(--level-coo)] shadow-[0_0_0_1px_var(--level-coo)]",
  intl: "border-[var(--level-intl)] shadow-[0_0_0_1px_var(--level-intl)]",
  head: "border-[var(--level-head)] shadow-[0_0_0_1px_var(--level-head)]",
  team: "border-[var(--level-team)]",
};

const levelDot: Record<OrgNodeData["level"], string> = {
  ceo: "bg-[var(--level-ceo)]",
  coo: "bg-[var(--level-coo)]",
  intl: "bg-[var(--level-intl)]",
  head: "bg-[var(--level-head)]",
  team: "bg-[var(--level-team)]",
};

function OrgNodeComp({ data, selected }: NodeProps<OrgNodeData>) {
  return (
    <div
      className={cn(
        "w-[240px] rounded-xl bg-card border-2 px-4 py-3 transition-all",
        levelStyles[data.level],
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <span className={cn("size-2 rounded-full", levelDot[data.level])} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {data.role}
        </span>
      </div>
      <div className="mt-1 text-base font-bold leading-tight text-foreground">
        {data.name}
      </div>
      {data.area && (
        <div className="text-xs text-muted-foreground mt-0.5">{data.area}</div>
      )}

      {(data.responsibilities.length > 0 || data.kpis.length > 0) && (
        <div className="mt-3 space-y-2">
          {data.responsibilities.length > 0 && (
            <div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Responsabilidades
              </div>
              <div className="flex flex-wrap gap-1">
                {data.responsibilities.slice(0, 4).map((r) => (
                  <span
                    key={r}
                    className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded"
                  >
                    {r}
                  </span>
                ))}
                {data.responsibilities.length > 4 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{data.responsibilities.length - 4}
                  </span>
                )}
              </div>
            </div>
          )}
          {data.kpis.length > 0 && (
            <div>
              <div className="text-[9px] uppercase tracking-wider text-primary font-semibold mb-1">
                KPIs
              </div>
              <div className="flex flex-wrap gap-1">
                {data.kpis.slice(0, 3).map((k) => (
                  <span
                    key={k}
                    className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-medium"
                  >
                    {k}
                  </span>
                ))}
                {data.kpis.length > 3 && (
                  <span className="text-[10px] text-primary/70">
                    +{data.kpis.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export const OrgNode = memo(OrgNodeComp);

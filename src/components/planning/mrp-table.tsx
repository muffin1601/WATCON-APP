"use client";

import { ClipboardList, History, MoreHorizontal, PackageSearch, Pencil, Plus, Truck, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DocStatusBadge, ToneBadge } from "@/components/commercial/ui";
import { SingleSelect } from "@/components/forms/combobox";
import { Field } from "@/components/forms/field";
import { ReserveStockButton, type LocationOpt, type PositionOpt, type ProjectOpt } from "@/components/inventory/location-ui";
import { FormDialog } from "@/components/shared/dialogs";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/call-action";
import { formatDate, formatQty, PRIORITY_LABELS } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { createPrFromMrpAction, saveRequirementAction, setRequirementStatusAction } from "@/modules/procurement/actions";
import type { MrpRow } from "@/modules/planning/service";

const num = "px-2 py-2 text-right tabular-nums whitespace-nowrap";
const FLAG_LABEL: Record<string, { label: string; tone: "bad" | "warn" }> = { DAMAGED: { label: "Damaged / rejected", tone: "bad" }, BELOW_REORDER: { label: "Below reorder level", tone: "warn" }, DUE_SOON: { label: "Due ≤ 7 days", tone: "warn" }, OVERDUE: { label: "Requirement overdue", tone: "bad" } };
const z = (v: string) => (v === "0" ? <span className="text-muted-foreground/50">—</span> : formatQty(v));

export type Caps = { canManage: boolean; canReserve: boolean; canRaisePr: boolean; canRfq: boolean; canPo: boolean; canTransfer: boolean };

export function MrpTable({ rows, caps, projects, positions, locations, showProject }: { rows: MrpRow[]; caps: Caps; projects: ProjectOpt[]; positions: PositionOpt[]; locations: LocationOpt[]; showProject: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState(false);
  const orderable = rows.filter((r) => r.toOrder !== "0");
  const selectedRows = rows.filter((r) => selected.includes(r.requirementId));
  const projectIds = [...new Set(selectedRows.map((r) => r.project.id))];

  async function raisePr() {
    if (projectIds.length !== 1) {
      toast.error("Select shortage lines of one project at a time.");
      return;
    }
    const res = await callAction(createPrFromMrpAction, { projectId: projectIds[0], requirementIds: selected });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Requisition ${res.data.number} created with the quantities still to order.`);
    setSelected([]);
    router.push(`/purchase-requisitions/${res.data.id}`);
  }

  if (!rows.length) return <EmptyState icon={PackageSearch} title="No material requirements" description="Add the materials this project needs (item, brand, quantity and date). Planning then shows stock, orders and shortages." />;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {caps.canRaisePr && (
          <>
            <Button size="sm" disabled={!selected.length} onClick={raisePr}>
              <ClipboardList /> Create requisition ({selected.length})
            </Button>
            <Button size="sm" variant="ghost" disabled={!orderable.length} onClick={() => setSelected(orderable.filter((r) => !showProject || r.project.id === orderable[0]!.project.id).map((r) => r.requirementId))}>
              Select lines to order
            </Button>
          </>
        )}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox checked={detail} onCheckedChange={(v) => setDetail(v === true)} /> Show all quantity columns
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              {caps.canRaisePr && <th className="w-8 px-2" />}
              {showProject && <th className="px-2 py-2 text-left font-medium">Project</th>}
              <th className="px-2 py-2 text-left font-medium">Item – brand</th>
              <th className="px-2 py-2 text-right font-medium">Required</th>
              <th className="px-2 py-2 text-right font-medium" title="Warehouse stock not reserved for any project">Free stock</th>
              <th className="px-2 py-2 text-right font-medium" title="Open reservations for this project">Reserved</th>
              <th className="px-2 py-2 text-right font-medium" title="Approved POs not yet accepted">Incoming</th>
              {detail && <th className="px-2 py-2 text-right font-medium">Physical</th>}
              {detail && <th className="px-2 py-2 text-right font-medium">Usable</th>}
              {detail && <th className="px-2 py-2 text-right font-medium" title="Reserved for other projects">Res. others</th>}
              {detail && <th className="px-2 py-2 text-right font-medium" title="Draft / pending-approval POs">PO pipeline</th>}
              <th className="px-2 py-2 text-right font-medium" title="Requisitioned, not yet ordered">Open PR</th>
              {detail && <th className="px-2 py-2 text-right font-medium">Issued</th>}
              {detail && <th className="px-2 py-2 text-right font-medium">In transit</th>}
              <th className="px-2 py-2 text-right font-medium">At site</th>
              {detail && <th className="px-2 py-2 text-right font-medium">Received</th>}
              <th className="px-2 py-2 text-right font-medium">Consumed</th>
              {detail && <th className="px-2 py-2 text-right font-medium">Returned</th>}
              {detail && <th className="px-2 py-2 text-right font-medium">Damaged</th>}
              <th className="px-2 py-2 text-right font-medium">Shortage</th>
              <th className="px-2 py-2 text-right font-medium">To order</th>
              <th className="px-2 py-2 text-left font-medium">Status</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.requirementId} className={cn("align-top", selected.includes(r.requirementId) && "bg-primary/[0.03]")}>
                {caps.canRaisePr && (
                  <td className="px-2 py-2.5">
                    <Checkbox aria-label={`Select ${r.item.name}`} disabled={r.toOrder === "0"} checked={selected.includes(r.requirementId)} onCheckedChange={(v) => setSelected((s) => (v === true ? [...s, r.requirementId] : s.filter((x) => x !== r.requirementId)))} />
                  </td>
                )}
                {showProject && (
                  <td className="px-2 py-2">
                    <Link href={`/projects/${r.project.id}?tab=materials`} className="font-mono text-xs hover:underline">
                      {r.project.code}
                    </Link>
                  </td>
                )}
                <td className="px-2 py-2">
                  <Link href={`/items/${r.item.id}`} className="font-medium hover:text-primary hover:underline">
                    {r.item.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {r.brand.name} · {r.item.code}
                    {r.preferredSupplier ? ` · ${r.preferredSupplier.name}` : ""}
                  </div>
                  {r.salesOrder && (
                    <Link href={`/sales-orders/${r.salesOrder.id}`} className="text-xs text-primary hover:underline">
                      From sales order {r.salesOrder.number}
                    </Link>
                  )}
                  {r.flags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.flags.map((f) => (
                        <ToneBadge key={f} tone={FLAG_LABEL[f]!.tone} className="px-1.5 py-0 text-[10px]">
                          {FLAG_LABEL[f]!.label}
                        </ToneBadge>
                      ))}
                    </div>
                  )}
                </td>
                <td className={num}>
                  {formatQty(r.requiredQty)} <span className="text-xs text-muted-foreground">{r.item.unit}</span>
                  <div className="text-xs text-muted-foreground">{r.requiredBy ? `by ${formatDate(r.requiredBy)}` : "no date"}</div>
                </td>
                <td className={num}>{z(r.freeStock)}</td>
                <td className={num}>{z(r.projectReserved)}</td>
                <td className={num}>
                  {z(r.incoming)}
                  {r.expectedDate && <div className={cn("text-xs", r.status === "DELAYED" ? "text-rose-700" : "text-muted-foreground")}>exp {formatDate(r.expectedDate)}</div>}
                </td>
                {detail && <td className={num}>{z(r.totalPhysical)}</td>}
                {detail && <td className={num}>{z(r.usable)}</td>}
                {detail && <td className={num}>{z(r.reservedForOthers)}</td>}
                {detail && <td className={num}>{z(r.poPipeline)}</td>}
                <td className={num}>{z(r.openPr)}</td>
                {detail && <td className={num}>{z(r.issuedToSite)}</td>}
                {detail && <td className={num}>{z(r.inTransit)}</td>}
                <td className={num}>{z(r.siteStock)}</td>
                {detail && <td className={num}>{z(r.receivedAtSite)}</td>}
                <td className={num}>{z(r.consumed)}</td>
                {detail && <td className={num}>{z(r.returned)}</td>}
                {detail && <td className={num}>{z(r.damagedRejected)}</td>}
                <td className={cn(num, r.shortage !== "0" && "font-medium text-rose-700")}>{z(r.shortage)}</td>
                <td className={cn(num, r.toOrder !== "0" && "font-semibold")}>
                  {z(r.toOrder)}
                  {r.estimatedCost && <div className="text-xs font-normal text-muted-foreground">≈ {formatINR(r.estimatedCost)}</div>}
                </td>
                <td className="px-2 py-2">
                  <DocStatusBadge status={r.status} />
                  <div className="mt-1 text-[11px] text-muted-foreground">{PRIORITY_LABELS[r.urgency] ?? r.urgency} urgency</div>
                </td>
                <td className="px-1 py-2">
                  <RowMenu r={r} caps={caps} projects={projects} positions={positions} locations={locations} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Shortage = required − (at site + in transit + consumed) − project reservations − approved incoming. To order = shortage − PO pipeline − open requisitions − free warehouse stock, so lines already covered are never ordered twice. Estimated cost uses the last purchase rate (before tax).
      </p>
    </div>
  );
}

function RowMenu({ r, caps, projects, positions, locations }: { r: MrpRow; caps: Caps; projects: ProjectOpt[]; positions: PositionOpt[]; locations: LocationOpt[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.item.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {caps.canTransfer && r.freeStock !== "0" && (
            <DropdownMenuItem asChild>
              <Link href={`/challans/new?type=ISSUE_TO_SITE&projectId=${r.project.id}&itemBrandId=${r.itemBrandId}&qty=${r.canReserveNow !== "0" ? r.canReserveNow : r.shortage}`}>
                <Truck /> Transfer available stock
              </Link>
            </DropdownMenuItem>
          )}
          {caps.canRfq && (
            <DropdownMenuItem asChild>
              <Link href={`/rate-enquiries/new?projectId=${r.project.id}&itemBrandId=${r.itemBrandId}&qty=${r.toOrder !== "0" ? r.toOrder : r.shortage}`}>
                <ClipboardList /> Request supplier rates
              </Link>
            </DropdownMenuItem>
          )}
          {caps.canPo && (
            <DropdownMenuItem asChild>
              <Link href={`/purchase-orders/new?projectId=${r.project.id}&itemBrandId=${r.itemBrandId}&qty=${r.toOrder !== "0" ? r.toOrder : r.shortage}`}>
                <Plus /> Create purchase order
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href={`/purchase-orders?projectId=${r.project.id}&q=${encodeURIComponent(r.item.name)}&pending=1`}>
              <Truck /> View related deliveries
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/stock?tab=ledger&itemId=${r.item.id}&brandId=${r.brand.id}`}>
              <History /> View stock ledger
            </Link>
          </DropdownMenuItem>
          {caps.canManage && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setEdit(true)}>
                <Pencil /> Edit requirement
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  const res = await callAction(setRequirementStatusAction, r.requirementId, r.reqStatus === "OPEN" ? "CLOSED" : "OPEN");
                  if (!res.ok) toast.error(res.error);
                  else {
                    toast.success(r.reqStatus === "OPEN" ? "Requirement closed." : "Requirement reopened.");
                    router.refresh();
                  }
                }}
              >
                <XCircle /> {r.reqStatus === "OPEN" ? "Close requirement" : "Reopen requirement"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {caps.canReserve && r.canReserveNow !== "0" && (
        <div className="mt-1">
          <ReserveStockButton projects={projects} positions={positions} locations={locations} presetProjectId={r.project.id} presetItemBrandId={r.itemBrandId} label={`Reserve ${formatQty(r.canReserveNow)}`} variant="ghost" />
        </div>
      )}
      {edit && <RequirementDialog open onOpenChange={setEdit} projects={projects} positions={positions} initial={{ projectId: r.project.id, itemBrandId: r.itemBrandId, requiredQty: r.requiredQty, requiredBy: r.requiredBy?.slice(0, 10) ?? "", priority: r.priority, notes: r.notes ?? "" }} />}
    </>
  );
}

type ReqInitial = { projectId: string | null; itemBrandId: string | null; requiredQty: string; requiredBy: string; priority: string; notes: string };

export function RequirementDialog({ projects, positions, initial, open, onOpenChange, trigger }: { projects: ProjectOpt[]; positions: PositionOpt[]; initial?: Partial<ReqInitial>; open?: boolean; onOpenChange?: (o: boolean) => void; trigger?: React.ReactNode }) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={initial?.itemBrandId ? "Edit material requirement" : "Add material requirement"} description="One line per item and brand for the project. Saving the same item–brand again updates it." trigger={trigger}>
      {(close) => <RequirementForm projects={projects} positions={positions} initial={initial} onDone={close} />}
    </FormDialog>
  );
}

function RequirementForm({ projects, positions, initial, onDone }: { projects: ProjectOpt[]; positions: PositionOpt[]; initial?: Partial<ReqInitial>; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState<ReqInitial>({ projectId: null, itemBrandId: null, requiredQty: "", requiredBy: "", priority: "MEDIUM", notes: "", ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const unit = positions.find((p) => p.id === v.itemBrandId)?.unit;
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await callAction(saveRequirementAction, v);
        setBusy(false);
        if (!res.ok) {
          setErrors(res.fieldErrors ?? {});
          toast.error(res.error);
          return;
        }
        toast.success("Requirement saved.");
        onDone();
        router.refresh();
      }}
    >
      <Field id="rq-project" label="Project" required error={errors.projectId}>
        <SingleSelect id="rq-project" options={projects.map((p) => ({ value: p.id, label: p.name, hint: p.code }))} value={v.projectId} onChange={(x) => setV({ ...v, projectId: x })} disabled={!!initial?.projectId} allowClear={false} />
      </Field>
      <Field id="rq-ib" label="Item – brand" required error={errors.itemBrandId} help="Each brand is planned separately. Add new brands to an item from the item page.">
        <SingleSelect id="rq-ib" options={positions.map((p) => ({ value: p.id, label: `${p.itemName} — ${p.brandName}`, hint: p.itemCode }))} value={v.itemBrandId} onChange={(x) => setV({ ...v, itemBrandId: x })} disabled={!!initial?.itemBrandId} allowClear={false} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="rq-qty" label={`Required qty${unit ? ` (${unit})` : ""}`} required error={errors.requiredQty}>
          <Input id="rq-qty" inputMode="decimal" value={v.requiredQty} onChange={(e) => setV({ ...v, requiredQty: e.target.value })} />
        </Field>
        <Field id="rq-date" label="Required by" error={errors.requiredBy}>
          <Input id="rq-date" type="date" value={v.requiredBy} onChange={(e) => setV({ ...v, requiredBy: e.target.value })} />
        </Field>
        <Field id="rq-pri" label="Priority">
          <Select value={v.priority} onValueChange={(x) => setV({ ...v, priority: x })}>
            <SelectTrigger id="rq-pri" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY_LABELS).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field id="rq-notes" label="Notes" error={errors.notes}>
        <Textarea id="rq-notes" rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          Save
        </Button>
      </div>
    </form>
  );
}


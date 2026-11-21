"use client";

import { Lock, MapPin, PackageMinus, Pencil, Plus, Undo2, Warehouse } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { DocStatusBadge, ToneBadge } from "@/components/commercial/ui";
import { SingleSelect, type ComboOption } from "@/components/forms/combobox";
import { Field } from "@/components/forms/field";
import { ConfirmDialog, FormDialog } from "@/components/shared/dialogs";
import { EmptyState } from "@/components/shared/states";
import { DataTable, type DataTableColumn } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/call-action";
import { formatDateTime, formatQty } from "@/lib/format";
import { newId } from "@/lib/utils";
import { createLocationAction, recordConsumptionAction, releaseReservationAction, reserveStockAction, reverseStockEntryAction, updateLocationAction } from "@/modules/inventory/location-actions";

const num = "text-right tabular-nums whitespace-nowrap";

export type PositionOpt = { id: string; itemCode: string; itemName: string; brandName: string; unit: string; currentQty: string };
export type LocationOpt = { id: string; code: string; name: string; type: string; projectId: string | null; status: string };
export type ProjectOpt = { id: string; code: string; name: string };

export const positionOptions = (p: PositionOpt[]): ComboOption[] => p.map((x) => ({ value: x.id, label: `${x.itemName} — ${x.brandName}`, hint: `${x.itemCode} · total ${formatQty(x.currentQty)} ${x.unit}` }));
const locationOptions = (l: LocationOpt[]): ComboOption[] => l.filter((x) => x.status === "ACTIVE" && (x.type === "WAREHOUSE" || x.type === "SITE")).map((x) => ({ value: x.id, label: x.name, hint: x.type === "SITE" ? "Site store" : "Warehouse" }));

/** Small helper for server-action forms with field errors. */
function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function run<T>(fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> }>, success: (d: T) => void) {
    setBusy(true);
    setErrors({});
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    success(res.data);
  }
  return { busy, errors, run };
}

function Footer({ busy, onCancel, label }: { busy: boolean; onCancel: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
      <Button type="submit" disabled={busy}>
        {label}
      </Button>
    </div>
  );
}

// ─────────────────────────── Balances ───────────────────────────

export type BalanceRow = { id: string; itemBrandId: string; location: { id: string; name: string; type: string }; item: { id: string; code: string; name: string; unit: string }; brand: { id: string; name: string }; onHand: string; reserved: string; available: string };

export function LocationBalancesTable({ rows }: { rows: BalanceRow[] }) {
  const columns: DataTableColumn<BalanceRow>[] = [
    {
      id: "location",
      header: "Location",
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          {row.original.location.type === "SITE" ? <MapPin className="size-3.5 text-muted-foreground" /> : <Warehouse className="size-3.5 text-muted-foreground" />}
          {row.original.location.name}
        </span>
      ),
    },
    {
      id: "item",
      header: "Item",
      cell: ({ row }) => (
        <Link href={`/items/${row.original.item.id}`} className="font-medium hover:text-primary hover:underline">
          {row.original.item.name}
        </Link>
      ),
    },
    { id: "brand", header: "Brand", cell: ({ row }) => row.original.brand.name },
    { id: "onHand", header: "On hand", className: num, cell: ({ row }) => `${formatQty(row.original.onHand)} ${row.original.item.unit}` },
    { id: "reserved", header: "Reserved", className: num, cell: ({ row }) => (row.original.reserved !== "0" ? formatQty(row.original.reserved) : "—") },
    { id: "available", header: "Available", className: `${num} font-medium`, cell: ({ row }) => formatQty(row.original.available) },
  ];
  return <DataTable columns={columns} data={rows} getRowId={(r) => r.id} empty={<EmptyState icon={Warehouse} title="No stock at this location" description="Balances appear once stock is received, transferred or posted here." />} />;
}

// ─────────────────────────── Reservations ───────────────────────────

export type ReservationRow = { id: string; project: { id: string; code: string; name: string }; location: string; item: { id: string; code: string; name: string; unit: string }; brand: string; quantity: string; issuedQty: string; open: string; status: string; notes: string | null; createdBy: string; createdAt: string };

function ReleaseButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="ghost">
          <Lock className="size-3.5" /> Release
        </Button>
      }
      title="Release this reservation?"
      description="The remaining quantity becomes available to other projects."
      confirmLabel="Release"
      onConfirm={async () => {
        const res = await callAction(releaseReservationAction, id);
        if (!res.ok) {
          toast.error(res.error);
          return false;
        }
        toast.success("Reservation released.");
        router.refresh();
      }}
    />
  );
}

export function ReservationsTable({ rows, canRelease }: { rows: ReservationRow[]; canRelease: boolean }) {
  const columns: DataTableColumn<ReservationRow>[] = [
    { id: "project", header: "Project", cell: ({ row }) => <Link href={`/projects/${row.original.project.id}`} className="font-medium hover:underline">{row.original.project.code}</Link> },
    { id: "item", header: "Item – brand", cell: ({ row }) => `${row.original.item.name} — ${row.original.brand}` },
    { id: "loc", header: "Location", cell: ({ row }) => row.original.location },
    { id: "qty", header: "Reserved", className: num, cell: ({ row }) => formatQty(row.original.quantity) },
    { id: "issued", header: "Issued", className: num, cell: ({ row }) => formatQty(row.original.issuedQty) },
    { id: "open", header: "Open", className: `${num} font-medium`, cell: ({ row }) => `${formatQty(row.original.open)} ${row.original.item.unit}` },
    { id: "status", header: "Status", cell: ({ row }) => <DocStatusBadge status={row.original.status} /> },
    { id: "by", header: "By", cell: ({ row }) => <span className="text-xs whitespace-nowrap text-muted-foreground">{row.original.createdBy} · {formatDateTime(row.original.createdAt)}</span> },
    { id: "act", header: "", cell: ({ row }) => (canRelease && row.original.status === "ACTIVE" ? <ReleaseButton id={row.original.id} /> : null) },
  ];
  return <DataTable columns={columns} data={rows} getRowId={(r) => r.id} empty={<EmptyState icon={Lock} title="No active reservations" description="Reserve stock from Material Planning or here to earmark it for a project." />} />;
}

export function ReserveStockButton({ projects, positions, locations, presetProjectId, presetItemBrandId, label = "Reserve stock", size = "sm", variant = "outline" }: { projects: ProjectOpt[]; positions: PositionOpt[]; locations: LocationOpt[]; presetProjectId?: string; presetItemBrandId?: string; label?: string; size?: "sm" | "default"; variant?: "outline" | "default" | "ghost" }) {
  return (
    <FormDialog title="Reserve stock for a project" description="Reserved stock cannot be issued to other projects until released." trigger={<Button size={size} variant={variant}><Lock /> {label}</Button>}>
      {(close) => <ReserveForm projects={projects} positions={positions} locations={locations} presetProjectId={presetProjectId} presetItemBrandId={presetItemBrandId} onDone={close} />}
    </FormDialog>
  );
}

function ReserveForm({ projects, positions, locations, presetProjectId, presetItemBrandId, onDone }: { projects: ProjectOpt[]; positions: PositionOpt[]; locations: LocationOpt[]; presetProjectId?: string; presetItemBrandId?: string; onDone: () => void }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(presetProjectId ?? null);
  const [itemBrandId, setItemBrandId] = useState<string | null>(presetItemBrandId ?? null);
  const [locationId, setLocationId] = useState<string | null>(locations.find((l) => l.code === "WH-MAIN")?.id ?? null);
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const { busy, errors, run } = useSubmit();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => callAction(reserveStockAction, { projectId, itemBrandId, locationId, quantity, notes }), () => {
          toast.success("Stock reserved.");
          onDone();
          router.refresh();
        });
      }}
    >
      <Field id="rs-project" label="Project" required error={errors.projectId}>
        <SingleSelect id="rs-project" options={projects.map((p) => ({ value: p.id, label: p.name, hint: p.code }))} value={projectId} onChange={setProjectId} disabled={!!presetProjectId} allowClear={false} placeholder="Select project" />
      </Field>
      <Field id="rs-pos" label="Item – brand" required error={errors.itemBrandId}>
        <SingleSelect id="rs-pos" options={positionOptions(positions)} value={itemBrandId} onChange={setItemBrandId} disabled={!!presetItemBrandId} allowClear={false} placeholder="Select item and brand" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="rs-loc" label="From location" required error={errors.locationId}>
          <SingleSelect id="rs-loc" options={locationOptions(locations)} value={locationId} onChange={setLocationId} allowClear={false} />
        </Field>
        <Field id="rs-qty" label="Quantity" required error={errors.quantity}>
          <Input id="rs-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
      </div>
      <Field id="rs-notes" label="Notes" error={errors.notes}>
        <Input id="rs-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Footer busy={busy} onCancel={onDone} label="Reserve" />
    </form>
  );
}

// ─────────────────────────── Consumption ───────────────────────────

export function ConsumptionButton({ projectId, positions, today }: { projectId: string; positions: PositionOpt[]; today: string }) {
  return (
    <FormDialog title="Record site consumption" description="Material used / installed at this site. Deducted from the project's site store." trigger={<Button size="sm" variant="outline"><PackageMinus /> Record consumption</Button>}>
      {(close) => <ConsumptionForm projectId={projectId} positions={positions} today={today} onDone={close} />}
    </FormDialog>
  );
}

function ConsumptionForm({ projectId, positions, today, onDone }: { projectId: string; positions: PositionOpt[]; today: string; onDone: () => void }) {
  const router = useRouter();
  const [itemBrandId, setItemBrandId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [txnDate, setTxnDate] = useState(today);
  const [remarks, setRemarks] = useState("");
  const [key] = useState(newId);
  const { busy, errors, run } = useSubmit();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => callAction(recordConsumptionAction, { projectId, itemBrandId, quantity, txnDate, remarks, idempotencyKey: key }), (d) => {
          toast.success(d.duplicate ? `Already recorded as ${d.code}.` : `Recorded ${d.code}.`);
          onDone();
          router.refresh();
        });
      }}
    >
      <Field id="cs-pos" label="Item – brand (at site)" required error={errors.itemBrandId ?? errors.quantity}>
        <SingleSelect id="cs-pos" options={positionOptions(positions)} value={itemBrandId} onChange={setItemBrandId} allowClear={false} placeholder="Select item and brand" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="cs-qty" label="Quantity" required error={errors.quantity}>
          <Input id="cs-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field id="cs-date" label="Date" required error={errors.txnDate}>
          <Input id="cs-date" type="date" max={today} value={txnDate} onChange={(e) => setTxnDate(e.target.value)} />
        </Field>
      </div>
      <Field id="cs-rem" label="Remarks (work area / BOQ item)" error={errors.remarks}>
        <Textarea id="cs-rem" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </Field>
      <Footer busy={busy} onCancel={onDone} label="Record" />
    </form>
  );
}

// ─────────────────────────── Reversal ───────────────────────────

export function ReverseEntryButton({ id, code }: { id: string; code: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  return (
    <ConfirmDialog
      trigger={
        <Button size="icon-sm" variant="ghost" title="Reverse entry" aria-label={`Reverse ${code}`}>
          <Undo2 />
        </Button>
      }
      title={`Reverse ${code}?`}
      description={
        <span className="block space-y-2">
          <span className="block">An opposite entry is posted today. The original stays in the ledger.</span>
          <Textarea rows={2} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
        </span>
      }
      confirmLabel="Post reversal"
      destructive
      onConfirm={async () => {
        const res = await callAction(reverseStockEntryAction, id, { reason });
        if (!res.ok) {
          toast.error(res.error);
          return false;
        }
        toast.success(`Reversed with ${res.data.code}.`);
        router.refresh();
      }}
    />
  );
}

// ─────────────────────────── Locations ───────────────────────────

export type LocationRow = { id: string; code: string; name: string; type: string; isSystem: boolean; status: string; address: string | null; project: { id: string; code: string; name: string } | null; positions: number };

const TYPE_LABEL: Record<string, string> = { WAREHOUSE: "Warehouse", SITE: "Site store", TRANSIT: "In transit", QUARANTINE: "Quarantine" };

export function LocationsTable({ rows, canManage, projects }: { rows: LocationRow[]; canManage: boolean; projects: ProjectOpt[] }) {
  const columns: DataTableColumn<LocationRow>[] = [
    { id: "code", header: "Code", cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.code}</span> },
    { id: "name", header: "Name", cell: ({ row }) => <Link className="font-medium hover:underline" href={`/stock?tab=locations-stock&locationId=${row.original.id}`}>{row.original.name}</Link> },
    { id: "type", header: "Type", cell: ({ row }) => <ToneBadge tone={row.original.type === "SITE" ? "info" : row.original.type === "WAREHOUSE" ? "good" : "neutral"}>{TYPE_LABEL[row.original.type] ?? row.original.type}</ToneBadge> },
    { id: "project", header: "Project", cell: ({ row }) => (row.original.project ? <Link className="hover:underline" href={`/projects/${row.original.project.id}`}>{row.original.project.code}</Link> : "—") },
    { id: "positions", header: "Item–brands in stock", className: num, cell: ({ row }) => row.original.positions },
    { id: "status", header: "Status", cell: ({ row }) => <span className="flex gap-1"><DocStatusBadge status={row.original.status} />{row.original.isSystem && <ToneBadge tone="muted">System</ToneBadge>}</span> },
    { id: "act", header: "", cell: ({ row }) => (canManage ? <LocationDialog projects={projects} location={row.original} trigger={<Button size="icon-sm" variant="ghost" aria-label={`Edit ${row.original.name}`}><Pencil /></Button>} /> : null) },
  ];
  return <DataTable columns={columns} data={rows} getRowId={(r) => r.id} />;
}

export function LocationDialog({ projects, location, trigger }: { projects: ProjectOpt[]; location?: LocationRow; trigger?: ReactNode }) {
  return (
    <FormDialog title={location ? `Edit ${location.name}` : "Add location"} trigger={trigger ?? <Button size="sm" variant="outline"><Plus /> Add location</Button>}>
      {(close) => <LocationForm projects={projects} location={location} onDone={close} />}
    </FormDialog>
  );
}

function LocationForm({ projects, location, onDone }: { projects: ProjectOpt[]; location?: LocationRow; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(location?.name ?? "");
  const [type, setType] = useState<"WAREHOUSE" | "SITE">((location?.type as "WAREHOUSE" | "SITE") ?? "WAREHOUSE");
  const [projectId, setProjectId] = useState<string | null>(location?.project?.id ?? null);
  const [address, setAddress] = useState(location?.address ?? "");
  const [active, setActive] = useState(location ? location.status === "ACTIVE" : true);
  const { busy, errors, run } = useSubmit();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const payload = { name, type, projectId, address, status: active ? "ACTIVE" : "INACTIVE" };
        run(() => (location ? callAction(updateLocationAction, location.id, payload) : callAction(createLocationAction, payload)), () => {
          toast.success(location ? "Location updated." : "Location created.");
          onDone();
          router.refresh();
        });
      }}
    >
      <Field id="lc-name" label="Name" required error={errors.name}>
        <Input id="lc-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      {!location && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="lc-type" label="Type" required>
            <Select value={type} onValueChange={(v) => setType(v as "WAREHOUSE" | "SITE")}>
              <SelectTrigger id="lc-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WAREHOUSE">Warehouse / store</SelectItem>
                <SelectItem value="SITE">Project site store</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {type === "SITE" && (
            <Field id="lc-proj" label="Project" required error={errors.projectId}>
              <SingleSelect id="lc-proj" options={projects.map((p) => ({ value: p.id, label: p.name, hint: p.code }))} value={projectId} onChange={setProjectId} allowClear={false} />
            </Field>
          )}
        </div>
      )}
      <Field id="lc-addr" label="Address" error={errors.address}>
        <Textarea id="lc-addr" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      {location && !location.isSystem && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
      )}
      <Footer busy={busy} onCancel={onDone} label={location ? "Save" : "Create"} />
    </form>
  );
}


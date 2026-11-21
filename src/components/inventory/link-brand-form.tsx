"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { SingleSelect } from "@/components/forms/combobox";
import { Field } from "@/components/forms/field";
import { ConfirmDialog, FormDialog } from "@/components/shared/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { callAction } from "@/lib/call-action";
import { applyActionResult } from "@/lib/forms";
import { createBrandAction, linkBrandAction, unlinkBrandAction } from "@/modules/inventory/actions";
import { linkBrandSchema, type LinkBrandInput } from "@/modules/inventory/validation";

type Output = z.output<typeof linkBrandSchema>;
export type BrandOption = { id: string; code: string; name: string; status: string };

function LinkBrandForm({ itemId, unit, brands: initialBrands, canAdjust, today, onDone, canCreateBrand = true }: { itemId: string; unit: string; brands: BrandOption[]; canAdjust: boolean; today: string; onDone: () => void; canCreateBrand?: boolean }) {
  const router = useRouter();
  const [extra, setExtra] = useState<BrandOption[]>([]);
  const brands = [...initialBrands, ...extra];
  const form = useForm<LinkBrandInput, unknown, Output>({
    resolver: zodResolver(linkBrandSchema),
    defaultValues: { itemId, brandId: "", openingQty: "", openingDate: today },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Output) {
    const res = await callAction(linkBrandAction, values);
    if (!applyActionResult(res, form.setError, "Brand added")) return;
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field id="lb-brand" label="Brand" required error={errors.brandId?.message} help={brands.length ? undefined : "All brands are already linked — type a new brand name to add it."}>
        <Controller
          control={form.control}
          name="brandId"
          render={({ field }) => (
            <SingleSelect
              id="lb-brand"
              options={brands.map((b) => ({ value: b.id, label: b.name, hint: b.status === "INACTIVE" ? "Inactive" : b.code, disabled: b.status === "INACTIVE" }))}
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? "")}
              placeholder="Select a brand"
              searchPlaceholder="Search or add a brand…"
              onCreate={canCreateBrand ? async (name) => {
                const res = await callAction(createBrandAction, { name });
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                setExtra((x) => [...x, { id: res.data.id, code: "", name, status: "ACTIVE" }]);
                field.onChange(res.data.id);
                toast.success(`Brand "${name}" created`);
              } : undefined}
              createLabel="Add brand"
              invalid={!!errors.brandId}
              allowClear={false}
            />
          )}
        />
      </Field>
      {canAdjust && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="lb-qty" label={`Opening stock (${unit})`} error={errors.openingQty?.message} help="Optional. Posted as an opening entry.">
            <Input id="lb-qty" inputMode="decimal" autoComplete="off" aria-invalid={!!errors.openingQty} {...form.register("openingQty")} />
          </Field>
          <Field id="lb-date" label="Opening date" error={errors.openingDate?.message}>
            <Input id="lb-date" type="date" max={today} {...form.register("openingDate")} />
          </Field>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !brands.length}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Add brand
        </Button>
      </div>
    </form>
  );
}

export function LinkBrandButton(props: { itemId: string; unit: string; brands: BrandOption[]; canAdjust: boolean; today: string }) {
  return (
    <FormDialog
      title="Add brand to item"
      description="Each brand keeps its own stock balance for this item."
      trigger={
        <Button size="sm" variant="outline">
          <Plus /> Add brand
        </Button>
      }
    >
      {(close) => <LinkBrandForm {...props} onDone={close} />}
    </FormDialog>
  );
}

export function UnlinkBrandButton({ id, brandName }: { id: string; brandName: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button size="icon-sm" variant="ghost" aria-label={`Remove ${brandName}`}>
          <Trash2 />
        </Button>
      }
      title={`Remove ${brandName}?`}
      description="Only possible while this brand has no stock movements for the item."
      confirmLabel="Remove"
      destructive
      onConfirm={async () => {
        const res = await callAction(unlinkBrandAction, id);
        if (!res.ok) {
          toast.error(res.error);
          return false;
        }
        toast.success("Brand removed");
        router.refresh();
      }}
    />
  );
}

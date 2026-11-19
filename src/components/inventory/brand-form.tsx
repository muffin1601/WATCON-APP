"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/shared/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/call-action";
import { applyActionResult } from "@/lib/forms";
import { createBrandAction, updateBrandAction } from "@/modules/inventory/actions";
import { brandInputSchema, type BrandInput } from "@/modules/inventory/validation";

type Output = z.output<typeof brandInputSchema>;

export type BrandDefaults = { id: string; code: string; name: string; description: string | null; status: "ACTIVE" | "INACTIVE" };

function BrandForm({ brand, onDone }: { brand?: BrandDefaults; onDone: () => void }) {
  const router = useRouter();
  const form = useForm<BrandInput, unknown, Output>({
    resolver: zodResolver(brandInputSchema),
    defaultValues: { name: brand?.name ?? "", description: brand?.description ?? "", status: brand?.status ?? "ACTIVE" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Output) {
    const res = brand ? await callAction(updateBrandAction, brand.id, values) : await callAction(createBrandAction, values);
    if (!applyActionResult(res, form.setError, brand ? "Brand updated" : "Brand created")) return;
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {brand && (
        <Field id="brand-code" label="Brand code">
          <Input id="brand-code" value={brand.code} disabled readOnly />
        </Field>
      )}
      <Field id="brand-name" label="Brand name" required error={errors.name?.message}>
        <Input id="brand-name" autoComplete="off" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <Field id="brand-description" label="Description" error={errors.description?.message}>
        <Textarea id="brand-description" rows={3} {...form.register("description")} />
      </Field>
      <Field id="brand-status" label="Status" help="Inactive brands keep their history but cannot be linked or receive new movements.">
        <Controller
          control={form.control}
          name="status"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="brand-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {brand ? "Save changes" : "Create brand"}
        </Button>
      </div>
    </form>
  );
}

export function AddBrandButton() {
  return (
    <FormDialog
      title="Add brand"
      description="A brand code is generated automatically."
      trigger={
        <Button>
          <Plus /> Add brand
        </Button>
      }
    >
      {(close) => <BrandForm onDone={close} />}
    </FormDialog>
  );
}

export function EditBrandDialog({ brand, open, onOpenChange }: { brand: BrandDefaults; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <FormDialog title={`Edit ${brand.name}`} open={open} onOpenChange={onOpenChange}>
      {(close) => <BrandForm brand={brand} onDone={close} />}
    </FormDialog>
  );
}

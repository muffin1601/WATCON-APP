"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
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
import { createItemAction, updateItemAction } from "@/modules/inventory/actions";
import { ITEM_UNITS, itemInputSchema, type ItemInput } from "@/modules/inventory/validation";

type Output = z.output<typeof itemInputSchema>;

export type ItemDefaults = { id: string; code: string; name: string; category: string | null; unit: string; description: string | null; status: "ACTIVE" | "INACTIVE" };

function ItemForm({ item, categories, onDone }: { item?: ItemDefaults; categories: string[]; onDone: () => void }) {
  const router = useRouter();
  const listId = useId();
  const form = useForm<ItemInput, unknown, Output>({
    resolver: zodResolver(itemInputSchema),
    defaultValues: {
      code: item?.code ?? "",
      name: item?.name ?? "",
      category: item?.category ?? "",
      unit: item?.unit ?? "Nos",
      description: item?.description ?? "",
      status: item?.status ?? "ACTIVE",
    },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Output) {
    const res = item ? await callAction(updateItemAction, item.id, values) : await callAction(createItemAction, values);
    if (!applyActionResult(res, form.setError, item ? "Item updated" : "Item created")) return;
    onDone();
    if (!item) router.push(`/items/${res.data.id}`);
    else router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="item-code" label="Item code" error={errors.code?.message} help={item ? undefined : "Leave blank to generate one (ITM-0001)."}>
          <Input id="item-code" className="font-mono uppercase" autoComplete="off" aria-invalid={!!errors.code} {...form.register("code")} />
        </Field>
        <Field id="item-unit" label="Unit" required error={errors.unit?.message}>
          <Input id="item-unit" list={`${listId}-units`} autoComplete="off" aria-invalid={!!errors.unit} {...form.register("unit")} />
          <datalist id={`${listId}-units`}>
            {ITEM_UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field id="item-name" label="Item name" required error={errors.name?.message}>
        <Input id="item-name" autoComplete="off" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <Field id="item-category" label="Category" error={errors.category?.message} help="Pick an existing category or type a new one.">
        <Input id="item-category" list={`${listId}-cats`} autoComplete="off" aria-invalid={!!errors.category} {...form.register("category")} />
        <datalist id={`${listId}-cats`}>
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field id="item-description" label="Description" error={errors.description?.message}>
        <Textarea id="item-description" rows={3} {...form.register("description")} />
      </Field>
      <Field id="item-status" label="Status" error={errors.status?.message} help="Inactive items keep their stock history but cannot receive new movements.">
        <Controller
          control={form.control}
          name="status"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="item-status" className="w-full">
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
          {item ? "Save changes" : "Create item"}
        </Button>
      </div>
    </form>
  );
}

export function AddItemButton({ categories, defaultOpen = false }: { categories: string[]; defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && defaultOpen) router.replace("/items", { scroll: false });
      }}
      title="Add item"
      trigger={
        <Button>
          <Plus /> Add item
        </Button>
      }
    >
      {(close) => <ItemForm categories={categories} onDone={close} />}
    </FormDialog>
  );
}

export function EditItemButton({ item, categories }: { item: ItemDefaults; categories: string[] }) {
  return (
    <FormDialog
      title={`Edit ${item.name}`}
      trigger={
        <Button variant="outline" size="sm">
          <Pencil /> Edit
        </Button>
      }
    >
      {(close) => <ItemForm item={item} categories={categories} onDone={close} />}
    </FormDialog>
  );
}

export function EditItemDialog({ item, categories, open, onOpenChange }: { item: ItemDefaults; categories: string[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <FormDialog title={`Edit ${item.name}`} open={open} onOpenChange={onOpenChange}>
      {(close) => <ItemForm item={item} categories={categories} onDone={close} />}
    </FormDialog>
  );
}

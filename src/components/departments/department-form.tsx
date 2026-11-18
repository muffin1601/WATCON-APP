"use client";

import { callAction } from "@/lib/call-action";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { SingleSelect, personOptions, type PersonOption } from "@/components/forms/combobox";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/shared/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { applyActionResult } from "@/lib/forms";
import { createDepartmentAction, updateDepartmentAction } from "@/modules/departments/actions";
import { departmentInputSchema, type DepartmentInput } from "@/modules/departments/validation";

type Output = z.output<typeof departmentInputSchema>;

export type DepartmentDefaults = { id: string; code: string; name: string; description: string | null; headId: string | null; status: "ACTIVE" | "INACTIVE" };

function DepartmentForm({ people, department, onDone }: { people: PersonOption[]; department?: DepartmentDefaults; onDone: () => void }) {
  const router = useRouter();
  const form = useForm<DepartmentInput, unknown, Output>({
    resolver: zodResolver(departmentInputSchema),
    defaultValues: {
      name: department?.name ?? "",
      description: department?.description ?? "",
      headId: department?.headId ?? null,
      status: department?.status ?? "ACTIVE",
    },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Output) {
    const res = department ? await callAction(updateDepartmentAction, department.id, values) : await callAction(createDepartmentAction, values);
    if (!applyActionResult(res, form.setError, department ? "Department updated" : "Department created")) return;
    onDone();
    if (!department) router.push(`/departments/${res.data.id}`);
    else router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {department && (
        <Field id="dep-code" label="Department code">
          <Input id="dep-code" value={department.code} disabled readOnly />
        </Field>
      )}
      <Field id="dep-name" label="Department name" required error={errors.name?.message}>
        <Input id="dep-name" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <Field id="dep-description" label="Description" error={errors.description?.message}>
        <Textarea id="dep-description" rows={3} {...form.register("description")} />
      </Field>
      <Field id="dep-head" label="Department head" error={errors.headId?.message} help="The head is automatically added as a member.">
        <Controller
          control={form.control}
          name="headId"
          render={({ field }) => <SingleSelect id="dep-head" options={personOptions(people)} value={field.value ?? null} onChange={field.onChange} placeholder="Select a head" searchPlaceholder="Search people…" invalid={!!errors.headId} />}
        />
      </Field>
      <Field id="dep-status" label="Status" error={errors.status?.message} help="Inactive departments keep their history but cannot receive new tasks or members.">
        <Controller
          control={form.control}
          name="status"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="dep-status" className="w-full">
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
          {department ? "Save changes" : "Create department"}
        </Button>
      </div>
    </form>
  );
}

export function AddDepartmentButton({ people, defaultOpen = false }: { people: PersonOption[]; defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // Drop the ?new=1 deep-link flag so a refresh does not reopen the dialog.
        if (!o && defaultOpen) router.replace("/departments", { scroll: false });
      }}
      title="Add department"
      description="A department code is generated automatically."
      trigger={
        <Button>
          <Plus /> Add department
        </Button>
      }
    >
      {(close) => <DepartmentForm people={people} onDone={close} />}
    </FormDialog>
  );
}

export function EditDepartmentButton({ people, department, size = "sm" }: { people: PersonOption[]; department: DepartmentDefaults; size?: "sm" | "default" }) {
  return (
    <FormDialog
      title={`Edit ${department.name}`}
      trigger={
        <Button variant="outline" size={size}>
          <Pencil /> Edit
        </Button>
      }
    >
      {(close) => <DepartmentForm people={people} department={department} onDone={close} />}
    </FormDialog>
  );
}

/** Controlled variant (opened from a table row menu). */
export function EditDepartmentDialog({ people, department, open, onOpenChange }: { people: PersonOption[]; department: DepartmentDefaults; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <FormDialog title={`Edit ${department.name}`} open={open} onOpenChange={onOpenChange}>
      {(close) => <DepartmentForm people={people} department={department} onDone={close} />}
    </FormDialog>
  );
}

"use client";

import { callAction } from "@/lib/call-action";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  DepartmentMultiSelect,
  ProjectSelect,
  SingleSelect,
  UserMultiSelect,
  personOptions,
  type DepartmentOption,
  type PersonOption,
  type ProjectOption,
} from "@/components/forms/combobox";
import { Field, FormSection } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/format";
import { applyActionResult } from "@/lib/forms";
import { createTaskAction, updateTaskAction } from "@/modules/tasks/actions";
import { taskInputSchema, type TaskData, type TaskInput } from "@/modules/tasks/validation";

export function TaskForm({
  projects,
  departments,
  people,
  taskId,
  version,
  code,
  defaults,
}: {
  projects: ProjectOption[];
  departments: DepartmentOption[];
  people: PersonOption[];
  taskId?: string;
  version?: number;
  code?: string;
  defaults?: Partial<TaskInput>;
}) {
  const router = useRouter();
  const [filterByDepartment, setFilterByDepartment] = useState(false);
  const form = useForm<TaskInput, unknown, TaskData>({
    resolver: zodResolver(taskInputSchema),
    defaultValues: {
      title: "",
      description: "",
      projectId: "",
      departmentIds: [],
      assigneeIds: [],
      ownerId: null,
      startDate: "",
      dueDate: "",
      priority: "MEDIUM",
      status: "TODO",
      progress: 0,
      ...defaults,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const assigneeIds = useWatch({ control: form.control, name: "assigneeIds" }) ?? [];
  const departmentIds = useWatch({ control: form.control, name: "departmentIds" }) ?? [];

  // People offered for assignment: everyone, or only members of the selected departments
  // (already-selected people always stay visible so they can be removed).
  const peopleChoices =
    filterByDepartment && departmentIds.length
      ? people.filter((p) => assigneeIds.includes(p.id) || p.departmentIds?.some((d) => departmentIds.includes(d)))
      : people;
  const ownerChoices = personOptions(people.filter((p) => assigneeIds.includes(p.id)));

  function onAssigneesChange(next: string[]) {
    form.setValue("assigneeIds", next, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
    const owner = form.getValues("ownerId");
    if (next.length === 1) form.setValue("ownerId", next[0]!, { shouldDirty: true });
    else if (owner && !next.includes(owner)) form.setValue("ownerId", null, { shouldDirty: true });
  }

  async function onSubmit(values: TaskData) {
    if (taskId) {
      const res = await callAction(updateTaskAction, taskId, { version: version ?? 1, data: values });
      if (!res.ok && res.code === "CONFLICT") {
        toast.error(res.error, { action: { label: "Reload", onClick: () => router.refresh() }, duration: 10000 });
        return;
      }
      if (!applyActionResult(res, form.setError, "Task updated")) return;
      router.push(`/tasks/${res.data.id}`);
      router.refresh();
      return;
    }
    const res = await callAction(createTaskAction, values);
    if (!applyActionResult(res, form.setError, "Task created")) return;
    router.push(`/tasks/${res.data.id}`);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormSection title="Task" description="What needs to be done, and where.">
        <Field id="title" label="Task title" required error={errors.title?.message} className="sm:col-span-2">
          <Input id="title" aria-invalid={!!errors.title} {...form.register("title")} />
        </Field>
        <Field id="code" label="Task code" help={code ? undefined : "Generated automatically when the task is saved."}>
          <Input id="code" value={code ?? "Auto-generated"} disabled readOnly />
        </Field>
        <Field id="projectId" label="Project" required error={errors.projectId?.message}>
          <Controller control={form.control} name="projectId" render={({ field }) => <ProjectSelect id="projectId" projects={projects} value={field.value || null} onChange={(v) => field.onChange(v ?? "")} invalid={!!errors.projectId} />} />
        </Field>
        <Field id="description" label="Task description" error={errors.description?.message} className="sm:col-span-2">
          <Textarea id="description" rows={5} aria-invalid={!!errors.description} {...form.register("description")} />
        </Field>
      </FormSection>

      <FormSection title="Assignment" description="One task can be shared by several departments and team members. The accountable owner must be one of the assigned members.">
        <Field id="departmentIds" label="Departments" error={errors.departmentIds?.message} className="sm:col-span-2">
          <Controller control={form.control} name="departmentIds" render={({ field }) => <DepartmentMultiSelect id="departmentIds" departments={departments} value={field.value ?? []} onChange={field.onChange} invalid={!!errors.departmentIds} />} />
        </Field>
        <Field id="assigneeIds" label="Team members" error={errors.assigneeIds?.message} className="sm:col-span-2">
          <UserMultiSelect id="assigneeIds" people={peopleChoices} value={assigneeIds} onChange={onAssigneesChange} invalid={!!errors.assigneeIds} />
          <div className="flex items-center gap-2 pt-1">
            <Checkbox id="filterByDepartment" checked={filterByDepartment} onCheckedChange={(c) => setFilterByDepartment(c === true)} disabled={!departmentIds.length} />
            <Label htmlFor="filterByDepartment" className="text-xs font-normal text-muted-foreground">
              Only show people from the selected departments
            </Label>
          </div>
        </Field>
        <Field id="ownerId" label="Accountable owner" required={assigneeIds.length > 0} error={errors.ownerId?.message} help={assigneeIds.length ? undefined : "Assign team members first."} className="sm:col-span-2">
          <Controller
            control={form.control}
            name="ownerId"
            render={({ field }) => (
              <SingleSelect id="ownerId" options={ownerChoices} value={field.value ?? null} onChange={field.onChange} disabled={!assigneeIds.length} invalid={!!errors.ownerId} placeholder="Select the accountable owner" searchPlaceholder="Search assigned members…" />
            )}
          />
        </Field>
      </FormSection>

      <FormSection title="Schedule & progress">
        <Field id="startDate" label="Start date" error={errors.startDate?.message}>
          <Input id="startDate" type="date" aria-invalid={!!errors.startDate} {...form.register("startDate")} />
        </Field>
        <Field id="dueDate" label="Due date" error={errors.dueDate?.message}>
          <Input id="dueDate" type="date" aria-invalid={!!errors.dueDate} {...form.register("dueDate")} />
        </Field>
        <Field id="priority" label="Priority" required error={errors.priority?.message}>
          <Controller
            control={form.control}
            name="priority"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field id="status" label="Status" required error={errors.status?.message}>
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v);
                  if (v === "COMPLETED") form.setValue("progress", 100);
                  if (v === "TODO") form.setValue("progress", 0);
                }}
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_STATUS_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field
          id="progress"
          label="Progress (%)"
          required
          error={errors.progress?.message}
          help="Completed = 100%. To Do = 0%. Reopening a completed task needs a progress value below 100%."
          className="sm:col-span-2"
        >
          <Input id="progress" type="number" inputMode="numeric" min={0} max={100} step={1} className="max-w-32" aria-invalid={!!errors.progress} {...form.register("progress")} />
        </Field>
      </FormSection>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {taskId ? "Save changes" : "Create task"}
        </Button>
      </div>
    </form>
  );
}

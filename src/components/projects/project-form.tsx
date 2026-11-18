"use client";

import { callAction } from "@/lib/call-action";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { SingleSelect, UserMultiSelect, personOptions, type PersonOption } from "@/components/forms/combobox";
import { Field, FormSection } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PRIORITY_LABELS, PROJECT_STATUS_LABELS } from "@/lib/format";
import { applyActionResult } from "@/lib/forms";
import { createProjectAction, updateProjectAction } from "@/modules/projects/actions";
import { projectInputSchema, type ProjectData, type ProjectInput } from "@/modules/projects/validation";

export function ProjectForm({ people, projectId, code, defaults }: { people: PersonOption[]; projectId?: string; code?: string; defaults?: Partial<ProjectInput> }) {
  const router = useRouter();
  const form = useForm<ProjectInput, unknown, ProjectData>({
    resolver: zodResolver(projectInputSchema),
    defaultValues: {
      name: "",
      siteAddress: "",
      description: "",
      startDate: "",
      expectedCompletionDate: "",
      priority: "MEDIUM",
      status: "PLANNING",
      managerId: null,
      memberIds: [],
      ...defaults,
    },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: ProjectData) {
    const res = projectId ? await callAction(updateProjectAction, projectId, values) : await callAction(createProjectAction, values);
    if (!applyActionResult(res, form.setError, projectId ? "Project updated" : "Project created")) return;
    router.push(`/projects/${res.data.id}`);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormSection title="Site details" description="The site / project as it will appear across the system.">
        <Field id="name" label="Site / project name" required error={errors.name?.message} className="sm:col-span-2">
          <Input id="name" aria-invalid={!!errors.name} {...form.register("name")} />
        </Field>
        <Field id="code" label="Project code" help={code ? undefined : "Generated automatically when the project is saved."}>
          <Input id="code" value={code ?? "Auto-generated"} disabled readOnly />
        </Field>
        <div className="hidden sm:block" />
        <Field id="siteAddress" label="Site address" required error={errors.siteAddress?.message} className="sm:col-span-2">
          <Textarea id="siteAddress" rows={2} aria-invalid={!!errors.siteAddress} {...form.register("siteAddress")} />
        </Field>
        <Field id="description" label="Project description" required error={errors.description?.message} className="sm:col-span-2">
          <Textarea id="description" rows={4} aria-invalid={!!errors.description} {...form.register("description")} />
        </Field>
      </FormSection>

      <FormSection title="Schedule & status">
        <Field id="startDate" label="Start date" error={errors.startDate?.message}>
          <Input id="startDate" type="date" aria-invalid={!!errors.startDate} {...form.register("startDate")} />
        </Field>
        <Field id="expectedCompletionDate" label="Expected completion" error={errors.expectedCompletionDate?.message}>
          <Input id="expectedCompletionDate" type="date" aria-invalid={!!errors.expectedCompletionDate} {...form.register("expectedCompletionDate")} />
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
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROJECT_STATUS_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </FormSection>

      <FormSection title="People" description="Project members can see the project and all of its tasks if they hold an Admin role.">
        <Field id="managerId" label="Project manager" error={errors.managerId?.message}>
          <Controller
            control={form.control}
            name="managerId"
            render={({ field }) => <SingleSelect id="managerId" options={personOptions(people)} value={field.value ?? null} onChange={field.onChange} placeholder="Select a manager" searchPlaceholder="Search people…" />}
          />
        </Field>
        <Field id="memberIds" label="Project members" error={errors.memberIds?.message}>
          <Controller control={form.control} name="memberIds" render={({ field }) => <UserMultiSelect id="memberIds" people={people} value={field.value ?? []} onChange={field.onChange} />} />
        </Field>
      </FormSection>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {projectId ? "Save changes" : "Create project"}
        </Button>
      </div>
    </form>
  );
}

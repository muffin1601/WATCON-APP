"use client";

import { callAction } from "@/lib/call-action";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { DepartmentMultiSelect, SingleSelect, departmentOptions, type DepartmentOption } from "@/components/forms/combobox";
import { Field, FormSection } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { passwordPolicy } from "@/lib/auth/password-policy";
import { applyActionResult } from "@/lib/forms";
import { ROLE_LABELS } from "@/lib/permissions/definitions";
import { createMemberAction, updateMemberAction } from "@/modules/members/actions";
import { memberUpdateSchema } from "@/modules/members/validation";

const baseSchema = memberUpdateSchema.extend({ password: z.string().optional() });

function makeSchema(isEdit: boolean) {
  return baseSchema.superRefine((v, ctx) => {
    if (isEdit) return;
    const r = passwordPolicy.safeParse(v.password ?? "");
    if (!r.success) ctx.addIssue({ code: "custom", path: ["password"], message: r.error.issues[0]?.message ?? "Invalid password." });
  });
}

type FormInput = z.input<typeof baseSchema>;
type FormOutput = z.output<typeof baseSchema>;
export type MemberFormDefaults = Partial<FormInput>;

export function MemberForm({ departments, memberId, employeeCode, defaults, canAssignAdmin }: { departments: DepartmentOption[]; memberId?: string; employeeCode?: string; defaults?: MemberFormDefaults; canAssignAdmin: boolean }) {
  const router = useRouter();
  const isEdit = Boolean(memberId);
  const schema = useMemo(() => makeSchema(isEdit), [isEdit]);
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      email: "",
      username: "",
      phone: "",
      whatsappNumber: "",
      designation: "",
      joiningDate: "",
      role: "USER",
      primaryDepartmentId: null,
      additionalDepartmentIds: [],
      password: "",
      ...defaults,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const role = useWatch({ control: form.control, name: "role" });
  const primary = useWatch({ control: form.control, name: "primaryDepartmentId" });
  const isSuperAdminTarget = isEdit && defaults?.role === "SUPER_ADMIN";
  // Show the Admin option when the actor may assign it, or when the target already holds it.
  const roleOptions = (["USER", "ADMIN"] as const).filter((r) => r === "USER" || canAssignAdmin || defaults?.role === "ADMIN");

  async function onSubmit(values: FormOutput) {
    const { password, ...rest } = values;
    const res = isEdit ? await callAction(updateMemberAction, memberId!, rest) : await callAction(createMemberAction, { ...rest, password });
    if (!applyActionResult(res, form.setError, isEdit ? "Team member updated" : "Team member created")) return;
    router.push(`/team-members/${res.data.id}`);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormSection title="Personal information">
        <Field id="fullName" label="Full name" required error={errors.fullName?.message}>
          <Input id="fullName" autoComplete="off" aria-invalid={!!errors.fullName} {...form.register("fullName")} />
        </Field>
        <Field id="employeeCode" label="Employee ID" help={employeeCode ? undefined : "Generated automatically when saved."}>
          <Input id="employeeCode" value={employeeCode ?? "Auto-generated"} disabled readOnly />
        </Field>
        <Field id="designation" label="Designation" error={errors.designation?.message}>
          <Input id="designation" aria-invalid={!!errors.designation} {...form.register("designation")} />
        </Field>
        <Field id="joiningDate" label="Joining date" error={errors.joiningDate?.message}>
          <Input id="joiningDate" type="date" aria-invalid={!!errors.joiningDate} {...form.register("joiningDate")} />
        </Field>
        <Field id="phone" label="Phone number" error={errors.phone?.message}>
          <Input id="phone" type="tel" inputMode="tel" aria-invalid={!!errors.phone} {...form.register("phone")} />
        </Field>
        <Field id="whatsappNumber" label="WhatsApp number" error={errors.whatsappNumber?.message} help="Used to prefill WhatsApp task-list sharing.">
          <Input id="whatsappNumber" type="tel" inputMode="tel" aria-invalid={!!errors.whatsappNumber} {...form.register("whatsappNumber")} />
        </Field>
      </FormSection>

      <FormSection title="Departments" description="A member can belong to several departments; one is primary.">
        <Field id="primaryDepartmentId" label="Primary department" error={errors.primaryDepartmentId?.message}>
          <Controller
            control={form.control}
            name="primaryDepartmentId"
            render={({ field }) => (
              <SingleSelect
                id="primaryDepartmentId"
                options={departmentOptions(departments)}
                value={field.value ?? null}
                onChange={field.onChange}
                placeholder="Select a department"
                searchPlaceholder="Search departments…"
                invalid={!!errors.primaryDepartmentId}
              />
            )}
          />
        </Field>
        <Field id="additionalDepartmentIds" label="Additional departments" error={errors.additionalDepartmentIds?.message}>
          <Controller
            control={form.control}
            name="additionalDepartmentIds"
            render={({ field }) => (
              <DepartmentMultiSelect
                id="additionalDepartmentIds"
                departments={departments.filter((d) => d.id !== primary)}
                value={(field.value ?? []).filter((v) => v !== primary)}
                onChange={field.onChange}
                invalid={!!errors.additionalDepartmentIds}
              />
            )}
          />
        </Field>
      </FormSection>

      <FormSection title="Account" description={isEdit ? "Sign-in identity and access level." : "The member signs in with this email or username."}>
        <Field id="email" label="Email" required error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="off" aria-invalid={!!errors.email} {...form.register("email")} />
        </Field>
        <Field id="username" label="Username" required error={errors.username?.message}>
          <Input id="username" autoComplete="off" aria-invalid={!!errors.username} {...form.register("username")} />
        </Field>
        <Field id="role" label="Role" required error={errors.role?.message} help={isSuperAdminTarget ? "A Super Admin's role cannot be changed here." : role === "ADMIN" ? "Admins manage projects, departments, members and tasks within their permissions." : "Users see and update their own assigned tasks."}>
          {isSuperAdminTarget ? (
            <Input id="role" value={ROLE_LABELS.SUPER_ADMIN} disabled readOnly />
          ) : (
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={roleOptions.length < 2}>
                  <SelectTrigger id="role" className="w-full" aria-invalid={!!errors.role}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Field>
        {!isEdit && (
          <Field id="password" label="Temporary password" required error={errors.password?.message} help="At least 10 characters with a letter and a number. The member must change it at first sign-in.">
            <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register("password")} />
          </Field>
        )}
      </FormSection>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {isEdit ? "Save changes" : "Create member"}
        </Button>
      </div>
    </form>
  );
}

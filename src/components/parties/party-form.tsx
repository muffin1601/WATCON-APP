"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { SingleSelect } from "@/components/forms/combobox";
import { Field, FormSection } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";
import { callAction } from "@/lib/call-action";
import { applyActionResult } from "@/lib/forms";
import { GST_STATES, TDS_SECTIONS } from "@/lib/gst";
import { createPartyAction, updatePartyAction } from "@/modules/parties/actions";
import { partyInputSchema, type PartyInput } from "@/modules/parties/validation";

type Output = z.output<typeof partyInputSchema>;

const stateOptions = Object.entries(GST_STATES).map(([value, name]) => ({ value, label: `${value} – ${name}` }));

export function PartyForm({ partyId, code, defaults, returnTo }: { partyId?: string; code?: string; defaults?: Partial<PartyInput>; returnTo?: string }) {
  const router = useRouter();
  const form = useForm<PartyInput, unknown, Output>({
    resolver: zodResolver(partyInputSchema),
    defaultValues: {
      name: "",
      legalName: "",
      isClient: false,
      isSupplier: false,
      gstin: "",
      pan: "",
      stateCode: null,
      address: "",
      city: "",
      pincode: "",
      contactPerson: "",
      phone: "",
      email: "",
      whatsappNumber: "",
      paymentTermsDays: "",
      creditLimit: "",
      tdsSection: "",
      tdsRate: "",
      bankName: "",
      bankAccount: "",
      ifsc: "",
      notes: "",
      status: "ACTIVE",
      ...defaults,
    },
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  useUnsavedWarning(isDirty && !isSubmitting);

  async function onSubmit(values: Output) {
    const res = partyId ? await callAction(updatePartyAction, partyId, values) : await callAction(createPartyAction, values);
    if (!applyActionResult(res, form.setError, partyId ? "Party updated" : "Party created")) return;
    form.reset(form.getValues());
    router.push(returnTo ?? `/parties/${res.data.id}`);
  }

  const reg = (name: keyof PartyInput) => ({ id: name, "aria-invalid": !!errors[name], ...form.register(name) });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormSection title="Party" description="A party can be a client, a supplier, or both.">
        <Field id="name" label="Name" required error={errors.name?.message} className="sm:col-span-2">
          <Input autoComplete="off" {...reg("name")} />
        </Field>
        <Field id="legalName" label="Legal / registered name" error={errors.legalName?.message}>
          <Input autoComplete="off" {...reg("legalName")} />
        </Field>
        <Field id="code" label="Code" help={code ? undefined : "Generated when saved."}>
          <Input id="code" value={code ?? "Auto-generated"} disabled readOnly />
        </Field>
        <Field id="isClient" label="Type" required error={errors.isClient?.message} className="sm:col-span-2">
          <div className="flex flex-wrap gap-6 pt-1">
            <Controller control={form.control} name="isClient" render={({ field }) => <label className="flex items-center gap-2 text-sm"><Checkbox id="isClient" checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} /> Client (we bill them)</label>} />
            <Controller control={form.control} name="isSupplier" render={({ field }) => <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} /> Supplier (we buy from them)</label>} />
          </div>
        </Field>
      </FormSection>

      <FormSection title="GST & tax" description="GSTIN is validated (format and check digit); state and PAN are derived from it when left blank.">
        <Field id="gstin" label="GSTIN" error={errors.gstin?.message} help="Leave blank for unregistered parties.">
          <Input autoComplete="off" className="uppercase" maxLength={15} {...reg("gstin")} />
        </Field>
        <Field id="pan" label="PAN" error={errors.pan?.message}>
          <Input autoComplete="off" className="uppercase" maxLength={10} {...reg("pan")} />
        </Field>
        <Field id="stateCode" label="State (place of supply)" error={errors.stateCode?.message} help="Decides CGST + SGST (same state) or IGST.">
          <Controller control={form.control} name="stateCode" render={({ field }) => <SingleSelect id="stateCode" options={stateOptions} value={field.value ?? null} onChange={field.onChange} placeholder="Select state" searchPlaceholder="Search state or code…" invalid={!!errors.stateCode} />} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="tdsSection" label="TDS section" error={errors.tdsSection?.message} help={`e.g. ${TDS_SECTIONS.slice(0, 3).join(", ")}`}>
            <Input autoComplete="off" className="uppercase" list="tds-sections" {...reg("tdsSection")} />
          </Field>
          <Field id="tdsRate" label="TDS rate %" error={errors.tdsRate?.message}>
            <Input inputMode="decimal" autoComplete="off" {...reg("tdsRate")} />
          </Field>
          <datalist id="tds-sections">{TDS_SECTIONS.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
      </FormSection>

      <FormSection title="Contact">
        <Field id="contactPerson" label="Contact person" error={errors.contactPerson?.message}>
          <Input autoComplete="off" {...reg("contactPerson")} />
        </Field>
        <Field id="phone" label="Phone" error={errors.phone?.message}>
          <Input type="tel" autoComplete="off" {...reg("phone")} />
        </Field>
        <Field id="email" label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="off" {...reg("email")} />
        </Field>
        <Field id="whatsappNumber" label="WhatsApp" error={errors.whatsappNumber?.message}>
          <Input type="tel" autoComplete="off" {...reg("whatsappNumber")} />
        </Field>
        <Field id="address" label="Address" error={errors.address?.message} className="sm:col-span-2">
          <Textarea rows={2} {...reg("address")} />
        </Field>
        <Field id="city" label="City" error={errors.city?.message}>
          <Input autoComplete="off" {...reg("city")} />
        </Field>
        <Field id="pincode" label="PIN code" error={errors.pincode?.message}>
          <Input inputMode="numeric" maxLength={6} autoComplete="off" {...reg("pincode")} />
        </Field>
      </FormSection>

      <FormSection title="Commercial & bank">
        <Field id="paymentTermsDays" label="Payment terms (days)" error={errors.paymentTermsDays?.message} help="Used to compute due dates on bills and invoices.">
          <Input inputMode="numeric" autoComplete="off" {...reg("paymentTermsDays")} />
        </Field>
        <Field id="creditLimit" label="Credit limit (₹)" error={errors.creditLimit?.message}>
          <Input inputMode="decimal" autoComplete="off" {...reg("creditLimit")} />
        </Field>
        <Field id="bankName" label="Bank" error={errors.bankName?.message}>
          <Input autoComplete="off" {...reg("bankName")} />
        </Field>
        <Field id="bankAccount" label="Account number" error={errors.bankAccount?.message}>
          <Input inputMode="numeric" autoComplete="off" {...reg("bankAccount")} />
        </Field>
        <Field id="ifsc" label="IFSC" error={errors.ifsc?.message}>
          <Input autoComplete="off" className="uppercase" maxLength={11} {...reg("ifsc")} />
        </Field>
        <Field id="status" label="Status">
          <Controller control={form.control} name="status" render={({ field }) => <label className="flex items-center gap-2 pt-2 text-sm"><Checkbox checked={field.value === "ACTIVE"} onCheckedChange={(v) => field.onChange(v === true ? "ACTIVE" : "INACTIVE")} /> Active</label>} />
        </Field>
        <Field id="notes" label="Notes" error={errors.notes?.message} className="sm:col-span-2">
          <Textarea rows={3} {...reg("notes")} />
        </Field>
      </FormSection>

      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {partyId ? "Save changes" : "Create party"}
        </Button>
      </div>
    </form>
  );
}

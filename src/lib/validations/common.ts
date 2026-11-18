import { z } from "zod";

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type PriorityKey = (typeof PRIORITIES)[number];

export const uuid = z.string().uuid("Invalid identifier.");

/** Required trimmed text. */
export const text = (label: string, max: number, min = 1) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(min, min <= 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`);

/** Optional trimmed text; empty string → null. */
export const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters.`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

/** "YYYY-MM-DD" (HTML date input) → string, validated as a real calendar date. */
export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD.")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00.000Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
  }, "Invalid date.");

export const optionalDate = z
  .union([dateString, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

/** Converts a validated "YYYY-MM-DD" to a Date at UTC midnight (Postgres DATE semantics). */
export function toDbDate(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

/** Inverse of toDbDate for form defaults. */
export function fromDbDate(value: Date | null | undefined): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

export const phone = z
  .string()
  .trim()
  .max(20)
  .regex(/^\+?[0-9\s-]{7,20}$/, "Enter a valid phone number (digits, optional leading +).")
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

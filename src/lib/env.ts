import { z } from "zod";

/**
 * Server-side environment validation. Imported lazily by server modules only —
 * none of these values are ever exposed to the browser (no NEXT_PUBLIC_ vars).
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_IDLE_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(12),
  SESSION_MAX_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  MAIL_TRANSPORT: z.enum(["console", "smtp"]).default("console"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  MAIL_FROM: z.string().default("Watcon <no-reply@example.com>"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  // Password-reset links are built from APP_URL; a silent localhost default in
  // production would email users links that cannot work.
  if (parsed.data.NODE_ENV === "production" && !process.env.APP_URL) {
    throw new Error("Invalid environment configuration: APP_URL is required in production (public https URL of the app)");
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.MAIL_TRANSPORT === "smtp" && !parsed.data.SMTP_HOST) {
    throw new Error("Invalid environment configuration: SMTP_HOST is required when MAIL_TRANSPORT=smtp");
  }
  cached = parsed.data;
  return cached;
}

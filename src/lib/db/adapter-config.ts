import type { PrismaPg } from "@prisma/adapter-pg";

type PgAdapterConfig = ConstructorParameters<typeof PrismaPg>[0];

/**
 * Connection settings for the Prisma pg adapter, shared by the app and the CLI scripts
 * (seed / bootstrap) so they all use the same TLS behaviour.
 *
 * Optional `DB_SSL_CA` (PEM; literal `\n` sequences are accepted) pins a CA for providers
 * whose certificates are not in Node's trust store, e.g. Supabase. node-postgres treats
 * `sslmode=require` as FULL verification, so with a CA we drop `sslmode` from the URL and
 * pass an explicit, verified TLS configuration instead.
 */
export function pgAdapterConfig(connectionString: string, max?: number): PgAdapterConfig {
  const ca = process.env.DB_SSL_CA?.replace(/\\n/g, "\n").trim();
  if (!ca) return { connectionString, ...(max ? { max } : {}) };
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  return { connectionString: url.toString(), ...(max ? { max } : {}), ssl: { ca, rejectUnauthorized: true } };
}

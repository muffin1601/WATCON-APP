import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { pgAdapterConfig } from "./adapter-config";

export { Prisma } from "@/generated/prisma/client";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  const adapter = new PrismaPg(pgAdapterConfig(connectionString, Number(process.env.DB_POOL_MAX ?? 10)));
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

type Client = ReturnType<typeof createClient>;
const globalForPrisma = globalThis as unknown as { __prisma?: Client };

function getClient(): Client {
  if (!globalForPrisma.__prisma) globalForPrisma.__prisma = createClient();
  return globalForPrisma.__prisma;
}

/**
 * Shared Prisma client, created lazily on first use so that importing this module
 * (e.g. during `next build`) never requires a database connection.
 */
export const db: Client = new Proxy({} as Client, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export type Db = Client;
/** Transaction client type for functions that run inside `db.$transaction`. */
export type Tx = Parameters<Parameters<Client["$transaction"]>[0]>[0];

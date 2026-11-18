import { afterEach, describe, expect, it } from "vitest";
import { pgAdapterConfig } from "@/lib/db/adapter-config";

const URL_WITH_SSL = "postgresql://postgres.abc:p%40ss%2Fw%23rd!@pooler.example.com:6543/postgres?sslmode=require";

afterEach(() => {
  delete process.env.DB_SSL_CA;
});

describe("pgAdapterConfig", () => {
  it("passes the URL through untouched when no CA is configured", () => {
    expect(pgAdapterConfig(URL_WITH_SSL, 3)).toEqual({ connectionString: URL_WITH_SSL, max: 3 });
  });

  it("pins the CA, drops sslmode, keeps verification on and preserves encoded credentials", () => {
    process.env.DB_SSL_CA = "-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----";
    const cfg = pgAdapterConfig(URL_WITH_SSL, 2) as { connectionString: string; max: number; ssl: { ca: string; rejectUnauthorized: boolean } };
    expect(cfg.ssl.rejectUnauthorized).toBe(true);
    expect(cfg.ssl.ca).toBe("-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----");
    expect(cfg.connectionString).not.toContain("sslmode");
    expect(cfg.connectionString).toContain("p%40ss%2Fw%23rd!@pooler.example.com:6543/postgres");
    expect(cfg.max).toBe(2);
  });
});

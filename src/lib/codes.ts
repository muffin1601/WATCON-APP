import type { Tx } from "@/lib/db";

export type CodeScopeKey = "PROJECT" | "TASK" | "DEPARTMENT" | "EMPLOYEE";

const FORMATS: Record<CodeScopeKey, { prefix: string; width: number }> = {
  PROJECT: { prefix: "PRJ", width: 4 },
  TASK: { prefix: "TSK", width: 5 },
  DEPARTMENT: { prefix: "DEP", width: 3 },
  EMPLOYEE: { prefix: "EMP", width: 4 },
};

/** Pure formatter: formatCode("TASK", 42) → "TSK-00042". Grows past the width instead of truncating. */
export function formatCode(scope: CodeScopeKey, value: number): string {
  if (!Number.isInteger(value) || value < 1) throw new Error(`Invalid code sequence value: ${value}`);
  const { prefix, width } = FORMATS[scope];
  return `${prefix}-${String(value).padStart(width, "0")}`;
}

/**
 * Concurrency-safe sequence: a single atomic UPSERT … RETURNING on code_counters.
 * The row lock is held until the surrounding transaction commits, so two concurrent
 * transactions can never receive the same number (and a rolled-back transaction
 * releases its number without creating a duplicate).
 */
export async function nextCode(tx: Tx, organizationId: string, scope: CodeScopeKey): Promise<string> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO code_counters (organization_id, scope, value)
    VALUES (${organizationId}::uuid, ${scope}::"CodeScope", 1)
    ON CONFLICT (organization_id, scope)
    DO UPDATE SET value = code_counters.value + 1
    RETURNING value`;
  const value = rows[0]?.value;
  if (typeof value !== "number") throw new Error("Failed to allocate business code");
  return formatCode(scope, value);
}

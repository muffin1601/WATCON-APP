import { hash, verify, type Algorithm } from "@node-rs/argon2";

/** OWASP-recommended Argon2id parameters (m=19 MiB, t=2, p=1). */
const ARGON2_OPTIONS = {
  // Algorithm.Argon2id (const enum value 2; ambient const enums cannot be referenced with isolatedModules).
  algorithm: 2 as unknown as Algorithm,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;
/**
 * Burns the same CPU time as a real verification when the account does not exist,
 * so response timing does not reveal which identifiers are registered.
 */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword("dummy-password-for-timing-equalisation");
  await verifyPassword(await dummyHash, password);
}

export { passwordPolicy } from "./password-policy";

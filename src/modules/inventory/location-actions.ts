"use server";

import { runAction } from "@/lib/actions";
import { createLocation, recordConsumption, releaseReservation, reserveStock, reverseStockEntry, updateLocation } from "./locations";

const PATHS = ["/stock", "/items", "/material-planning", "/projects"];

export async function createLocationAction(input: unknown) {
  return runAction(async (actor) => ({ id: (await createLocation(actor, input)).id }), PATHS);
}
export async function updateLocationAction(id: string, input: unknown) {
  return runAction(async (actor) => ({ id: (await updateLocation(actor, String(id), input)).id }), PATHS);
}
export async function reserveStockAction(input: unknown) {
  return runAction(async (actor) => ({ id: (await reserveStock(actor, input)).id }), PATHS);
}
export async function releaseReservationAction(id: string) {
  return runAction(async (actor) => {
    await releaseReservation(actor, String(id));
  }, PATHS);
}
export async function recordConsumptionAction(input: unknown) {
  return runAction(async (actor) => recordConsumption(actor, input), PATHS);
}
export async function reverseStockEntryAction(id: string, input: unknown) {
  return runAction(async (actor) => {
    const t = await reverseStockEntry(actor, String(id), input);
    return { code: t.code };
  }, PATHS);
}

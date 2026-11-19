"use server";

import { runAction } from "@/lib/actions";
import { createBrand, createItem, linkBrand, postStockMovement, setBrandStatus, setItemStatus, unlinkBrand, updateBrand, updateItem } from "./service";

const INVENTORY = ["/items", "/brands", "/stock"];
const status = (s: string) => (s === "ACTIVE" ? "ACTIVE" : "INACTIVE");

export async function createItemAction(input: unknown) {
  return runAction(async (actor) => ({ id: (await createItem(actor, input)).id }), INVENTORY);
}

export async function updateItemAction(id: string, input: unknown) {
  return runAction(async (actor) => ({ id: (await updateItem(actor, String(id), input)).id }), INVENTORY);
}

export async function setItemStatusAction(id: string, s: "ACTIVE" | "INACTIVE") {
  return runAction(async (actor) => {
    await setItemStatus(actor, String(id), status(s));
  }, INVENTORY);
}

export async function createBrandAction(input: unknown) {
  return runAction(async (actor) => ({ id: (await createBrand(actor, input)).id }), INVENTORY);
}

export async function updateBrandAction(id: string, input: unknown) {
  return runAction(async (actor) => ({ id: (await updateBrand(actor, String(id), input)).id }), INVENTORY);
}

export async function setBrandStatusAction(id: string, s: "ACTIVE" | "INACTIVE") {
  return runAction(async (actor) => {
    await setBrandStatus(actor, String(id), status(s));
  }, INVENTORY);
}

export async function linkBrandAction(input: unknown) {
  return runAction(async (actor) => ({ id: (await linkBrand(actor, input)).id }), INVENTORY);
}

export async function unlinkBrandAction(itemBrandId: string) {
  return runAction(async (actor) => {
    await unlinkBrand(actor, String(itemBrandId));
  }, INVENTORY);
}

export async function postStockMovementAction(input: unknown) {
  return runAction(async (actor) => {
    const { txn, duplicate } = await postStockMovement(actor, input);
    return { id: txn.id, code: txn.code, balanceAfter: txn.balanceAfter, duplicate };
  }, INVENTORY);
}

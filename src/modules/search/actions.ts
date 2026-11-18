"use server";

import { runAction } from "@/lib/actions";
import { listNotifications, markAllRead } from "@/modules/notifications/service";
import { globalSearch } from "./service";

export async function searchAction(q: string) {
  return runAction((actor) => globalSearch(actor, String(q ?? "")));
}

export async function notificationsAction() {
  return runAction(async (actor) => {
    const { items, unread } = await listNotifications(actor.id);
    return { unread, items: items.map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, read: n.readAt !== null, createdAt: n.createdAt.toISOString() })) };
  });
}

export async function markNotificationsReadAction() {
  return runAction((actor) => markAllRead(actor.id));
}

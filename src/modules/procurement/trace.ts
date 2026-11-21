import "server-only";
import { db, type Prisma } from "@/lib/db";
import type { Actor } from "@/lib/permissions/definitions";
import { projectRequiredScoped } from "@/modules/commercial/core";

/** Sales orders that drove a procurement document, via requisition lines → material requirements → SO lines. */
export async function traceSalesOrders(actor: Actor, opts: { prIds?: (string | null | undefined)[]; prLineIds?: (string | null | undefined)[] }) {
  const prIds = [...new Set(opts.prIds?.filter((x): x is string => !!x) ?? [])];
  const prLineIds = [...new Set(opts.prLineIds?.filter((x): x is string => !!x) ?? [])];
  if (!prIds.length && !prLineIds.length) return [];
  return db.salesOrder.findMany({
    where: {
      AND: [
        projectRequiredScoped(actor) as Prisma.SalesOrderWhereInput,
        { lines: { some: { requirements: { some: { prLines: { some: { OR: [...(prIds.length ? [{ prId: { in: prIds } }] : []), ...(prLineIds.length ? [{ id: { in: prLineIds } }] : [])] } } } } } } },
      ],
    },
    orderBy: { orderDate: "asc" },
    select: { id: true, number: true },
    take: 20,
  });
}

import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { NAV_PERMISSIONS } from "@/components/layout/nav-permissions";
import { ROLE_LABELS, can } from "@/lib/permissions/definitions";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [org, unread] = await Promise.all([
    db.organization.findUnique({ where: { id: user.organizationId }, select: { name: true } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return (
    <AppShell
      user={{ id: user.id, fullName: user.fullName, email: user.email, roleLabel: ROLE_LABELS[user.role], employeeCode: user.employeeCode }}
      nav={{ id: user.id, canViewMembers: can(user, "members.view"), perms: NAV_PERMISSIONS.filter((p) => can(user, p)) }}
      orgName={org?.name ?? "Watcon"}
      unread={unread}
    >
      {children}
    </AppShell>
  );
}

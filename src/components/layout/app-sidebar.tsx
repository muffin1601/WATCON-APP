"use client";

import { Boxes, Building2, FolderKanban, LayoutDashboard, ListChecks, PackageSearch, Settings, Tags, Truck, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

export type NavUser = { id: string; canViewMembers: boolean; canViewInventory: boolean };

type Item = { href: string; label: string; icon: typeof LayoutDashboard; disabled?: boolean; match?: string };
type Group = { label: string | null; items: Item[] };

/** Sidebar modules. Empty groups (no visible items) are dropped. */
export function navGroups(user: NavUser): Group[] {
  const groups: Group[] = [
    { label: null, items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      label: "Work",
      items: [
        { href: "/projects", label: "Projects", icon: FolderKanban },
        { href: "/tasks", label: "Tasks", icon: ListChecks },
      ],
    },
    {
      label: "Organization",
      items: [
        { href: "/departments", label: "Departments", icon: Building2 },
        user.canViewMembers
          ? { href: "/team-members", label: "Team Members", icon: Users }
          : { href: `/team-members/${user.id}`, label: "My Profile", icon: UserRound, match: "/team-members" },
      ],
    },
    {
      label: "Inventory",
      items: user.canViewInventory
        ? [
            { href: "/items", label: "Items", icon: Boxes },
            { href: "/brands", label: "Brands", icon: Tags },
            { href: "/stock", label: "Stock", icon: PackageSearch },
          ]
        : [],
    },
    { label: "Procurement", items: [{ href: "#", label: "Suppliers", icon: Truck, disabled: true }] },
    { label: "Administration", items: [{ href: "/settings", label: "Settings", icon: Settings }] },
  ];
  return groups.filter((g) => g.items.length > 0);
}

function NavEntry({ item, pathname, collapsed, onNavigate }: { item: Item; pathname: string; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  if (item.disabled) {
    const content = (
      <span aria-disabled="true" className={cn("flex h-9 cursor-not-allowed items-center gap-3 rounded-lg px-2.5 text-sm text-muted-foreground/60", collapsed && "justify-center px-0")}>
        <Icon className="size-4 shrink-0" aria-hidden />
        {!collapsed && (
          <>
            <span className="truncate">{item.label}</span>
            <span className="ml-auto rounded border px-1.5 py-px text-[10px] leading-4 font-medium whitespace-nowrap">Soon</span>
          </>
        )}
        {collapsed && <span className="sr-only">{item.label} (Coming soon)</span>}
      </span>
    );
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{item.label} — Coming soon</TooltipContent>
      </Tooltip>
    );
  }
  const prefix = item.match ?? item.href;
  const active = pathname === item.href || pathname.startsWith(`${prefix}/`) || pathname === prefix;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        active ? "bg-primary/8 text-primary" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
    </Link>
  );
  return collapsed ? (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  ) : (
    link
  );
}

export function SidebarNav({ user, collapsed = false, onNavigate }: { user: NavUser; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col px-2">
      {navGroups(user).map((group, i) => {
        const headingId = `nav-group-${i}`;
        return (
          <div key={group.label ?? "top"} role="group" aria-labelledby={group.label ? headingId : undefined} className={cn(i > 0 && (collapsed ? "mt-2 border-t pt-2" : "mt-4"))}>
            {group.label && !collapsed && (
              <h2 id={headingId} className="mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
                {group.label}
              </h2>
            )}
            {group.label && collapsed && (
              <span id={headingId} className="sr-only">
                {group.label}
              </span>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavEntry key={item.label} item={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function Brand({ name, collapsed }: { name: string; collapsed?: boolean }) {
  return (
    <Link href="/dashboard" aria-label={name} className={cn("flex h-14 items-center gap-2.5 px-4", collapsed && "justify-center px-0")}>
      {collapsed ? (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">{name.charAt(0).toUpperCase()}</span>
      ) : (
        <Logo className="h-7" priority />
      )}
    </Link>
  );
}

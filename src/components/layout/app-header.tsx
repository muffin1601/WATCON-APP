"use client";

import { callAction } from "@/lib/call-action";
import { Bell, Building2, FolderKanban, KeyRound, ListChecks, LogOut, PanelLeft, Search, User, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateTime, initials } from "@/lib/format";
import { logoutAction } from "@/modules/auth/actions";
import { markNotificationsReadAction, notificationsAction, searchAction } from "@/modules/search/actions";
import type { SearchHit } from "@/modules/search/service";

export type HeaderUser = { id: string; fullName: string; email: string; roleLabel: string; employeeCode: string };

const HIT_ICONS = { project: FolderKanban, task: ListChecks, member: Users, department: Building2 } as const;

function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const term = q.trim();
    const id = ++seq.current;
    const t = setTimeout(async () => {
      if (term.length < 2) {
        if (id === seq.current) setHits([]);
        return;
      }
      setLoading(true);
      let found: SearchHit[] = [];
      try {
        const res = await callAction(searchAction, term);
        if (res.ok) found = res.data;
      } catch {
        // Network failure or stale page after a deployment: show no results instead of crashing.
      }
      if (id === seq.current) {
        setHits(found);
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const groups = (["project", "task", "member", "department"] as const).map((type) => ({ type, items: hits.filter((h) => h.type === type) })).filter((g) => g.items.length);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Search className="size-4" aria-hidden />
        <span className="truncate">Search projects, tasks, people…</span>
        <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search projects, tasks, team members and departments">
        {/* Results are server-filtered; disable cmdk's own filtering. */}
        <Command shouldFilter={false}>
        <CommandInput placeholder="Type at least 2 characters…" value={q} onValueChange={setQ} />
        <CommandList>
          <CommandEmpty>{loading ? "Searching…" : q.trim().length < 2 ? "Start typing to search." : "No results found."}</CommandEmpty>
          {groups.map((g) => (
            <CommandGroup key={g.type} heading={{ project: "Projects", task: "Tasks", member: "Team members", department: "Departments" }[g.type]}>
              {g.items.map((h) => {
                const Icon = HIT_ICONS[h.type];
                return (
                  <CommandItem
                    key={`${h.type}-${h.id}`}
                    value={`${h.type}-${h.id}-${q}`}
                    onSelect={() => {
                      setOpen(false);
                      router.push(h.href);
                    }}
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate">{h.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{h.subtitle}</div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

type Note = { id: string; title: string; body: string | null; link: string | null; read: boolean; createdAt: string };

function Notifications({ initialUnread }: { initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Note[] | null>(null);
  const [, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      try {
        const res = await callAction(callAction, notificationsAction);
        if (res.ok) {
          setItems(res.data.items);
          setUnread(res.data.unread);
        } else setItems([]);
      } catch {
        setItems([]);
      }
    });
  }

  return (
    <Popover onOpenChange={(o) => o && load()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}>
          <Bell />
          {unread > 0 && <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-4 font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() =>
                startTransition(async () => {
                  const res = await callAction(callAction, markNotificationsReadAction).catch(() => null);
                  if (!res?.ok) return;
                  setUnread(0);
                  setItems((list) => list?.map((n) => ({ ...n, read: true })) ?? null);
                })
              }
            >
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items === null ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            items.map((n) => (
              <Link key={n.id} href={n.link ?? "#"} className="flex gap-2 border-b px-3 py-2.5 text-sm last:border-0 hover:bg-accent">
                <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-primary"}`} aria-hidden />
                <span className="min-w-0">
                  <span className="block font-medium">{n.title}</span>
                  {n.body && <span className="block truncate text-muted-foreground">{n.body}</span>}
                  <span className="block text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                </span>
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AppHeader({ user, unread, onToggleSidebar }: { user: HeaderUser; unread: number; onToggleSidebar: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-4">
      <Button variant="ghost" size="icon" onClick={onToggleSidebar} aria-label="Toggle navigation">
        <PanelLeft />
      </Button>
      <div className="flex min-w-0 flex-1 justify-center sm:justify-start">
        <GlobalSearch />
      </div>
      <Notifications initialUnread={unread} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Account menu">
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(user.fullName)}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-36 truncate text-sm font-medium md:inline">{user.fullName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <div className="truncate text-sm font-medium">{user.fullName}</div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {user.roleLabel} · {user.employeeCode}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/team-members/${user.id}`}>
              <User /> My profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings?tab=account">
              <KeyRound /> Change password
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <form action={logoutAction}>
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full">
                <LogOut /> Sign out
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

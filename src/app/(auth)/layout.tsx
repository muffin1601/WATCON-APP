import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-6 flex items-center">
        <Logo className="h-10" priority />
      </div>
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-xs">{children}</div>
      <p className="mt-6 text-xs text-muted-foreground">Authorized personnel only. Activity is logged.</p>
    </div>
  );
}

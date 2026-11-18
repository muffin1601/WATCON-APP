import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Company wordmark. Both variants are rendered and toggled with the `.dark`
 * class so the correct one shows on first paint without a hydration flash.
 * logo1.png = dark text (light theme), logo2.png = white text (dark theme).
 */
export function Logo({ className, priority }: { className?: string; priority?: boolean }) {
  const img = "h-full w-auto object-contain";
  return (
    <span className={cn("relative inline-flex h-7 shrink-0", className)}>
      <Image src="/logo1.png" alt="Watcon International" width={1127} height={246} priority={priority} className={cn(img, "dark:hidden")} />
      <Image src="/logo2.png" alt="Watcon International" width={1127} height={246} priority={priority} className={cn(img, "hidden dark:block")} />
    </span>
  );
}

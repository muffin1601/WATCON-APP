"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/states";

/** Route error boundary. Never renders error details (no stack traces to users). */
export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      description="This page could not be loaded. If the problem continues, contact your administrator."
      action={
        <Button variant="outline" onClick={() => reset()}>
          Try again
        </Button>
      }
    />
  );
}

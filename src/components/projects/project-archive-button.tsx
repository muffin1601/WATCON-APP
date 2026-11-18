"use client";

import { callAction } from "@/lib/call-action";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/dialogs";
import { Button } from "@/components/ui/button";
import { setProjectArchivedAction } from "@/modules/projects/actions";

export function ProjectArchiveButton({ projectId, name, archived }: { projectId: string; name: string; archived: boolean }) {
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="outline">
          {archived ? <ArchiveRestore /> : <Archive />} {archived ? "Restore" : "Archive"}
        </Button>
      }
      title={archived ? "Restore project?" : "Archive project?"}
      description={archived ? `${name} will return to the active project directory.` : `${name} will be hidden from the default directory and closed for new tasks and status updates. All tasks and history are kept.`}
      confirmLabel={archived ? "Restore" : "Archive"}
      onConfirm={async () => {
        const res = await callAction(setProjectArchivedAction, projectId, !archived);
        if (res.ok) toast.success(archived ? "Project restored" : "Project archived");
        else toast.error(res.error);
        return res.ok;
      }}
    />
  );
}

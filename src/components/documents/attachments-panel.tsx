"use client";

import { Camera, CheckCircle2, Download, Eye, FileText, History, ImageIcon, Loader2, MapPin, Paperclip, RefreshCcw, ShieldAlert, Trash2, Upload, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog, FormDialog } from "@/components/shared/dialogs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/call-action";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deleteAttachmentAction, verifyAttachmentAction } from "@/modules/documents/actions";
import type { AttachmentView } from "@/modules/documents/attachments";
import { ATTACHMENT_CATEGORIES, CATEGORY_LABELS, type AttachmentCategory } from "@/modules/documents/categories";

export type AttachmentsData = {
  items: AttachmentView[];
  canUpload: boolean;
  canVerify: boolean;
  canDelete: boolean;
  locked: boolean;
  enforceSegregation: boolean;
  maxUploadMb: number;
};

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,.heic,.xlsx,.csv";
const sizeLabel = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function StatusPill({ s }: { s: AttachmentView["verificationStatus"] }) {
  const map = {
    PENDING: "border-amber-200 bg-amber-50 text-amber-800",
    VERIFIED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
  } as const;
  return <span className={cn("rounded-md border px-1.5 py-px text-[11px] font-medium", map[s])}>{s === "PENDING" ? "Unverified" : s === "VERIFIED" ? "Verified" : "Rejected"}</span>;
}

/** Reads the device location only after an explicit user choice; failures are non-fatal. */
function getPosition(): Promise<GeolocationPosition | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }));
}

function UploadForm({ entityType, entityId, defaultCategory, categories, replaces, maxUploadMb, onDone }: { entityType: string; entityId: string; defaultCategory: AttachmentCategory; categories: readonly AttachmentCategory[]; replaces?: AttachmentView; maxUploadMb: number; onDone: () => void }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<AttachmentCategory>((replaces?.category as AttachmentCategory) ?? defaultCategory);
  const [description, setDescription] = useState(replaces?.description ?? "");
  const [withLocation, setWithLocation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  function pick(list: FileList | null) {
    if (!list?.length) return;
    const chosen = replaces ? [list[0]!] : Array.from(list);
    const tooBig = chosen.find((f) => f.size > maxUploadMb * 1048576);
    setError(tooBig ? `${tooBig.name} is larger than ${maxUploadMb} MB.` : null);
    setFiles(chosen.filter((f) => f.size <= maxUploadMb * 1048576));
  }

  async function submit() {
    if (!files.length) {
      setError("Choose at least one file.");
      return;
    }
    setBusy(true);
    const pos = withLocation ? await getPosition() : null;
    if (withLocation && !pos) toast.warning("Location unavailable — uploading without it.");
    let ok = 0;
    for (const f of files) {
      const fd = new FormData();
      fd.set("file", f);
      fd.set("entityType", entityType);
      fd.set("entityId", entityId);
      fd.set("category", category);
      if (description) fd.set("description", description);
      if (replaces) fd.set("replacesId", replaces.id);
      if (pos) {
        fd.set("latitude", String(pos.coords.latitude));
        fd.set("longitude", String(pos.coords.longitude));
        fd.set("accuracyM", String(Math.round(pos.coords.accuracy)));
      }
      fd.set("capturedAt", new Date(f.lastModified || Date.now()).toISOString());
      try {
        const res = await fetch("/api/attachments", { method: "POST", body: fd });
        const json = (await res.json().catch(() => ({ ok: false, error: "Upload failed." }))) as { ok: boolean; error?: string };
        if (!json.ok) toast.error(`${f.name}: ${json.error ?? "Upload failed."}`);
        else ok++;
      } catch {
        toast.error(`${f.name}: network error — check your connection and retry. The record itself is saved.`);
      }
    }
    setBusy(false);
    if (ok) {
      toast.success(`${ok} file${ok > 1 ? "s" : ""} uploaded.`);
      router.refresh();
      onDone();
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files);
        }}
        className={cn("flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors", drag ? "border-primary bg-primary/5" : "border-muted-foreground/25")}
      >
        <Upload className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">Drag files here, or</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Paperclip /> Choose {replaces ? "file" : "files"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => camRef.current?.click()}>
            <Camera /> Take photo
          </Button>
        </div>
        <input ref={fileRef} type="file" accept={ACCEPT} multiple={!replaces} className="sr-only" onChange={(e) => pick(e.target.files)} aria-label="Choose files" />
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files)} aria-label="Take photo" />
        <p className="text-xs text-muted-foreground">PDF, JPEG, PNG, WebP, HEIC, XLSX or CSV · max {maxUploadMb} MB each</p>
      </div>
      {files.length > 0 && (
        <ul className="space-y-1 text-sm">
          {files.map((f) => (
            <li key={f.name + f.size} className="flex items-center gap-2">
              {f.type.startsWith("image/") ? <ImageIcon className="size-4 text-muted-foreground" /> : <FileText className="size-4 text-muted-foreground" />}
              <span className="truncate">{f.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{sizeLabel(f.size)}</span>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="att-cat" className="text-sm font-medium">
            Category
          </label>
          <Select value={category} onValueChange={(v) => setCategory(v as AttachmentCategory)}>
            <SelectTrigger id="att-cat" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <Checkbox checked={withLocation} onCheckedChange={(v) => setWithLocation(v === true)} />
          <MapPin className="size-4 text-muted-foreground" /> Record my location
        </label>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="att-desc" className="text-sm font-medium">
          Description
        </label>
        <Textarea id="att-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={busy || !files.length}>
          {busy && <Loader2 className="animate-spin" />} Upload
        </Button>
      </div>
    </div>
  );
}

function VerifyButtons({ item, ownUpload }: { item: AttachmentView; ownUpload: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  if (ownUpload) return null;
  return (
    <>
      {item.verificationStatus !== "VERIFIED" && (
        <Button
          size="icon-sm"
          variant="ghost"
          title="Mark verified"
          aria-label={`Verify ${item.fileName}`}
          onClick={async () => {
            const res = await callAction(verifyAttachmentAction, item.id, { status: "VERIFIED" });
            if (res.ok) {
              toast.success("Marked verified.");
              router.refresh();
            } else toast.error(res.error);
          }}
        >
          <CheckCircle2 className="text-emerald-600" />
        </Button>
      )}
      {item.verificationStatus !== "REJECTED" && (
        <ConfirmDialog
          trigger={
            <Button size="icon-sm" variant="ghost" title="Reject" aria-label={`Reject ${item.fileName}`}>
              <XCircle className="text-rose-600" />
            </Button>
          }
          title="Reject this evidence?"
          description={<Textarea rows={2} placeholder="Reason (required)" value={note} onChange={(e) => setNote(e.target.value)} />}
          confirmLabel="Reject"
          destructive
          onConfirm={async () => {
            const res = await callAction(verifyAttachmentAction, item.id, { status: "REJECTED", note });
            if (!res.ok) {
              toast.error(res.error);
              return false;
            }
            toast.success("Evidence rejected.");
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function DeleteButton({ item }: { item: AttachmentView }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  return (
    <ConfirmDialog
      trigger={
        <Button size="icon-sm" variant="ghost" title="Remove" aria-label={`Remove ${item.fileName}`}>
          <Trash2 />
        </Button>
      }
      title="Remove this file?"
      description={
        <span className="block space-y-2">
          <span className="block">The file is hidden from the record but kept in the audit history.</span>
          <Input placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
        </span>
      }
      confirmLabel="Remove"
      destructive
      onConfirm={async () => {
        const res = await callAction(deleteAttachmentAction, item.id, { reason });
        if (!res.ok) {
          toast.error(res.error);
          return false;
        }
        toast.success("File removed.");
        router.refresh();
      }}
    />
  );
}

/**
 * Evidence panel for any record. Server pages pass `data` from listAttachments(); every
 * action is re-authorised on the server.
 */
export function AttachmentsPanel({ entityType, entityId, data, currentUserId, title = "Documents & evidence", defaultCategory = "OTHER", categories = ATTACHMENT_CATEGORIES }: { entityType: string; entityId: string; data: AttachmentsData; currentUserId: string; title?: string; defaultCategory?: AttachmentCategory; categories?: readonly AttachmentCategory[] }) {
  const [showHistory, setShowHistory] = useState<string | null>(null);
  return (
    <section className="rounded-xl border bg-card" aria-label={title}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip className="size-4 text-muted-foreground" /> {title}
          <span className="rounded-full bg-muted px-1.5 text-xs font-normal text-muted-foreground tabular-nums">{data.items.length}</span>
        </h2>
        {data.canUpload && (
          <FormDialog
            title="Upload documents"
            description="Files are stored privately and only visible to people who can see this record."
            trigger={
              <Button size="sm" variant="outline">
                <Upload /> Upload
              </Button>
            }
          >
            {(close) => <UploadForm entityType={entityType} entityId={entityId} defaultCategory={defaultCategory} categories={categories} maxUploadMb={data.maxUploadMb} onDone={close} />}
          </FormDialog>
        )}
      </div>
      {data.locked && (
        <p className="flex items-center gap-1.5 border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <ShieldAlert className="size-3.5" /> This record is posted/approved — attached evidence is retained and cannot be removed.
        </p>
      )}
      {data.items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No documents attached yet.</p>
      ) : (
        <ul className="divide-y">
          {data.items.map((a) => {
            const isImage = a.mimeType.startsWith("image/") && a.mimeType !== "image/heic";
            const previewable = isImage || a.mimeType === "application/pdf";
            return (
              <li key={a.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private, authorised file URL (not optimisable)
                    <img src={`/api/attachments/${a.id}?inline=1`} alt="" className="size-10 shrink-0 rounded-md border object-cover" loading="lazy" />
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted/50">
                      <FileText className="size-4 text-muted-foreground" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{a.fileName}</span>
                      {a.version > 1 && <span className="text-xs text-muted-foreground">v{a.version}</span>}
                      <StatusPill s={a.verificationStatus} />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_LABELS[a.category as AttachmentCategory] ?? a.category} · {sizeLabel(a.sizeBytes)} · {a.uploadedBy} · {formatDateTime(a.createdAt)}
                      {a.hasLocation && (
                        <a className="ml-1 inline-flex items-center gap-0.5 hover:underline" href={`https://www.openstreetmap.org/?mlat=${a.latitude}&mlon=${a.longitude}#map=18/${a.latitude}/${a.longitude}`} target="_blank" rel="noreferrer noopener">
                          <MapPin className="size-3" /> location
                        </a>
                      )}
                    </p>
                    {a.description && <p className="text-xs text-foreground/80">{a.description}</p>}
                    {a.verificationStatus !== "PENDING" && (
                      <p className="text-xs text-muted-foreground">
                        {a.verificationStatus === "VERIFIED" ? "Verified" : "Rejected"} by {a.verifiedBy} {a.verifiedAt ? `· ${formatDateTime(a.verifiedAt)}` : ""}
                        {a.verificationNote ? ` — ${a.verificationNote}` : ""}
                      </p>
                    )}
                    {showHistory === a.id && a.history.length > 0 && (
                      <ul className="mt-1 space-y-0.5 border-l pl-2 text-xs text-muted-foreground">
                        {a.history.map((h) => (
                          <li key={h.id}>
                            <a href={`/api/attachments/${h.id}`} className="hover:underline">
                              v{h.version} · {h.fileName}
                            </a>{" "}
                            · {h.uploadedBy} · {formatDateTime(h.createdAt)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 self-end sm:self-auto">
                  {previewable && (
                    <Button asChild size="icon-sm" variant="ghost" title="Preview">
                      <a href={`/api/attachments/${a.id}?inline=1`} target="_blank" rel="noreferrer" aria-label={`Preview ${a.fileName}`}>
                        <Eye />
                      </a>
                    </Button>
                  )}
                  <Button asChild size="icon-sm" variant="ghost" title="Download">
                    <a href={`/api/attachments/${a.id}`} aria-label={`Download ${a.fileName}`}>
                      <Download />
                    </a>
                  </Button>
                  {a.history.length > 0 && (
                    <Button size="icon-sm" variant="ghost" title="Version history" aria-label="Version history" onClick={() => setShowHistory(showHistory === a.id ? null : a.id)}>
                      <History />
                    </Button>
                  )}
                  {data.canUpload && (
                    <FormDialog
                      title={`New version of ${a.fileName}`}
                      trigger={
                        <Button size="icon-sm" variant="ghost" title="Upload new version" aria-label={`Upload new version of ${a.fileName}`}>
                          <RefreshCcw />
                        </Button>
                      }
                    >
                      {(close) => <UploadForm entityType={entityType} entityId={entityId} defaultCategory={a.category as AttachmentCategory} categories={categories} replaces={a} maxUploadMb={data.maxUploadMb} onDone={close} />}
                    </FormDialog>
                  )}
                  {data.canVerify && <VerifyButtons item={a} ownUpload={data.enforceSegregation && a.uploadedById === currentUserId} />}
                  {data.canDelete && a.verificationStatus !== "VERIFIED" && <DeleteButton item={a} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

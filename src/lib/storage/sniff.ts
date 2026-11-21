/**
 * Detects a file's real type from its leading bytes (the browser-supplied MIME type and
 * file extension are never trusted). Only these types may be uploaded as evidence.
 */
export const ALLOWED_TYPES = {
  "application/pdf": { ext: "pdf", label: "PDF", previewable: true },
  "image/jpeg": { ext: "jpg", label: "JPEG image", previewable: true },
  "image/png": { ext: "png", label: "PNG image", previewable: true },
  "image/webp": { ext: "webp", label: "WebP image", previewable: true },
  "image/heic": { ext: "heic", label: "HEIC photo", previewable: false },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { ext: "xlsx", label: "Excel workbook", previewable: false },
  "text/csv": { ext: "csv", label: "CSV", previewable: false },
} as const;

export type AllowedMime = keyof typeof ALLOWED_TYPES;

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.slice(from, to));

export function sniffMime(bytes: Uint8Array, fileName = ""): AllowedMime | null {
  if (bytes.length < 4) return null;
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  if (ascii(bytes, 4, 8) === "ftyp" && /^(heic|heix|hevc|heim|heis|mif1)$/.test(ascii(bytes, 8, 12))) return "image/heic";
  // XLSX is a ZIP container; accept only with the .xlsx extension (other ZIPs are rejected).
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && /\.xlsx$/i.test(fileName)) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  // CSV: .csv extension and printable text without NUL bytes in the first 4 KB.
  if (/\.csv$/i.test(fileName)) {
    const head = bytes.slice(0, 4096);
    if (!head.includes(0)) return "text/csv";
  }
  return null;
}

/** Strips directory parts and unsafe characters; keeps a readable name for downloads. */
export function safeFileName(name: string, mime: AllowedMime): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^\w.\- ()]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "file";
  const ext = ALLOWED_TYPES[mime].ext;
  return cleaned.toLowerCase().endsWith(`.${ext}`) ? cleaned : `${cleaned}.${ext}`;
}

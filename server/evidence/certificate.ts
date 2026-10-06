/**
 * Certificate checks: metadata extraction and risk SIGNALS (not a verdict).
 * PDF: pdf-lib info dictionary + raw structure (incremental updates, signature).
 * Images: EXIF via exifr.
 */
export interface CertMeta {
  kind: "pdf" | "image";
  creator?: string;
  producer?: string;
  software?: string;
  createdAt?: string;
  modifiedAt?: string;
  incrementalUpdates?: number;
  hasSignature?: boolean;
  hasExif?: boolean;
}

export interface CertCheck {
  code: "editor" | "modified_after" | "before_event" | "incremental" | "no_metadata" | "signed";
  title: string;
  risk: boolean;
}

const EDITORS = /photoshop|gimp|canva|paint|pixelmator|illustrator|affinity|inkscape|photopea|figma|ilovepdf|smallpdf|sejda|pdfescape|foxit phantom/i;

export function detectKind(buf: Buffer): "pdf" | "png" | "jpeg" | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "jpeg";
  return null;
}

export async function extractMeta(buf: Buffer): Promise<CertMeta> {
  const kind = detectKind(buf);
  if (kind === "pdf") {
    const { PDFDocument } = await import("pdf-lib");
    const raw = buf.toString("latin1");
    let doc: Awaited<ReturnType<typeof PDFDocument.load>> | null = null;
    try {
      doc = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
    } catch {
      /* broken PDF: raw checks only */
    }
    return {
      kind: "pdf",
      creator: doc?.getCreator() ?? undefined,
      producer: doc?.getProducer() ?? undefined,
      createdAt: doc?.getCreationDate()?.toISOString(),
      modifiedAt: doc?.getModificationDate()?.toISOString(),
      // Each incremental save appends a new trailer ending with %%EOF.
      incrementalUpdates: Math.max(0, (raw.match(/%%EOF/g) ?? []).length - 1),
      hasSignature: /\/Type\s*\/Sig\b|\/ByteRange\s*\[/.test(raw),
    };
  }
  if (kind === "png" || kind === "jpeg") {
    const exifr = (await import("exifr")).default;
    let exif: Record<string, unknown> | undefined;
    try {
      exif = (await exifr.parse(buf, { tiff: true, exif: true, xmp: true })) as Record<string, unknown> | undefined;
    } catch {
      exif = undefined;
    }
    const d = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === "string" ? v : undefined);
    return {
      kind: "image",
      software: (exif?.Software as string | undefined) ?? (exif?.CreatorTool as string | undefined),
      createdAt: d(exif?.DateTimeOriginal ?? exif?.CreateDate),
      modifiedAt: d(exif?.ModifyDate),
      hasExif: Boolean(exif && Object.keys(exif).length),
    };
  }
  throw new Error("unsupported");
}

export function assessCertificate(meta: CertMeta, eventDate?: string): { checks: CertCheck[]; trust: "high" | "medium" | "low" } {
  const checks: CertCheck[] = [];
  const tool = [meta.creator, meta.producer, meta.software].filter(Boolean).join(" ");
  if (EDITORS.test(tool)) checks.push({ code: "editor", title: `Файл собран или правлен в редакторе (${tool})`, risk: true });
  if (meta.createdAt && meta.modifiedAt && Date.parse(meta.modifiedAt) - Date.parse(meta.createdAt) > 24 * 3600_000) {
    checks.push({ code: "modified_after", title: "Файл изменён позже, чем через сутки после создания", risk: true });
  }
  if (eventDate && meta.createdAt && Date.parse(meta.createdAt) < Date.parse(eventDate) - 24 * 3600_000) {
    checks.push({ code: "before_event", title: "Дата создания файла раньше даты мероприятия", risk: true });
  }
  if ((meta.incrementalUpdates ?? 0) > 0 && !meta.hasSignature) {
    checks.push({ code: "incremental", title: `Есть инкрементальные изменения после первого сохранения (${meta.incrementalUpdates})`, risk: true });
  }
  if (meta.kind === "image" && !meta.hasExif) checks.push({ code: "no_metadata", title: "В изображении нет метаданных (скриншот или пересохранение)", risk: true });
  if (meta.kind === "pdf" && !meta.createdAt && !meta.producer) checks.push({ code: "no_metadata", title: "В PDF нет метаданных о создании", risk: true });
  if (meta.hasSignature) checks.push({ code: "signed", title: "PDF содержит электронную подпись (проверка цепочки сертификатов — в плане развития)", risk: false });
  const risks = checks.filter((c) => c.risk).length;
  const trust = risks === 0 && meta.hasSignature ? "high" : risks === 0 ? "medium" : "low";
  return { checks, trust };
}

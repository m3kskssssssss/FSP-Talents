import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { encodePng, imageKind, stripJpegMetadata, stripPngMetadata } from "@/server/lib/image";
import { extractResumePhoto, isPortraitLike } from "@/server/resume/photo";

const seg = (marker: number, body: string) => {
  const b = Buffer.from(body, "latin1");
  const len = Buffer.alloc(2);
  len.writeUInt16BE(b.length + 2);
  return Buffer.concat([Buffer.from([0xff, marker]), len, b]);
};

/** A solid-colour RGB square as PNG. */
const square = (w: number, h: number) => encodePng(new Uint8Array(w * h * 3).fill(120), w, h, 3);

describe("profile photo images", () => {
  it("sniffs JPEG and PNG, rejects anything else", () => {
    expect(imageKind(square(4, 4))).toBe("png");
    expect(imageKind(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("jpeg");
    expect(imageKind(Buffer.from("%PDF-1.7"))).toBeNull();
  });

  it("strips EXIF (APP1) and comments from JPEG but keeps JFIF and image data", () => {
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      seg(0xe0, "JFIF\0"),
      seg(0xe1, "Exif\0\0GPS 55.75,37.61"),
      seg(0xfe, "camera serial"),
      Buffer.from([0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9]),
    ]);
    const out = stripJpegMetadata(jpeg).toString("latin1");
    expect(out).not.toContain("GPS");
    expect(out).not.toContain("serial");
    expect(out).toContain("JFIF");
    expect(out.endsWith("\x01\x02\x03\xff\xd9")).toBe(true);
  });

  it("strips text chunks from PNG and keeps it decodable", () => {
    const png = square(8, 8);
    const text = Buffer.concat([
      Buffer.from([0, 0, 0, 9]),
      Buffer.from("tEXtAuthor\0Me", "latin1").subarray(0, 13),
      Buffer.alloc(4),
    ]);
    const withText = Buffer.concat([png.subarray(0, 33), text, png.subarray(33)]);
    const out = stripPngMetadata(withText);
    expect(out.includes(Buffer.from("tEXt"))).toBe(false);
    expect(out.equals(png)).toBe(true);
  });

  it("portrait heuristic skips icons, banners and page scans", () => {
    expect(isPortraitLike(300, 400)).toBe(true);
    expect(isPortraitLike(300, 300)).toBe(true);
    expect(isPortraitLike(64, 64)).toBe(false);
    expect(isPortraitLike(1440, 734)).toBe(false);
    expect(isPortraitLike(2480, 3508)).toBe(false);
  });

  it("finds the photo in a resume PDF and ignores a banner and a small logo", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    for (const [w, h] of [
      [900, 300],
      [60, 60],
      [240, 300],
    ] as const)
      page.drawImage(await doc.embedPng(square(w, h)), {
        x: 10,
        y: 10,
        width: w / 4,
        height: h / 4,
      });
    const { getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await doc.save()));
    const photo = await extractResumePhoto(pdf, pdf.numPages);
    expect(photo && imageKind(photo)).toBe("png");
    expect(photo!.readUInt32BE(16)).toBe(240);
    expect(photo!.readUInt32BE(20)).toBe(300);
  });

  it("returns null for a resume without pictures", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const { getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await doc.save()));
    expect(await extractResumePhoto(pdf, pdf.numPages)).toBeNull();
  });
});

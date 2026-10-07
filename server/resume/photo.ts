import { encodePng } from "../lib/image";

type Pdf = Parameters<typeof import("unpdf").extractImages>[0];

/** Resume photos sit on the first page; looking further mostly finds logos and certificates. */
const PAGES = 2;
const MIN_SIDE = 120;
const MAX_SIDE = 2400;

/**
 * Finds the candidate's photo in a resume PDF: the largest image on the first
 * pages that is shaped like a portrait (square to 1:1.8) and not tiny (icons,
 * logos) or page-sized (a scanned page). Returns a PNG, or null when nothing
 * looks like a photo. Never throws: a resume without a photo is normal.
 */
export async function extractResumePhoto(pdf: Pdf, totalPages: number): Promise<Buffer | null> {
  try {
    const { extractImages } = await import("unpdf");
    let best: {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      channels: 1 | 3 | 4;
    } | null = null;
    for (let page = 1; page <= Math.min(PAGES, totalPages); page++) {
      for (const img of await extractImages(pdf, page)) {
        if (!isPortraitLike(img.width, img.height)) continue;
        if (!best || img.width * img.height > best.width * best.height) best = img;
      }
      if (best) break;
    }
    return best ? encodePng(best.data, best.width, best.height, best.channels) : null;
  } catch {
    return null;
  }
}

export function isPortraitLike(width: number, height: number) {
  if (Math.min(width, height) < MIN_SIDE || Math.max(width, height) > MAX_SIDE) return false;
  const ratio = height / width;
  return ratio >= 0.8 && ratio <= 1.8;
}

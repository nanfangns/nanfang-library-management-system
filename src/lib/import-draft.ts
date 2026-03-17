import { z } from "zod";

import type { ImportDraft } from "./types";

export const IMPORT_DRAFT_COOKIE = "book-import-draft";
const IMPORT_DRAFT_MAX_AGE = 60 * 30;
const currentYear = new Date().getFullYear();

const importDraftCookieSchema = z.object({
  provider: z.literal("OPEN_LIBRARY"),
  sourceLabel: z.string().trim().min(1).max(40),
  sourceUrl: z.string().trim().url().nullable(),
  title: z.string().trim().max(160).nullable(),
  author: z.string().trim().max(140).nullable(),
  isbn: z.string().trim().max(32).nullable(),
  category: z.string().trim().max(30).nullable(),
  publishedYear: z.number().int().min(1000).max(currentYear + 1).nullable(),
  publisher: z.string().trim().max(80).nullable(),
  language: z.string().trim().max(32).nullable(),
  pageCount: z.number().int().positive().max(100000).nullable(),
  coverUrl: z.string().trim().url().nullable(),
  location: z.string().trim().max(30).nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  status: z.enum(["AVAILABLE", "BORROWED", "MAINTENANCE"]).nullable(),
  summary: z.string().trim().max(280).nullable(),
});

export function getImportDraftCookieOptions() {
  return {
    httpOnly: true,
    maxAge: IMPORT_DRAFT_MAX_AGE,
    path: "/",
    sameSite: "lax" as const,
  };
}

export function serializeImportDraft(draft: ImportDraft) {
  return encodeURIComponent(JSON.stringify(importDraftCookieSchema.parse(draft)));
}

export function parseImportDraft(cookieValue: string | undefined | null) {
  if (!cookieValue) {
    return null;
  }

  try {
    return importDraftCookieSchema.parse(JSON.parse(decodeURIComponent(cookieValue)));
  } catch {
    return null;
  }
}

import { z } from "zod";

import type { BookFormValues, BookInput, ExternalBookCandidate, ImportDraft } from "./types";

const OPEN_LIBRARY_BASE_URL = "https://openlibrary.org";
const OPEN_LIBRARY_REVALIDATE_SECONDS = 60 * 60;
const SEARCH_RESULT_LIMIT = 12;
const SEARCH_FIELDS =
  "key,title,author_name,first_publish_year,isbn,publisher,language,number_of_pages_median,cover_i,subject";
const currentYear = new Date().getFullYear();
const THREE_BODY_VOLUME_ALIASES = {
  2: ["黑暗森林", "The Dark Forest"],
  3: ["死神永生", "Death's End"],
} as const;

type SupportedSeriesVolume = keyof typeof THREE_BODY_VOLUME_ALIASES;

type OpenLibrarySearchDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  publisher?: string[];
  language?: string[];
  number_of_pages_median?: number;
  cover_i?: number;
  subject?: string[];
};

type OpenLibrarySearchResponse = {
  docs?: OpenLibrarySearchDoc[];
};

type OpenLibraryBookData = {
  key?: string;
  title?: string;
  authors?: Array<{ name?: string }>;
  identifiers?: {
    isbn_10?: string[];
    isbn_13?: string[];
  };
  publishers?: Array<{ name?: string }>;
  publish_date?: string;
  number_of_pages?: number;
  cover?: {
    small?: string;
    medium?: string;
    large?: string;
  };
  subjects?: Array<{ name?: string }>;
  excerpts?: Array<{ text?: string }>;
  url?: string;
};

type SearchQueryPlan = {
  kind: "alias" | "base";
  priority: number;
  query: string;
  seriesVolume: SupportedSeriesVolume | null;
};

export const externalBookCandidateSchema = z.object({
  provider: z.literal("OPEN_LIBRARY"),
  rawKey: z.string().trim().min(1).max(160),
  sourceLabel: z.string().trim().min(1).max(40),
  title: z.string().trim().max(160),
  author: z.string().trim().max(140),
  isbn: z.string().trim().max(32),
  publishedYear: z.number().int().min(1000).max(currentYear + 1).nullable(),
  publisher: z.string().trim().max(80).nullable(),
  language: z.string().trim().max(32).nullable(),
  pageCount: z.number().int().positive().max(100000).nullable(),
  coverUrl: z.string().trim().url().nullable(),
  summary: z.string().trim().max(280).nullable(),
  categories: z.array(z.string().trim().max(60)).max(6),
  sourceUrl: z.string().trim().url().nullable(),
  canQuickImport: z.boolean(),
});

const importDraftSchema = z.object({
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

function cleanText(value: unknown, maxLength = 160) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmedValue = value.trim().replace(/\s+/g, " ");
  return trimmedValue.slice(0, maxLength);
}

function normalizeSpaces(value: string) {
  return value.replace(/[\s\u3000]+/g, " ").trim();
}

function normalizeFullWidthDigits(value: string) {
  return value.replace(/[０-９]/g, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
  );
}

function normalizeComparableText(value: string) {
  return normalizeFullWidthDigits(cleanText(value, 200))
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[()\-_,.:;!?/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactComparableText(value: string) {
  return normalizeComparableText(value).replace(/\s+/g, "");
}

function buildStableRawKey(...values: Array<string | null | undefined>) {
  const parts = values.map((value) => cleanText(value, 80)).filter(Boolean);
  return parts.join("-").slice(0, 160) || "open-library-candidate";
}

function cleanOptionalText(value: unknown, maxLength = 160) {
  const cleanedValue = cleanText(value, maxLength);
  return cleanedValue.length > 0 ? cleanedValue : null;
}

function cleanList(values: unknown, maxLength: number, limit: number) {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const items: string[] = [];

  for (const value of values) {
    const cleanedValue = cleanText(value, maxLength);

    if (!cleanedValue || seen.has(cleanedValue)) {
      continue;
    }

    seen.add(cleanedValue);
    items.push(cleanedValue);

    if (items.length >= limit) {
      break;
    }
  }

  return items;
}

function normalizeLanguage(value: unknown) {
  const cleanedValue = cleanText(value, 32);

  if (!cleanedValue) {
    return null;
  }

  const normalizedValue = cleanedValue.includes("/")
    ? cleanedValue.slice(cleanedValue.lastIndexOf("/") + 1)
    : cleanedValue;

  return normalizedValue.toLowerCase();
}

function normalizeIsbn(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/[^0-9Xx]/g, "").toUpperCase();
}

function pickPrimaryIsbn(values: unknown) {
  if (!Array.isArray(values)) {
    return "";
  }

  const normalizedIsbns = values
    .map((value) => normalizeIsbn(value))
    .filter((value) => value.length >= 10);

  return (
    normalizedIsbns.find((value) => value.length === 13) ??
    normalizedIsbns.find((value) => value.length === 10) ??
    normalizedIsbns[0] ??
    ""
  );
}

function extractYear(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value >= 1000 && value <= currentYear + 1 ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const matchedYear = value.match(/\b(1[0-9]{3}|20[0-9]{2}|2100)\b/);

  if (!matchedYear) {
    return null;
  }

  const parsedYear = Number.parseInt(matchedYear[0], 10);
  return parsedYear >= 1000 && parsedYear <= currentYear + 1 ? parsedYear : null;
}

function getOpenLibraryHeaders() {
  const appName =
    cleanText(process.env.OPEN_LIBRARY_APP_NAME, 40) || "nanfang-library-management-system";
  const contactEmail = cleanText(process.env.OPEN_LIBRARY_CONTACT_EMAIL, 80);
  const userAgent = contactEmail
    ? `${appName} (${contactEmail})`
    : `${appName} (local development)`;

  return {
    Accept: "application/json",
    "User-Agent": userAgent,
  };
}

async function fetchOpenLibraryJson<T>(url: URL) {
  const response = await fetch(url, {
    headers: getOpenLibraryHeaders(),
    next: {
      revalidate: OPEN_LIBRARY_REVALIDATE_SECONDS,
    },
  });

  if (!response.ok) {
    throw new Error(`Open Library request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

function getSummaryFromBookData(book: OpenLibraryBookData) {
  const excerpt = book.excerpts?.find((item) => cleanText(item.text, 400).length > 0)?.text;
  return cleanOptionalText(excerpt, 280);
}

function getSourceUrl(rawValue: string | undefined) {
  const cleanedValue = cleanText(rawValue, 160);

  if (!cleanedValue) {
    return null;
  }

  return cleanedValue.startsWith("http")
    ? cleanedValue
    : `${OPEN_LIBRARY_BASE_URL}${cleanedValue}`;
}

function finalizeCandidate(candidate: Omit<ExternalBookCandidate, "canQuickImport">) {
  return externalBookCandidateSchema.parse({
    ...candidate,
    canQuickImport: Boolean(
      candidate.title.trim() &&
        candidate.author.trim() &&
        candidate.isbn.trim() &&
        typeof candidate.publishedYear === "number",
    ),
  });
}

function mapSearchDocToCandidate(doc: OpenLibrarySearchDoc) {
  const title = cleanText(doc.title, 160);
  const author = cleanList(doc.author_name, 60, 2).join(" / ");
  const isbn = pickPrimaryIsbn(doc.isbn);
  const publishedYear = extractYear(doc.first_publish_year);
  const publisher = cleanOptionalText(doc.publisher?.[0], 80);
  const language = normalizeLanguage(doc.language?.[0]);
  const pageCount =
    typeof doc.number_of_pages_median === "number" && doc.number_of_pages_median > 0
      ? Math.round(doc.number_of_pages_median)
      : null;
  const coverUrl =
    typeof doc.cover_i === "number"
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : null;
  const categories = cleanList(doc.subject, 30, 4);
  const sourceUrl = getSourceUrl(doc.key);
  const rawKey = cleanText(doc.key, 160) || buildStableRawKey(title, author, isbn);

  return finalizeCandidate({
    provider: "OPEN_LIBRARY",
    rawKey,
    sourceLabel: "Open Library",
    title,
    author,
    isbn,
    publishedYear,
    publisher,
    language,
    pageCount,
    coverUrl,
    summary: null,
    categories,
    sourceUrl,
  });
}

function mapBookDataToCandidate(requestedIsbn: string, book: OpenLibraryBookData) {
  const title = cleanText(book.title, 160);
  const author = cleanList(
    book.authors?.map((item) => item.name),
    60,
    2,
  ).join(" / ");
  const isbn =
    pickPrimaryIsbn(book.identifiers?.isbn_13) ||
    pickPrimaryIsbn(book.identifiers?.isbn_10) ||
    normalizeIsbn(requestedIsbn);
  const publishedYear = extractYear(book.publish_date);
  const publisher = cleanOptionalText(book.publishers?.[0]?.name, 80);
  const pageCount =
    typeof book.number_of_pages === "number" && book.number_of_pages > 0
      ? Math.round(book.number_of_pages)
      : null;
  const categories = cleanList(
    book.subjects?.map((item) => item.name),
    30,
    4,
  );
  const sourceUrl = getSourceUrl(book.url ?? book.key);
  const rawKey =
    cleanText(book.key, 160) || buildStableRawKey(title, author, isbn, normalizeIsbn(requestedIsbn));

  return finalizeCandidate({
    provider: "OPEN_LIBRARY",
    rawKey,
    sourceLabel: "Open Library",
    title,
    author,
    isbn,
    publishedYear,
    publisher,
    language: null,
    pageCount,
    coverUrl: book.cover?.medium ?? book.cover?.large ?? book.cover?.small ?? null,
    summary: getSummaryFromBookData(book),
    categories,
    sourceUrl,
  });
}

function dedupeCandidates(candidates: ExternalBookCandidate[]) {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = candidate.isbn.trim() || candidate.rawKey;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function isLikelyIsbnQuery(value: string) {
  const normalizedValue = normalizeIsbn(value);
  return normalizedValue.length === 10 || normalizedValue.length === 13;
}

function getSearchQueryLength(value: string) {
  return [...value].length;
}

function detectThreeBodyVolume(query: string): SupportedSeriesVolume | null {
  const compactQuery = compactComparableText(query);
  let remainder = "";

  if (compactQuery.startsWith("三体")) {
    remainder = compactQuery.slice("三体".length);
  } else if (compactQuery.startsWith("threebody")) {
    remainder = compactQuery.slice("threebody".length);
  } else if (compactQuery.startsWith("thethreebodyproblem")) {
    remainder = compactQuery.slice("thethreebodyproblem".length);
  }

  if (!remainder) {
    return null;
  }

  if (/^(?:第)?(?:2|ii|二)$/.test(remainder)) {
    return 2;
  }

  if (/^(?:第)?(?:3|iii|三)$/.test(remainder)) {
    return 3;
  }

  return null;
}

function buildSearchPlans(query: string) {
  const trimmedQuery = normalizeSpaces(query);
  const seriesVolume = detectThreeBodyVolume(trimmedQuery);
  const plans: SearchQueryPlan[] = [
    {
      kind: "base",
      priority: 0,
      query: trimmedQuery,
      seriesVolume,
    },
  ];

  if (!seriesVolume) {
    return plans;
  }

  const seenQueries = new Set([compactComparableText(trimmedQuery)]);

  for (const aliasQuery of THREE_BODY_VOLUME_ALIASES[seriesVolume]) {
    const compactAliasQuery = compactComparableText(aliasQuery);

    if (seenQueries.has(compactAliasQuery)) {
      continue;
    }

    seenQueries.add(compactAliasQuery);
    plans.push({
      kind: "alias",
      priority: plans.length,
      query: aliasQuery,
      seriesVolume,
    });
  }

  return plans;
}

async function searchOpenLibraryByText(query: string) {
  const trimmedQuery = normalizeSpaces(query);
  const url = new URL("/search.json", OPEN_LIBRARY_BASE_URL);
  const isShortQuery = getSearchQueryLength(trimmedQuery) < 3;

  url.searchParams.set(isShortQuery ? "title" : "q", trimmedQuery);
  url.searchParams.set("limit", String(SEARCH_RESULT_LIMIT));
  url.searchParams.set("fields", SEARCH_FIELDS);

  const response = await fetchOpenLibraryJson<OpenLibrarySearchResponse>(url);
  return (response.docs ?? []).map(mapSearchDocToCandidate);
}

function getAliasMatchTokens(seriesVolume: SupportedSeriesVolume | null) {
  if (!seriesVolume) {
    return [];
  }

  return THREE_BODY_VOLUME_ALIASES[seriesVolume].map((value) => normalizeComparableText(value));
}

function getVolumeHintMatchScore(candidateTitle: string, seriesVolume: SupportedSeriesVolume) {
  const compactTitle = compactComparableText(candidateTitle);

  if (compactTitle.includes(`seriesbook${seriesVolume}`)) {
    return 110;
  }

  if (
    compactTitle.includes(`book${seriesVolume}`) ||
    compactTitle.includes(`vol${seriesVolume}`) ||
    compactTitle.includes(`volume${seriesVolume}`) ||
    compactTitle.includes(`part${seriesVolume}`) ||
    compactTitle.includes(`第${seriesVolume}`) ||
    compactTitle.includes(`卷${seriesVolume}`)
  ) {
    return 80;
  }

  return 0;
}

function scoreCandidate(candidate: ExternalBookCandidate, plan: SearchQueryPlan) {
  const normalizedTitle = normalizeComparableText(candidate.title);
  const normalizedAuthor = normalizeComparableText(candidate.author);
  const normalizedQuery = normalizeComparableText(plan.query);
  const aliasTokens = getAliasMatchTokens(plan.seriesVolume);
  let score = 0;

  if (normalizedQuery && normalizedTitle === normalizedQuery) {
    score += 130;
  } else if (normalizedQuery && normalizedTitle.startsWith(normalizedQuery)) {
    score += 95;
  } else if (normalizedQuery && normalizedTitle.includes(normalizedQuery)) {
    score += 65;
  }

  if (plan.kind === "alias") {
    score += 25;
  }

  if (aliasTokens.some((token) => normalizedTitle.includes(token))) {
    score += 210;
  }

  if (plan.seriesVolume) {
    const volumeHintScore = getVolumeHintMatchScore(candidate.title, plan.seriesVolume);

    score += volumeHintScore;

    if (volumeHintScore === 0 && compactComparableText(candidate.title) === "三体") {
      score -= 220;
    }
  }

  if (normalizedAuthor.includes(normalizeComparableText("刘慈欣"))) {
    score += 12;
  }

  if (typeof candidate.publishedYear === "number") {
    score += Math.min(candidate.publishedYear - 1900, 30);
  }

  score -= plan.priority * 2;

  return score;
}

function mergeSearchResults(
  settledResults: PromiseSettledResult<ExternalBookCandidate[]>[],
  plans: SearchQueryPlan[],
) {
  const rankedCandidates = new Map<
    string,
    {
      candidate: ExternalBookCandidate;
      score: number;
    }
  >();

  settledResults.forEach((result, index) => {
    if (result.status !== "fulfilled") {
      return;
    }

    const plan = plans[index];

    result.value.forEach((candidate, candidateIndex) => {
      const score = scoreCandidate(candidate, plan) + Math.max(18 - candidateIndex, 0);
      const key = candidate.isbn.trim() || candidate.rawKey;
      const existing = rankedCandidates.get(key);

      if (!existing || score > existing.score) {
        rankedCandidates.set(key, { candidate, score });
      }
    });
  });

  return [...rankedCandidates.values()]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (right.candidate.publishedYear ?? 0) - (left.candidate.publishedYear ?? 0);
    })
    .map((item) => item.candidate);
}

export async function searchExternalBooks(query: string) {
  const trimmedQuery = normalizeSpaces(query);

  if (!trimmedQuery) {
    return [];
  }

  if (isLikelyIsbnQuery(trimmedQuery)) {
    const exactMatch = await lookupOpenLibraryByIsbn(trimmedQuery);

    if (exactMatch) {
      return [exactMatch];
    }
  }

  const plans = buildSearchPlans(trimmedQuery);
  const settledResults = await Promise.allSettled(
    plans.map((plan) => searchOpenLibraryByText(plan.query)),
  );
  const successfulResults = settledResults.filter(
    (result): result is PromiseFulfilledResult<ExternalBookCandidate[]> =>
      result.status === "fulfilled",
  );

  if (successfulResults.length === 0) {
    const firstRejectedResult = settledResults.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    throw firstRejectedResult?.reason instanceof Error
      ? firstRejectedResult.reason
      : new Error("Open Library request failed.");
  }

  const candidates = mergeSearchResults(settledResults, plans);

  return dedupeCandidates(candidates);
}

export async function lookupOpenLibraryByIsbn(query: string) {
  const normalizedIsbn = normalizeIsbn(query);

  if (!normalizedIsbn) {
    return null;
  }

  const url = new URL("/api/books", OPEN_LIBRARY_BASE_URL);

  url.searchParams.set("bibkeys", `ISBN:${normalizedIsbn}`);
  url.searchParams.set("jscmd", "data");
  url.searchParams.set("format", "json");

  const response = await fetchOpenLibraryJson<Record<string, OpenLibraryBookData>>(url);
  const book = response[`ISBN:${normalizedIsbn}`];

  return book ? mapBookDataToCandidate(normalizedIsbn, book) : null;
}

export function serializeExternalBookCandidate(candidate: ExternalBookCandidate) {
  return JSON.stringify(externalBookCandidateSchema.parse(candidate));
}

export function parseExternalBookCandidate(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    return externalBookCandidateSchema.parse(JSON.parse(value));
  } catch {
    return null;
  }
}

function getDraftCategory(candidate: ExternalBookCandidate) {
  return candidate.categories[0] ?? "待分类";
}

export function createImportDraft(candidate: ExternalBookCandidate): ImportDraft {
  return importDraftSchema.parse({
    provider: candidate.provider,
    sourceLabel: candidate.sourceLabel,
    sourceUrl: candidate.sourceUrl,
    title: candidate.title || null,
    author: candidate.author || null,
    isbn: candidate.isbn || null,
    category: getDraftCategory(candidate),
    publishedYear: candidate.publishedYear,
    publisher: candidate.publisher,
    language: candidate.language,
    pageCount: candidate.pageCount,
    coverUrl: candidate.coverUrl,
    location: "待编目",
    rating: 4,
    status: "AVAILABLE",
    summary: candidate.summary,
  });
}

export function importDraftToFormValues(draft: ImportDraft): BookFormValues {
  return {
    title: draft.title ?? "",
    author: draft.author ?? "",
    isbn: draft.isbn ?? "",
    category: draft.category ?? "",
    publishedYear: draft.publishedYear ?? undefined,
    publisher: draft.publisher ?? "",
    language: draft.language ?? "",
    pageCount: draft.pageCount ?? undefined,
    coverUrl: draft.coverUrl ?? "",
    location: draft.location ?? "",
    rating: draft.rating ?? 4,
    status: draft.status ?? "AVAILABLE",
    summary: draft.summary ?? "",
  };
}

export function importDraftToBookInput(draft: ImportDraft): BookInput | null {
  if (
    !draft.title?.trim() ||
    !draft.author?.trim() ||
    !draft.isbn?.trim() ||
    typeof draft.publishedYear !== "number"
  ) {
    return null;
  }

  return {
    title: draft.title.trim(),
    author: draft.author.trim(),
    isbn: draft.isbn.trim(),
    category: (draft.category ?? "待分类").trim() || "待分类",
    publishedYear: draft.publishedYear,
    publisher: draft.publisher ?? null,
    language: draft.language ?? null,
    pageCount: draft.pageCount ?? null,
    coverUrl: draft.coverUrl ?? null,
    location: (draft.location ?? "待编目").trim() || "待编目",
    rating: draft.rating ?? 4,
    status: draft.status ?? "AVAILABLE",
    summary: draft.summary ?? null,
  };
}

export function getExternalBookTitle(candidate: ExternalBookCandidate) {
  return candidate.title || "未命名图书";
}

export function getExternalBookAuthor(candidate: ExternalBookCandidate) {
  return candidate.author || "作者信息缺失";
}

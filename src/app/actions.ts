"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { bookSchema } from "@/lib/books";
import {
  createImportDraft,
  importDraftToBookInput,
  parseExternalBookCandidate,
} from "@/lib/external-books";
import {
  DuplicateIsbnError,
  deleteBook,
  getBookByIsbn,
  saveBook,
} from "@/lib/database";
import {
  IMPORT_DRAFT_COOKIE,
  getImportDraftCookieOptions,
  serializeImportDraft,
} from "@/lib/import-draft";
import type { BookFormState } from "@/lib/types";

function getSafeRedirectPath(value: FormDataEntryValue | null, fallback: string) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

function appendQueryParam(path: string, key: string, value: string) {
  const url = new URL(path, "http://localhost");

  url.searchParams.set(key, value);

  return `${url.pathname}${url.search}`;
}

export async function saveBookAction(
  _previousState: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const parsed = bookSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    author: formData.get("author"),
    isbn: formData.get("isbn"),
    category: formData.get("category"),
    publishedYear: formData.get("publishedYear"),
    publisher: formData.get("publisher"),
    language: formData.get("language"),
    pageCount: formData.get("pageCount"),
    coverUrl: formData.get("coverUrl"),
    location: formData.get("location"),
    rating: formData.get("rating"),
    status: formData.get("status"),
    summary: formData.get("summary"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { id, summary, ...data } = parsed.data;

  try {
    saveBook({
      id,
      ...data,
      summary: summary || null,
    });
  } catch (error) {
    if (error instanceof DuplicateIsbnError) {
      return {
        errors: {
          isbn: ["ISBN 已存在，请确认后再保存。"],
        },
      };
    }

    return {
      errors: {
        form: ["保存失败，请稍后再试。"],
      },
    };
  }

  if (!id) {
    const cookieStore = await cookies();
    cookieStore.delete(IMPORT_DRAFT_COOKIE);
  }

  revalidatePath("/books");
  redirect(`/books?notice=${id ? "updated" : "created"}`);
}

export async function deleteBookAction(formData: FormData) {
  const id = formData.get("id");

  if (typeof id !== "string" || id.trim().length === 0) {
    return;
  }

  deleteBook(id);

  revalidatePath("/books");
  redirect("/books?notice=deleted");
}

export async function storeImportDraftAction(formData: FormData) {
  const candidate = parseExternalBookCandidate(formData.get("candidate"));
  const redirectTo = getSafeRedirectPath(formData.get("redirectTo"), "/books/new");

  if (!candidate) {
    redirect(appendQueryParam(redirectTo, "feedback", "invalid"));
  }

  const draft = createImportDraft(candidate);
  const cookieStore = await cookies();

  cookieStore.set(IMPORT_DRAFT_COOKIE, serializeImportDraft(draft), getImportDraftCookieOptions());
  redirect(redirectTo);
}

export async function clearImportDraftAction(formData: FormData) {
  const redirectTo = getSafeRedirectPath(formData.get("redirectTo"), "/books/new");
  const cookieStore = await cookies();

  cookieStore.delete(IMPORT_DRAFT_COOKIE);
  redirect(redirectTo);
}

export async function quickImportExternalBookAction(formData: FormData) {
  const redirectTo = getSafeRedirectPath(formData.get("redirectTo"), "/books/import");
  const candidate = parseExternalBookCandidate(formData.get("candidate"));

  if (!candidate) {
    redirect(appendQueryParam(redirectTo, "feedback", "invalid"));
  }

  const importInput = importDraftToBookInput(createImportDraft(candidate));

  if (!importInput) {
    redirect(appendQueryParam(redirectTo, "feedback", "incomplete"));
  }

  if (getBookByIsbn(importInput.isbn)) {
    redirect(appendQueryParam(redirectTo, "feedback", "duplicate"));
  }

  try {
    saveBook(importInput);
  } catch (error) {
    if (error instanceof DuplicateIsbnError) {
      redirect(appendQueryParam(redirectTo, "feedback", "duplicate"));
    }

    redirect(appendQueryParam(redirectTo, "feedback", "invalid"));
  }

  revalidatePath("/books");
  redirect("/books?notice=created");
}

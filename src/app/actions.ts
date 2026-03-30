"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { bookSchema } from "@/lib/books";
import { checkoutSchema, returnLoanSchema } from "@/lib/loans";
import { memberSchema } from "@/lib/members";
import {
  createImportDraft,
  importDraftToBookInput,
  parseExternalBookCandidate,
} from "@/lib/external-books";
import {
  ActiveLoanConflictError,
  BookHasActiveLoanError,
  BookUnavailableError,
  DuplicateIsbnError,
  DuplicateMemberCodeError,
  LoanNotFoundError,
  MemberHasActiveLoansError,
  MemberInactiveError,
  checkoutBook,
  deleteBook,
  getBookByIsbn,
  returnBook,
  saveBook,
  saveMember,
} from "@/lib/database";
import {
  IMPORT_DRAFT_COOKIE,
  getImportDraftCookieOptions,
  serializeImportDraft,
} from "@/lib/import-draft";
import type { BookFormState, MemberFormState } from "@/lib/types";

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
    await saveBook({
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
  revalidatePath("/");

  if (id) {
    revalidatePath(`/books/${id}`);
  }

  redirect(`/books?notice=${id ? "updated" : "created"}`);
}

export async function deleteBookAction(formData: FormData) {
  const id = formData.get("id");

  if (typeof id !== "string" || id.trim().length === 0) {
    return;
  }

  try {
    await deleteBook(id);
  } catch (error) {
    if (error instanceof BookHasActiveLoanError) {
      redirect("/books?notice=delete-blocked");
    }

    redirect("/books?notice=delete-blocked");
  }

  revalidatePath("/");
  revalidatePath("/books");
  redirect("/books?notice=deleted");
}

const initialMemberState: MemberFormState = {
  errors: {},
};

export async function saveMemberAction(
  _previousState: MemberFormState = initialMemberState,
  formData: FormData,
): Promise<MemberFormState> {
  const parsed = memberSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    memberCode: formData.get("memberCode"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { id, ...data } = parsed.data;

  try {
    await saveMember({
      id,
      ...data,
    });
  } catch (error) {
    if (error instanceof DuplicateMemberCodeError) {
      return {
        errors: {
          memberCode: ["成员编号已存在，请换一个编号。"],
        },
      };
    }

    if (error instanceof MemberHasActiveLoansError) {
      return {
        errors: {
          status: ["该成员还有未归还借阅，不能直接停用。"],
        },
      };
    }

    return {
      errors: {
        form: ["保存成员资料失败，请稍后再试。"],
      },
    };
  }

  revalidatePath("/");
  revalidatePath("/members");
  revalidatePath("/loans");
  redirect(`/members?notice=${id ? "updated" : "created"}`);
}

export async function checkoutBookAction(formData: FormData) {
  const redirectTo = getSafeRedirectPath(formData.get("redirectTo"), "/books");
  const parsed = checkoutSchema.safeParse({
    bookId: formData.get("bookId"),
    memberId: formData.get("memberId"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    redirect(appendQueryParam(redirectTo, "notice", "missing-member"));
  }

  try {
    await checkoutBook(parsed.data);
  } catch (error) {
    if (error instanceof BookUnavailableError) {
      redirect(appendQueryParam(redirectTo, "notice", "unavailable"));
    }

    if (error instanceof MemberInactiveError) {
      redirect(appendQueryParam(redirectTo, "notice", "inactive-member"));
    }

    if (error instanceof ActiveLoanConflictError) {
      redirect(appendQueryParam(redirectTo, "notice", "loan-conflict"));
    }

    redirect(appendQueryParam(redirectTo, "notice", "loan-conflict"));
  }

  revalidatePath("/");
  revalidatePath("/books");
  revalidatePath("/loans");
  revalidatePath("/members");
  revalidatePath(`/books/${parsed.data.bookId}`);
  redirect(appendQueryParam(redirectTo, "notice", "checked-out"));
}

export async function returnBookAction(formData: FormData) {
  const redirectTo = getSafeRedirectPath(formData.get("redirectTo"), "/loans");
  const parsed = returnLoanSchema.safeParse({
    bookId: formData.get("bookId"),
    loanId: formData.get("loanId"),
  });

  if (!parsed.success) {
    redirect(appendQueryParam(redirectTo, "notice", "missing-loan"));
  }

  try {
    await returnBook(parsed.data);
  } catch (error) {
    if (error instanceof LoanNotFoundError) {
      redirect(appendQueryParam(redirectTo, "notice", "missing-loan"));
    }

    redirect(appendQueryParam(redirectTo, "notice", "missing-loan"));
  }

  revalidatePath("/");
  revalidatePath("/books");
  revalidatePath("/loans");
  revalidatePath("/members");
  revalidatePath(`/books/${parsed.data.bookId}`);
  redirect(appendQueryParam(redirectTo, "notice", "returned"));
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

  if (await getBookByIsbn(importInput.isbn)) {
    redirect(appendQueryParam(redirectTo, "feedback", "duplicate"));
  }

  try {
    await saveBook(importInput);
  } catch (error) {
    if (error instanceof DuplicateIsbnError) {
      redirect(appendQueryParam(redirectTo, "feedback", "duplicate"));
    }

    redirect(appendQueryParam(redirectTo, "feedback", "invalid"));
  }

  revalidatePath("/books");
  redirect("/books?notice=created");
}

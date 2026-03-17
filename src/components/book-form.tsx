"use client";

import Link from "next/link";
import { useActionState } from "react";

import { saveBookAction } from "@/app/actions";
import type { BookFormState, BookFormValues } from "@/lib/types";

import { BookFormFields } from "./book-form-fields";
import { SubmitButton } from "./submit-button";

const initialState: BookFormState = {
  errors: {},
};

type BookFormProps = {
  book: BookFormValues | null;
  submitLabel: string;
  pendingLabel: string;
  cancelHref?: string;
  cancelLabel?: string;
  helperText?: string;
};

export function BookForm({
  book,
  submitLabel,
  pendingLabel,
  cancelHref = "/books",
  cancelLabel = "返回列表",
  helperText,
}: BookFormProps) {
  const [state, formAction] = useActionState(saveBookAction, initialState);

  return (
    <form action={formAction} className="editor-form">
      <input defaultValue={book?.id ?? ""} name="id" type="hidden" />

      {state.errors?.form ? <div className="form-alert">{state.errors.form[0]}</div> : null}

      <BookFormFields book={book} errors={state.errors} />

      <div className="editor-actions">
        <SubmitButton
          className="primary-button"
          idleLabel={submitLabel}
          pendingLabel={pendingLabel}
        />
        <Link className="ghost-button" href={cancelHref}>
          {cancelLabel}
        </Link>
      </div>

      {helperText ? <p className="helper-copy">{helperText}</p> : null}
    </form>
  );
}

"use client";

import Link from "next/link";
import { useActionState } from "react";

import { saveMemberAction } from "@/app/actions";
import type { MemberFormState, MemberFormValues } from "@/lib/types";

import { MemberFormFields } from "./member-form-fields";
import { SubmitButton } from "./submit-button";

const initialState: MemberFormState = {
  errors: {},
};

type MemberFormProps = {
  member: MemberFormValues | null;
  submitLabel: string;
  pendingLabel: string;
  cancelHref?: string;
  cancelLabel?: string;
  helperText?: string;
};

export function MemberForm({
  member,
  submitLabel,
  pendingLabel,
  cancelHref = "/members",
  cancelLabel = "返回成员列表",
  helperText,
}: MemberFormProps) {
  const [state, formAction] = useActionState(saveMemberAction, initialState);

  return (
    <form action={formAction} className="editor-form">
      <input defaultValue={member?.id ?? ""} name="id" type="hidden" />

      {state.errors?.form ? <div className="form-alert">{state.errors.form[0]}</div> : null}

      <MemberFormFields errors={state.errors} member={member} />

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

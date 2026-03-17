"use client";

import { useFormStatus } from "react-dom";

export function DeleteButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="ghost-button danger-button"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm("确认删除这本书吗？")) {
          event.preventDefault();
        }
      }}
      type="submit"
    >
      {pending ? "删除中..." : "删除"}
    </button>
  );
}


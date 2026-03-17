import type { BookStatus } from "@/lib/types";

import { getStatusMeta } from "@/lib/books";

export function StatusBadge({ status }: { status: BookStatus }) {
  const meta = getStatusMeta(status);

  return <span className={`status-badge status-badge--${meta.tone}`}>{meta.label}</span>;
}

import { getLoanStateMeta } from "@/lib/loans";
import type { Loan } from "@/lib/types";

export function LoanStateBadge({ loan }: { loan: Pick<Loan, "dueAt" | "returnedAt" | "isOverdue"> }) {
  const meta = getLoanStateMeta(loan);

  return <span className={`status-badge status-badge--${meta.tone}`}>{meta.label}</span>;
}

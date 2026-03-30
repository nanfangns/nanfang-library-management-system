import { getMemberStatusMeta } from "@/lib/members";
import type { MemberStatus } from "@/lib/types";

export function MemberStatusBadge({ status }: { status: MemberStatus }) {
  const meta = getMemberStatusMeta(status);

  return <span className={`status-badge status-badge--${meta.tone}`}>{meta.label}</span>;
}

import Link from "next/link";
import { Mail, PencilLine, Phone, UserSquare2 } from "lucide-react";

import { MemberStatusBadge } from "@/components/member-status-badge";
import type { Member } from "@/lib/types";

export function MemberCard({ member }: { member: Member }) {
  return (
    <article className="book-card member-card">
      <div className="book-card__top">
        <div className="book-card__identity">
          <div className="book-avatar book-avatar--green">
            {member.name.slice(0, 1).toUpperCase()}
          </div>

          <div>
            <div className="book-card__heading">
              <h3>{member.name}</h3>
              <MemberStatusBadge status={member.status} />
            </div>
            <p className="book-card__author">编号 {member.memberCode}</p>
          </div>
        </div>

        <div className="book-actions">
          <Link className="ghost-button" href={`/members/${member.id}/edit`}>
            <PencilLine size={16} />
            编辑
          </Link>
        </div>
      </div>

      <div className="book-meta-grid">
        <span className="meta-chip">
          <UserSquare2 size={15} />
          活跃借阅 {member.activeLoanCount}
        </span>
        {member.phone ? (
          <span className="meta-chip">
            <Phone size={15} />
            {member.phone}
          </span>
        ) : null}
        {member.email ? (
          <span className="meta-chip">
            <Mail size={15} />
            {member.email}
          </span>
        ) : null}
      </div>
    </article>
  );
}

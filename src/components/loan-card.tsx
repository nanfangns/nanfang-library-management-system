import Link from "next/link";
import { BookOpenText, CalendarDays, RotateCcw, UserSquare2 } from "lucide-react";

import { returnBookAction } from "@/app/actions";
import { LoanStateBadge } from "@/components/loan-state-badge";
import { formatLoanDate } from "@/lib/loans";
import type { Loan } from "@/lib/types";

export function LoanCard({
  loan,
  redirectTo,
}: {
  loan: Loan;
  redirectTo: string;
}) {
  return (
    <article className="book-card loan-card">
      <div className="book-card__top">
        <div className="book-card__identity">
          <div className="book-avatar book-avatar--blue">
            {loan.bookTitle.slice(0, 1).toUpperCase()}
          </div>

          <div>
            <div className="book-card__heading">
              <h3>{loan.bookTitle}</h3>
              <LoanStateBadge loan={loan} />
            </div>
            <p className="book-card__author">
              {loan.memberName} · {loan.memberCode}
            </p>
          </div>
        </div>

        <div className="book-actions">
          <Link className="secondary-button" href={`/books/${loan.bookId}`}>
            查看图书
          </Link>

          {!loan.returnedAt ? (
            <form action={returnBookAction}>
              <input name="bookId" type="hidden" value={loan.bookId} />
              <input name="loanId" type="hidden" value={loan.id} />
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <button className="ghost-button" type="submit">
                <RotateCcw size={16} />
                归还
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="book-meta-grid">
        <span className="meta-chip">
          <BookOpenText size={15} />
          ISBN {loan.bookIsbn}
        </span>
        <span className="meta-chip">
          <UserSquare2 size={15} />
          {loan.memberName}
        </span>
        <span className="meta-chip">
          <CalendarDays size={15} />
          借出 {formatLoanDate(loan.borrowedAt)}
        </span>
        <span className="meta-chip">
          <CalendarDays size={15} />
          应还 {formatLoanDate(loan.dueAt)}
        </span>
        {loan.returnedAt ? (
          <span className="meta-chip">
            <CalendarDays size={15} />
            归还 {formatLoanDate(loan.returnedAt)}
          </span>
        ) : null}
      </div>

      {loan.notes ? <p className="book-summary">{loan.notes}</p> : null}
    </article>
  );
}

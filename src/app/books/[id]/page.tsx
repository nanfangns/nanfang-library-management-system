import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRightLeft,
  BookOpenText,
  CalendarDays,
  Clock3,
  MapPin,
  RotateCcw,
  UserSquare2,
} from "lucide-react";

import { checkoutBookAction, returnBookAction } from "@/app/actions";
import { LoanCard } from "@/components/loan-card";
import { LoanStateBadge } from "@/components/loan-state-badge";
import { StatusBadge } from "@/components/status-badge";
import { getBookTone } from "@/lib/books";
import { getActiveMembers, getBookDetailView } from "@/lib/database";
import { formatLoanDate, getLoanNoticeMessage } from "@/lib/loans";

type BookDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function BookDetailPage({ params, searchParams }: BookDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const detail = await getBookDetailView(id);

  if (!detail) {
    notFound();
  }

  const members = await getActiveMembers();
  const notice = getLoanNoticeMessage(getSearchValue(resolvedSearchParams.notice));
  const { book, currentLoan, loanHistory } = detail;
  const tone = getBookTone(book.title);
  const redirectTo = `/books/${book.id}`;

  return (
    <main className="page-shell">
      <section className="page-top">
        <div>
          <p className="eyebrow">图书详情</p>
          <h1 className="page-title">{book.title}</h1>
          <p className="page-description">围绕这本书查看借阅状态、发起借出，并追踪历史记录。</p>
        </div>

        <div className="page-top__actions">
          <Link className="ghost-button" href="/books">
            返回图书列表
          </Link>
          <Link className="primary-button" href={`/books/${book.id}/edit`}>
            编辑资料
          </Link>
        </div>
      </section>

      {notice ? <div className="notice-banner">{notice}</div> : null}

      <section className="detail-hero panel">
        <div className="detail-hero__identity">
          {book.coverUrl ? (
            <div className="detail-book-cover">
              <Image
                alt={`${book.title} 封面`}
                className="book-cover__image"
                height={240}
                referrerPolicy="no-referrer"
                src={book.coverUrl}
                unoptimized
                width={176}
              />
            </div>
          ) : (
            <div className={`book-avatar detail-book-avatar book-avatar--${tone}`}>
              {book.title.slice(0, 1).toUpperCase()}
            </div>
          )}

          <div className="detail-hero__copy">
            <div className="book-card__heading">
              <h2>{book.title}</h2>
              <StatusBadge status={book.status} />
            </div>
            <p className="book-card__author">{book.author}</p>
            <div className="book-meta-grid">
              <span className="meta-chip">
                <BookOpenText size={15} />
                {book.category}
              </span>
              <span className="meta-chip">
                <MapPin size={15} />
                {book.location}
              </span>
              <span className="meta-chip">
                <Clock3 size={15} />
                {book.publishedYear}
              </span>
              <span className="meta-chip">
                <CalendarDays size={15} />
                更新于 {formatLoanDate(book.updatedAt)}
              </span>
            </div>
            <p className="book-summary">
              {book.summary?.trim().length
                ? book.summary
                : "这本书还没有填写简介，可以在编辑页继续补全。"}
            </p>
          </div>
        </div>
      </section>

      <section className="editor-layout editor-layout--edit detail-layout">
        <section className="panel form-panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">借阅动作</p>
              <h2>{currentLoan ? "当前借阅" : "发起借阅"}</h2>
            </div>
            {currentLoan ? (
              <span className="chip chip--yellow">
                <ArrowRightLeft size={14} />
                借阅中
              </span>
            ) : null}
          </div>

          {currentLoan ? (
            <div className="detail-loan-panel">
              <div className="book-card__heading">
                <h3>{currentLoan.memberName}</h3>
                <LoanStateBadge loan={currentLoan} />
              </div>

              <div className="book-meta-grid">
                <span className="meta-chip">
                  <UserSquare2 size={15} />
                  {currentLoan.memberCode}
                </span>
                <span className="meta-chip">
                  <CalendarDays size={15} />
                  借出 {formatLoanDate(currentLoan.borrowedAt)}
                </span>
                <span className="meta-chip">
                  <CalendarDays size={15} />
                  应还 {formatLoanDate(currentLoan.dueAt)}
                </span>
              </div>

              {currentLoan.notes ? <p className="book-summary">{currentLoan.notes}</p> : null}

              <form action={returnBookAction}>
                <input name="bookId" type="hidden" value={book.id} />
                <input name="loanId" type="hidden" value={currentLoan.id} />
                <input name="redirectTo" type="hidden" value={redirectTo} />
                <button className="primary-button" type="submit">
                  <RotateCcw size={16} />
                  归还图书
                </button>
              </form>
            </div>
          ) : book.status === "MAINTENANCE" ? (
            <section className="empty-state detail-empty">
              <div className="empty-state__icon">
                <RotateCcw size={24} />
              </div>
              <h3>维护中的图书不能借出</h3>
              <p>如果要恢复借阅，请先去编辑页把状态改回在馆可借。</p>
            </section>
          ) : members.length > 0 ? (
            <form action={checkoutBookAction} className="editor-form">
              <input name="bookId" type="hidden" value={book.id} />
              <input name="redirectTo" type="hidden" value={redirectTo} />

              <label className="field">
                <span className="field__label">借阅成员</span>
                <select defaultValue="" name="memberId">
                  <option value="">请选择一位成员</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} · {member.memberCode}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field field--full">
                <span className="field__label">备注</span>
                <textarea
                  name="notes"
                  placeholder="例如：项目调研借阅、课程阅读等"
                  rows={4}
                />
              </label>

              <p className="helper-copy">借出后系统会自动生成 30 天借期，并把图书状态改为借出中。</p>

              <button className="primary-button" type="submit">
                发起借阅
              </button>
            </form>
          ) : (
            <section className="empty-state detail-empty">
              <div className="empty-state__icon">
                <UserSquare2 size={24} />
              </div>
              <h3>还没有可借阅成员</h3>
              <p>先去创建至少一个活跃成员，才能继续完成借出流程。</p>
              <div className="welcome-actions">
                <Link className="primary-button" href="/members/new">
                  新增成员
                </Link>
              </div>
            </section>
          )}
        </section>

        <aside className="editor-sidebar">
          <section className="panel side-panel">
            <h2>馆藏信息</h2>
            <div className="detail-list">
              <div className="detail-item">
                <span className="detail-item__label">ISBN</span>
                <strong>{book.isbn}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-item__label">出版社</span>
                <strong>{book.publisher || "未填写"}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-item__label">语言</span>
                <strong>{book.language || "未填写"}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-item__label">页数</span>
                <strong>{book.pageCount || "未填写"}</strong>
              </div>
            </div>
          </section>
        </aside>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">借阅历史</p>
            <h2>历史记录</h2>
          </div>
          <span className="chip chip--blue">{loanHistory.length} 条记录</span>
        </div>

        {loanHistory.length > 0 ? (
          <div className="external-books-grid external-books-grid--embedded">
            {loanHistory.map((loan) => (
              <LoanCard key={loan.id} loan={loan} redirectTo={redirectTo} />
            ))}
          </div>
        ) : (
          <section className="empty-state detail-empty">
            <div className="empty-state__icon">
              <ArrowRightLeft size={24} />
            </div>
            <h3>这本书还没有借阅历史</h3>
            <p>完成第一次借阅后，记录会自动出现在这里。</p>
          </section>
        )}
      </section>
    </main>
  );
}

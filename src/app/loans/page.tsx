import Link from "next/link";
import { Waypoints } from "lucide-react";

import { LoanCard } from "@/components/loan-card";
import {
  SearchResultsSurface,
  SearchToolbar,
  SearchTransitionProvider,
} from "@/components/search-experience";
import { getLoans } from "@/lib/database";
import {
  LOAN_STATUS_FILTER_OPTIONS,
  type LoanStatusFilter,
  getLoanNoticeMessage,
  isLoanStatusFilter,
} from "@/lib/loans";

type LoansPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function LoansPage({ searchParams }: LoansPageProps) {
  const resolvedSearchParams = await searchParams;
  const query = getSearchValue(resolvedSearchParams.q);
  const rawStatus = getSearchValue(resolvedSearchParams.status);
  const notice = getLoanNoticeMessage(getSearchValue(resolvedSearchParams.notice));
  const statusFilter: LoanStatusFilter = isLoanStatusFilter(rawStatus) ? rawStatus : "ALL";
  const loans = await getLoans(query, statusFilter);
  const redirectTo = query
    ? `/loans?q=${encodeURIComponent(query)}${statusFilter !== "ALL" ? `&status=${statusFilter}` : ""}`
    : statusFilter !== "ALL"
      ? `/loans?status=${statusFilter}`
      : "/loans";

  return (
    <main className="page-shell">
      <section className="page-top">
        <div>
          <p className="eyebrow">借阅中心</p>
          <h1 className="page-title">借阅记录</h1>
          <p className="page-description">查看借阅中、已归还和已逾期记录，并从这里完成归还。</p>
        </div>

        <div className="page-top__actions">
          <Link className="ghost-button" href="/members/new">
            新增成员
          </Link>
          <Link className="primary-button" href="/books">
            前往图书列表
          </Link>
        </div>
      </section>

      {notice ? <div className="notice-banner">{notice}</div> : null}

      <SearchTransitionProvider>
        <section className="panel toolbar-panel">
          <div className="panel__header">
            <div>
              <h2>筛选借阅</h2>
              <p className="section-copy">支持按图书、ISBN、成员姓名和成员编号搜索。</p>
            </div>
            <span className="chip chip--blue">{loans.length} 条记录</span>
          </div>

          <SearchToolbar
            filterField={{
              clearValue: "ALL",
              label: "状态",
              name: "status",
              options: LOAN_STATUS_FILTER_OPTIONS.map((option) => ({
                label: option.label,
                value: option.value,
              })),
              value: statusFilter,
            }}
            queryKey="q"
            queryPlaceholder="搜索图书、ISBN、成员姓名或成员编号"
            queryValue={query}
            submitLabel="筛选"
            submitPendingLabel="检索中..."
            submitTone="secondary"
          />
        </section>

        <SearchResultsSurface>
          {loans.length > 0 ? (
            <section className="books-grid">
              {loans.map((loan) => (
                <LoanCard key={loan.id} loan={loan} redirectTo={redirectTo} />
              ))}
            </section>
          ) : (
            <section className="panel empty-state">
              <div className="empty-state__icon">
                <Waypoints size={24} />
              </div>
              <h3>当前没有匹配的借阅记录</h3>
              <p>可以调整筛选条件，或者先去图书详情页发起新的借阅。</p>
              <div className="welcome-actions">
                <Link className="primary-button" href="/books">
                  查看图书
                </Link>
              </div>
            </section>
          )}
        </SearchResultsSurface>
      </SearchTransitionProvider>
    </main>
  );
}

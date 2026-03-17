import Link from "next/link";
import { Search } from "lucide-react";

import { BookCard } from "@/components/book-card";
import {
  SearchResultsSurface,
  SearchToolbar,
  SearchTransitionProvider,
} from "@/components/search-experience";
import {
  BOOK_STATUS_OPTIONS,
  type StatusFilter,
  getNoticeMessage,
  isBookStatus,
} from "@/lib/books";
import { getCatalogBooks } from "@/lib/database";

type BooksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function BooksPage({ searchParams }: BooksPageProps) {
  const resolvedSearchParams = await searchParams;
  const query = getSearchValue(resolvedSearchParams.q);
  const rawStatus = getSearchValue(resolvedSearchParams.status);
  const notice = getNoticeMessage(getSearchValue(resolvedSearchParams.notice));
  const statusFilter: StatusFilter = rawStatus && isBookStatus(rawStatus) ? rawStatus : "ALL";
  const books = getCatalogBooks(query, statusFilter);

  return (
    <main className="page-shell">
      <section className="page-top">
        <div>
          <p className="eyebrow">图书列表</p>
          <h1 className="page-title">馆藏总览</h1>
          <p className="page-description">搜索、筛选、浏览和删除都集中在这里完成。</p>
        </div>

        <div className="page-top__actions">
          <Link className="ghost-button" href="/books/import">
            导入图书
          </Link>
          <Link className="primary-button" href="/books/new">
            录入新书
          </Link>
        </div>
      </section>

      {notice ? <div className="notice-banner">{notice}</div> : null}

      <SearchTransitionProvider>
        <section className="panel toolbar-panel">
          <div className="panel__header">
            <div>
              <h2>检索馆藏</h2>
              <p className="section-copy">按书名、作者、ISBN 或分类快速定位。</p>
            </div>
            <span className="chip chip--blue">{books.length} 本</span>
          </div>

          <SearchToolbar
            filterField={{
              clearValue: "ALL",
              label: "状态",
              name: "status",
              options: [
                { label: "全部状态", value: "ALL" },
                ...BOOK_STATUS_OPTIONS.map((option) => ({
                  label: option.label,
                  value: option.value,
                })),
              ],
              value: statusFilter,
            }}
            queryKey="q"
            queryPlaceholder="搜索书名、作者、ISBN、分类"
            queryValue={query}
            resetLabel="重置"
            submitLabel="筛选"
            submitPendingLabel="检索中..."
            submitTone="secondary"
          />
        </section>

        <SearchResultsSurface>
          {books.length > 0 ? (
            <section className="books-grid">
              {books.map((book) => (
                <BookCard book={book} key={book.id} />
              ))}
            </section>
          ) : (
            <section className="panel empty-state">
              <div className="empty-state__icon">
                <Search size={24} />
              </div>
              <h3>没有找到匹配的图书</h3>
              <p>可以调整搜索词或状态筛选，也可以直接去录入一本新书。</p>
              <div className="welcome-actions">
                <Link className="ghost-button" href="/books/import">
                  导入图书
                </Link>
                <Link className="primary-button" href="/books/new">
                  新增图书
                </Link>
              </div>
            </section>
          )}
        </SearchResultsSurface>
      </SearchTransitionProvider>
    </main>
  );
}

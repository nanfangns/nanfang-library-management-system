import Link from "next/link";
import { Download, Search } from "lucide-react";

import { ExternalBookCard } from "@/components/external-book-card";
import {
  SearchResultsSurface,
  SearchToolbar,
  SearchTransitionProvider,
} from "@/components/search-experience";
import { getImportFeedbackMessage } from "@/lib/books";
import { getBooksByIsbns } from "@/lib/database";
import { searchExternalBooks } from "@/lib/external-books";

type ImportBooksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function ImportBooksPage({ searchParams }: ImportBooksPageProps) {
  const resolvedSearchParams = await searchParams;
  const query = getSearchValue(resolvedSearchParams.q);
  const feedback = getImportFeedbackMessage(getSearchValue(resolvedSearchParams.feedback));
  const redirectTo = query ? `/books/import?q=${encodeURIComponent(query)}` : "/books/import";
  let searchError: string | null = null;
  let results = [] as Awaited<ReturnType<typeof searchExternalBooks>>;

  if (query) {
    try {
      results = await searchExternalBooks(query);
    } catch {
      searchError = "外部图书数据暂时不可用，请稍后重试。";
    }
  }

  const existingBooks = await getBooksByIsbns(results.map((candidate) => candidate.isbn));

  return (
    <main className="page-shell">
      <section className="page-top">
        <div>
          <p className="eyebrow">外部导入</p>
          <h1 className="page-title">导入图书</h1>
          <p className="page-description">
            从 Open Library 检索公开图书资料，补全后再落到本地馆藏。
          </p>
        </div>

        <div className="page-top__actions">
          <Link className="ghost-button" href="/books">
            返回列表
          </Link>
          <Link className="primary-button" href="/books/new">
            手动录入
          </Link>
        </div>
      </section>

      {feedback ? <div className="notice-banner notice-banner--warning">{feedback}</div> : null}
      {searchError ? <div className="notice-banner notice-banner--warning">{searchError}</div> : null}

      <SearchTransitionProvider>
        <section className="panel toolbar-panel">
          <div className="panel__header">
            <div>
              <h2>搜索外部书目</h2>
              <p className="section-copy">支持关键词和 ISBN，首版接入 Open Library。</p>
            </div>
            <span className="chip chip--blue">{results.length} 条结果</span>
          </div>

          <SearchToolbar
            queryKey="q"
            queryPlaceholder="搜索书名、作者或直接输入 ISBN"
            queryValue={query}
            resetLabel="清空"
            submitLabel="搜索"
            submitPendingLabel="搜索中..."
            submitTone="primary"
          />
        </section>

        <SearchResultsSurface>
          {!query ? (
            <section className="panel empty-state">
              <div className="empty-state__icon">
                <Download size={24} />
              </div>
              <h3>先搜一本书</h3>
              <p>输入关键词或 ISBN，就能把外部书目资料带到本地馆藏流程里。</p>
            </section>
          ) : results.length > 0 ? (
            <section className="external-books-grid">
              {results.map((candidate) => (
                <ExternalBookCard
                  candidate={candidate}
                  existingBook={existingBooks.get(candidate.isbn)}
                  key={candidate.rawKey}
                  mode="import"
                  redirectTo={redirectTo}
                />
              ))}
            </section>
          ) : !searchError ? (
            <section className="panel empty-state">
              <div className="empty-state__icon">
                <Search size={24} />
              </div>
              <h3>没有找到可导入的图书</h3>
              <p>可以换一个关键词，或者直接输入更准确的 ISBN 再试一次。</p>
            </section>
          ) : null}
        </SearchResultsSurface>
      </SearchTransitionProvider>
    </main>
  );
}

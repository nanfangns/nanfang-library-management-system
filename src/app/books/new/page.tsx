import Link from "next/link";
import { cookies } from "next/headers";
import { BookmarkPlus, ChevronRight, PencilRuler, Search, Sparkles } from "lucide-react";

import { clearImportDraftAction } from "@/app/actions";
import { BookForm } from "@/components/book-form";
import { ExternalBookCard } from "@/components/external-book-card";
import {
  SearchResultsSurface,
  SearchToolbar,
  SearchTransitionProvider,
} from "@/components/search-experience";
import { getImportFeedbackMessage } from "@/lib/books";
import { getBooksByIsbns } from "@/lib/database";
import { importDraftToFormValues, searchExternalBooks } from "@/lib/external-books";
import { IMPORT_DRAFT_COOKIE, parseImportDraft } from "@/lib/import-draft";

type NewBookPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function NewBookPage({ searchParams }: NewBookPageProps) {
  const resolvedSearchParams = await searchParams;
  const lookup = getSearchValue(resolvedSearchParams.lookup);
  const feedback = getImportFeedbackMessage(getSearchValue(resolvedSearchParams.feedback));
  const redirectTo = lookup ? `/books/new?lookup=${encodeURIComponent(lookup)}` : "/books/new";
  const cookieStore = await cookies();
  const draft = parseImportDraft(cookieStore.get(IMPORT_DRAFT_COOKIE)?.value);
  const draftTitle = draft?.title?.trim() ? draft.title.trim() : "外部导入草稿";
  let lookupError: string | null = null;
  let lookupResults = [] as Awaited<ReturnType<typeof searchExternalBooks>>;

  if (lookup) {
    try {
      lookupResults = await searchExternalBooks(lookup);
    } catch {
      lookupError = "外部补全服务暂时不可用，请稍后重试。";
    }
  }

  const existingBooks = await getBooksByIsbns(lookupResults.map((candidate) => candidate.isbn));

  return (
    <main className="page-shell page-shell--create">
      <section className="page-top">
        <div>
          <p className="eyebrow">新增图书</p>
          <h1 className="page-title">录入新书</h1>
          <p className="page-description">
            可以直接手动录入，也可以先用外部数据快速补全再确认保存。
          </p>
        </div>

        <div className="page-top__actions">
          <Link className="ghost-button" href="/books/import">
            导入图书
          </Link>
          <Link className="ghost-button" href="/books">
            返回列表
          </Link>
        </div>
      </section>

      {feedback ? <div className="notice-banner notice-banner--warning">{feedback}</div> : null}
      {lookupError ? <div className="notice-banner notice-banner--warning">{lookupError}</div> : null}

      <SearchTransitionProvider>
        <section className={`create-intro-grid ${draft ? "create-intro-grid--paired" : ""}`}>
          <section className="panel toolbar-panel create-lookup-panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">外部补全</p>
                <h2>快速补全</h2>
                <p className="section-copy">输入关键词或 ISBN，把外部图书资料先套进表单里。</p>
              </div>
              <span className="chip chip--yellow">
                <Sparkles size={14} />
                预填模式
              </span>
            </div>

            <div className="create-lookup-notes">
              <span className="meta-chip">支持关键词搜索</span>
              <span className="meta-chip">支持 ISBN 精确查找</span>
              <span className="meta-chip">结果不会直接覆盖本地数据</span>
            </div>

            <SearchToolbar
              queryKey="lookup"
              queryPlaceholder="搜索书名、作者或输入 ISBN"
              queryValue={lookup}
              resetLabel="清空"
              submitLabel="搜索补全"
              submitPendingLabel="补全中..."
              submitTone="secondary"
            />
          </section>

          {draft ? (
            <section className="panel import-draft-panel import-draft-panel--active">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">已套用外部资料</p>
                  <h2>{draftTitle}</h2>
                  <p className="section-copy">
                    当前表单已预填来自 {draft.sourceLabel} 的资料，保存前请确认出版年份、馆藏位置和简介。
                  </p>
                </div>
                <form action={clearImportDraftAction}>
                  <input name="redirectTo" type="hidden" value={redirectTo} />
                  <button className="ghost-button" type="submit">
                    清除预填
                  </button>
                </form>
              </div>

              <div className="book-meta-grid import-draft-panel__meta">
                {draft.isbn ? <span className="meta-chip">ISBN {draft.isbn}</span> : null}
                {draft.publisher ? <span className="meta-chip">{draft.publisher}</span> : null}
                {draft.language ? <span className="meta-chip">{draft.language}</span> : null}
                {draft.pageCount ? <span className="meta-chip">{draft.pageCount} 页</span> : null}
              </div>
            </section>
          ) : null}
        </section>

        <SearchResultsSurface>
          {lookupResults.length > 0 ? (
            <section className="panel create-results-panel">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">补全结果</p>
                  <h2>选择一条外部资料</h2>
                  <p className="section-copy">把合适的数据套进表单，再继续人工确认馆藏信息。</p>
                </div>
                <span className="chip chip--blue">{lookupResults.length} 条候选</span>
              </div>

              <div className="external-books-grid external-books-grid--embedded">
                {lookupResults.map((candidate) => (
                  <ExternalBookCard
                    candidate={candidate}
                    existingBook={existingBooks.get(candidate.isbn)}
                    key={candidate.rawKey}
                    mode="prefill"
                    redirectTo={redirectTo}
                  />
                ))}
              </div>
            </section>
          ) : lookup && !lookupError ? (
            <section className="panel empty-state">
              <div className="empty-state__icon">
                <Search size={24} />
              </div>
              <h3>没有找到可套用的数据</h3>
              <p>可以试试更完整的书名，或者换成 ISBN 再搜一次。</p>
            </section>
          ) : null}
        </SearchResultsSurface>
      </SearchTransitionProvider>

      <section className="editor-layout editor-layout--create create-editor-layout">
        <aside className="editor-sidebar editor-sidebar--sticky">
          <section className="panel side-panel side-panel--accent">
            <div className="side-panel__icon">
              <BookmarkPlus size={22} />
            </div>
            <h2>录入建议</h2>
            <p className="section-copy">
              新增页只处理录入动作，浏览和批量导入都放在各自页面完成。
            </p>

            <div className="check-list">
              <div className="check-item">
                <ChevronRight size={16} />
                <span>优先确认 ISBN 和出版年份是否准确</span>
              </div>
              <div className="check-item">
                <ChevronRight size={16} />
                <span>外部导入后的馆藏位置仍建议人工确认</span>
              </div>
              <div className="check-item">
                <ChevronRight size={16} />
                <span>如果本地已存在同 ISBN，优先去编辑现有记录</span>
              </div>
            </div>
          </section>
        </aside>

        <section className="panel form-panel form-panel--create">
          <div className="panel__header">
            <div>
              <p className="eyebrow">填写表单</p>
              <h2>新书资料</h2>
              <p className="section-copy">
                把馆藏核心字段一次补齐，后续检索、维护和导入都会更顺手。
              </p>
            </div>
            <span className="chip chip--yellow">
              <PencilRuler size={14} />
              创建模式
            </span>
          </div>

          <BookForm
            book={draft ? importDraftToFormValues(draft) : null}
            cancelHref="/books"
            cancelLabel="返回列表"
            helperText="建议在保存前再确认 ISBN、馆藏位置和状态，外部导入字段也可以继续人工修正。"
            pendingLabel="创建中..."
            submitLabel="创建图书"
          />
        </section>
      </section>
    </main>
  );
}

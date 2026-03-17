import Image from "next/image";
import Link from "next/link";
import { BookOpenText, ExternalLink, Import, Languages, ScanBarcode, Sparkles } from "lucide-react";

import { quickImportExternalBookAction, storeImportDraftAction } from "@/app/actions";
import {
  getExternalBookAuthor,
  getExternalBookTitle,
  serializeExternalBookCandidate,
} from "@/lib/external-books";
import type { ExistingBookMatch, ExternalBookCandidate } from "@/lib/types";

type ExternalBookCardProps = {
  candidate: ExternalBookCandidate;
  existingBook?: ExistingBookMatch;
  mode: "import" | "prefill";
  redirectTo: string;
};

function ExternalBookCover({ candidate }: { candidate: ExternalBookCandidate }) {
  if (candidate.coverUrl) {
    return (
      <div className="external-book-cover">
        <Image
          alt={`${getExternalBookTitle(candidate)} 封面`}
          className="external-book-cover__image"
          height={132}
          referrerPolicy="no-referrer"
          src={candidate.coverUrl}
          unoptimized
          width={96}
        />
      </div>
    );
  }

  return (
    <div className="external-book-cover external-book-cover--fallback">
      {getExternalBookTitle(candidate).slice(0, 1).toUpperCase()}
    </div>
  );
}

export function ExternalBookCard({
  candidate,
  existingBook,
  mode,
  redirectTo,
}: ExternalBookCardProps) {
  const payload = serializeExternalBookCandidate(candidate);
  const title = getExternalBookTitle(candidate);
  const author = getExternalBookAuthor(candidate);
  const canQuickImport = mode === "import" && candidate.canQuickImport && !existingBook;

  return (
    <article className={`external-book-card ${mode === "prefill" ? "external-book-card--prefill" : ""}`}>
      <div className="external-book-card__main">
        <ExternalBookCover candidate={candidate} />

        <div className="external-book-card__content">
          <div className="external-book-card__heading">
            <div>
              <div className="external-book-card__title-row">
                <h3>{title}</h3>
                <span className="meta-chip">
                  <Sparkles size={14} />
                  {candidate.sourceLabel}
                </span>
                {existingBook ? <span className="status-badge status-badge--yellow">已存在</span> : null}
              </div>
              <p className="book-card__author">{author}</p>
            </div>
          </div>

          <div className="book-meta-grid">
            {candidate.publishedYear ? (
              <span className="meta-chip">
                <BookOpenText size={15} />
                {candidate.publishedYear}
              </span>
            ) : null}
            {candidate.isbn ? (
              <span className="meta-chip">
                <ScanBarcode size={15} />
                {candidate.isbn}
              </span>
            ) : null}
            {candidate.language ? (
              <span className="meta-chip">
                <Languages size={15} />
                {candidate.language}
              </span>
            ) : null}
            {candidate.pageCount ? <span className="meta-chip">{candidate.pageCount} 页</span> : null}
          </div>

          {candidate.publisher ? (
            <p className="caption external-book-card__publisher">出版社：{candidate.publisher}</p>
          ) : null}

          {candidate.summary ? <p className="book-summary">{candidate.summary}</p> : null}

          {candidate.categories.length > 0 ? (
            <div className="external-book-card__tags">
              {candidate.categories.map((category) => (
                <span className="chip chip--blue" key={category}>
                  {category}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="external-book-card__footer">
        <div className="book-actions">
          {!existingBook ? (
            <form action={storeImportDraftAction}>
              <input name="candidate" type="hidden" value={payload} />
              <input name="redirectTo" type="hidden" value="/books/new" />
              <button className="secondary-button" type="submit">
                <Import size={16} />
                {mode === "import" ? "导入到表单" : "套用到表单"}
              </button>
            </form>
          ) : (
            <Link className="ghost-button" href={`/books/${existingBook.id}/edit`}>
              去编辑
            </Link>
          )}

          {mode === "import" ? (
            <form action={quickImportExternalBookAction}>
              <input name="candidate" type="hidden" value={payload} />
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <button className="primary-button" disabled={!canQuickImport} type="submit">
                一键导入
              </button>
            </form>
          ) : null}
        </div>

        <div className="external-book-card__links">
          {existingBook ? (
            <span className="caption">相同 ISBN 已在本地馆藏中。</span>
          ) : mode === "import" && !candidate.canQuickImport ? (
            <span className="caption">缺少关键字段，请先导入到表单补全。</span>
          ) : (
            <span className="caption">支持把外部数据预填到本地馆藏表单。</span>
          )}

          {candidate.sourceUrl ? (
            <Link
              className="caption external-book-card__source"
              href={candidate.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              查看来源
              <ExternalLink size={13} />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

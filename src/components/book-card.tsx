import Image from "next/image";
import Link from "next/link";
import { BookOpenText, Clock3, MapPin, PencilLine, Star } from "lucide-react";

import { deleteBookAction } from "@/app/actions";
import { DeleteButton } from "@/components/delete-button";
import { StatusBadge } from "@/components/status-badge";
import { formatBookDate, getBookTone } from "@/lib/books";
import type { CatalogBook } from "@/lib/types";

export function BookCard({ book }: { book: CatalogBook }) {
  const tone = getBookTone(book.title);

  return (
    <article className="book-card">
      <div className="book-card__top">
        <div className="book-card__identity">
          {book.coverUrl ? (
            <div className="book-cover">
              <Image
                alt={`${book.title} 封面`}
                className="book-cover__image"
                height={88}
                referrerPolicy="no-referrer"
                src={book.coverUrl}
                unoptimized
                width={64}
              />
            </div>
          ) : (
            <div className={`book-avatar book-avatar--${tone}`}>{book.title.slice(0, 1).toUpperCase()}</div>
          )}

          <div>
            <div className="book-card__heading">
              <h3>{book.title}</h3>
              <StatusBadge status={book.status} />
            </div>
            <p className="book-card__author">{book.author}</p>
          </div>
        </div>

        <div className="book-actions">
          <Link className="secondary-button" href={`/books/${book.id}`}>
            详情
          </Link>

          <Link className="ghost-button" href={`/books/${book.id}/edit`}>
            <PencilLine size={16} />
            编辑
          </Link>

          <form action={deleteBookAction}>
            <input name="id" type="hidden" value={book.id} />
            <DeleteButton />
          </form>
        </div>
      </div>

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
          <Star size={15} />
          {book.rating.toFixed(1)} / 5
        </span>
        {book.publisher ? <span className="meta-chip">{book.publisher}</span> : null}
        {book.pageCount ? <span className="meta-chip">{book.pageCount} 页</span> : null}
      </div>

      <p className="book-summary">
        {book.summary?.trim().length
          ? book.summary
          : "暂无简介，可进入编辑页补充这本书的核心信息。"}
      </p>

      <div className="book-card__footer">
        <span className="caption">ISBN {book.isbn}</span>
        <span className="caption">最近更新于 {formatBookDate(book.updatedAt)}</span>
      </div>
    </article>
  );
}

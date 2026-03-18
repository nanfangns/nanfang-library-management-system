import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, FilePenLine, Trash2 } from "lucide-react";

import { deleteBookAction } from "@/app/actions";
import { BookForm } from "@/components/book-form";
import { DeleteButton } from "@/components/delete-button";
import { StatusBadge } from "@/components/status-badge";
import { getStatusMeta } from "@/lib/books";
import { getBookById } from "@/lib/database";

type EditBookPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditBookPage({ params }: EditBookPageProps) {
  const { id } = await params;
  const book = await getBookById(id);

  if (!book) {
    notFound();
  }

  const statusMeta = getStatusMeta(book.status);

  return (
    <main className="page-shell">
      <section className="page-top">
        <div>
          <p className="eyebrow">编辑图书</p>
          <h1 className="page-title">{book.title}</h1>
          <p className="page-description">维护这本书的馆藏资料，保存后会返回列表页。</p>
        </div>

        <div className="page-top__actions">
          <StatusBadge status={book.status} />
          <Link className="ghost-button" href="/books">
            返回列表
          </Link>
        </div>
      </section>

      <section className="editor-layout editor-layout--edit">
        <section className="panel form-panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">维护资料</p>
              <h2>更新信息</h2>
            </div>
            <span className="chip chip--blue">
              <FilePenLine size={14} />
              编辑模式
            </span>
          </div>

          <BookForm
            book={book}
            cancelHref="/books"
            cancelLabel="返回列表"
            pendingLabel="保存中..."
            submitLabel="保存修改"
          />
        </section>

        <aside className="editor-sidebar">
          <section className="panel side-panel">
            <h2>当前信息</h2>
            <div className="detail-list">
              <div className="detail-item">
                <span className="detail-item__label">作者</span>
                <strong>{book.author}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-item__label">ISBN</span>
                <strong>{book.isbn}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-item__label">分类</span>
                <strong>{book.category}</strong>
              </div>
              {book.publisher ? (
                <div className="detail-item">
                  <span className="detail-item__label">出版社</span>
                  <strong>{book.publisher}</strong>
                </div>
              ) : null}
              {book.language ? (
                <div className="detail-item">
                  <span className="detail-item__label">语言</span>
                  <strong>{book.language}</strong>
                </div>
              ) : null}
              {book.pageCount ? (
                <div className="detail-item">
                  <span className="detail-item__label">页数</span>
                  <strong>{book.pageCount} 页</strong>
                </div>
              ) : null}
              <div className="detail-item">
                <span className="detail-item__label">馆藏位置</span>
                <strong>{book.location}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-item__label">当前状态</span>
                <strong>{statusMeta.label}</strong>
              </div>
            </div>
          </section>

          <section className="panel danger-panel">
            <div className="danger-panel__header">
              <AlertTriangle size={18} />
              <h2>危险操作</h2>
            </div>
            <p className="section-copy">
              删除后不会保留历史记录，请在确认不再需要时再执行。
            </p>

            <form action={deleteBookAction} className="danger-panel__form">
              <input name="id" type="hidden" value={book.id} />
              <DeleteButton />
            </form>

            <div className="danger-panel__hint">
              <Trash2 size={14} />
              <span>删除后将直接返回图书列表。</span>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

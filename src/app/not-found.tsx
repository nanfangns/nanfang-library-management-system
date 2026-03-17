import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-shell page-shell--narrow">
      <section className="panel not-found-card">
        <p className="eyebrow">404</p>
        <h1 className="page-title">没有找到这本书</h1>
        <p className="page-description">它可能已经被删除，或者这个地址本身就是无效的。</p>
        <div className="welcome-actions">
          <Link className="primary-button" href="/books">
            返回图书列表
          </Link>
          <Link className="ghost-button" href="/">
            回到首页
          </Link>
        </div>
      </section>
    </main>
  );
}

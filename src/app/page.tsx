import Link from "next/link";
import { ArrowRight, Plus, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <main className="page-shell page-shell--home">
      <section className="welcome-hero">
        <div className="welcome-copy">
          <p className="eyebrow">馆藏运营平台</p>
          <h1>让每一本书都处在可追踪、可维护的状态。</h1>
          <p className="page-description page-description--hero">
            围绕新书入库、馆藏维护和日常检索建立统一的管理视图，让图书资料更完整，处理效率更稳定。
          </p>

          <div className="welcome-actions">
            <Link className="primary-button" href="/books">
              进入图书列表
              <ArrowRight size={16} />
            </Link>
            <Link className="ghost-button" href="/books/new">
              <Plus size={16} />
              新增图书
            </Link>
          </div>
        </div>

        <div className="welcome-visual" aria-hidden="true">
          <div className="visual-card visual-card--blue">
            <span className="visual-card__dot" />
            <span>新书入库</span>
          </div>
          <div className="visual-card visual-card--red">
            <span className="visual-card__dot" />
            <span>资料维护</span>
          </div>
          <div className="visual-card visual-card--yellow">
            <Sparkles size={16} />
            <span>高效检索</span>
          </div>
        </div>
      </section>
    </main>
  );
}

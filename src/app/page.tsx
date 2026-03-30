import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  Plus,
  ShieldCheck,
  TimerReset,
  Users,
  Waypoints,
  Wrench,
} from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { getDashboardStats } from "@/lib/database";

export const dynamic = "force-dynamic";

const statCards = [
  {
    key: "totalBooks",
    label: "总藏书",
    icon: BookOpenText,
    tone: "blue",
  },
  {
    key: "availableBooks",
    label: "在馆可借",
    icon: ShieldCheck,
    tone: "green",
  },
  {
    key: "borrowedBooks",
    label: "借出中",
    icon: Waypoints,
    tone: "red",
  },
  {
    key: "maintenanceBooks",
    label: "维护中",
    icon: Wrench,
    tone: "yellow",
  },
  {
    key: "activeLoans",
    label: "活跃借阅",
    icon: TimerReset,
    tone: "blue",
  },
  {
    key: "activeMembers",
    label: "活跃成员",
    icon: Users,
    tone: "green",
  },
] as const;

export default async function Home() {
  const stats = await getDashboardStats();

  return (
    <main className="page-shell page-shell--home">
      <section className="welcome-hero">
        <div className="welcome-copy">
          <p className="eyebrow">馆藏运营平台</p>
          <h1>把录入、借阅、归还和状态追踪放进一条顺手的工作流。</h1>
          <p className="page-description page-description--hero">
            V2 开始，这个项目不再只是目录 CRUD，而是能完整演示图书录入、成员管理、
            借出归还和首页看板的轻量借阅系统。
          </p>

          <div className="welcome-actions">
            <Link className="primary-button" href="/books">
              进入图书列表
              <ArrowRight size={16} />
            </Link>
            <Link className="ghost-button" href="/members/new">
              <Plus size={16} />
              新增成员
            </Link>
          </div>
        </div>

        <div className="welcome-visual" aria-hidden="true">
          <div className="visual-card visual-card--blue">
            <span className="visual-card__dot" />
            <span>{stats.totalBooks} 本馆藏</span>
          </div>
          <div className="visual-card visual-card--red">
            <span className="visual-card__dot" />
            <span>{stats.activeLoans} 条活跃借阅</span>
          </div>
          <div className="visual-card visual-card--yellow">
            <Users size={16} />
            <span>{stats.activeMembers} 位活跃成员</span>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        {statCards.map((card) => {
          const Icon = card.icon;
          const value = stats[card.key];

          return (
            <article className="panel dashboard-card" key={card.key}>
              <div className={`dashboard-card__icon dashboard-card__icon--${card.tone}`}>
                <Icon size={18} />
              </div>
              <p className="eyebrow">{card.label}</p>
              <strong className="dashboard-card__value">{value}</strong>
            </article>
          );
        })}
      </section>

      <section className="dashboard-secondary-grid">
        <section className="panel dashboard-panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">风险提示</p>
              <h2>逾期与维护</h2>
            </div>
          </div>

          <div className="dashboard-highlight-list">
            <div className="detail-item">
              <span className="detail-item__label">已逾期借阅</span>
              <strong>{stats.overdueLoans} 条</strong>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">维护中图书</span>
              <strong>{stats.maintenanceBooks} 本</strong>
            </div>
          </div>
        </section>

        <section className="panel dashboard-panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">最近录入</p>
              <h2>最新馆藏</h2>
            </div>
            <Link className="ghost-button" href="/books">
              查看全部
            </Link>
          </div>

          {stats.recentBooks.length > 0 ? (
            <div className="dashboard-recent-list">
              {stats.recentBooks.map((book) => (
                <Link className="dashboard-recent-item" href={`/books/${book.id}`} key={book.id}>
                  <div>
                    <strong>{book.title}</strong>
                    <p className="caption">{book.author}</p>
                  </div>
                  <StatusBadge status={book.status} />
                </Link>
              ))}
            </div>
          ) : (
            <p className="section-copy">还没有录入图书，先去创建一条馆藏记录吧。</p>
          )}
        </section>
      </section>
    </main>
  );
}

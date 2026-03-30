import Link from "next/link";
import { Users } from "lucide-react";

import { MemberCard } from "@/components/member-card";
import {
  SearchResultsSurface,
  SearchToolbar,
  SearchTransitionProvider,
} from "@/components/search-experience";
import { getMembers } from "@/lib/database";
import {
  MEMBER_STATUS_OPTIONS,
  type MemberStatusFilter,
  getMemberNoticeMessage,
  isMemberStatus,
} from "@/lib/members";

type MembersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function MembersPage({ searchParams }: MembersPageProps) {
  const resolvedSearchParams = await searchParams;
  const query = getSearchValue(resolvedSearchParams.q);
  const rawStatus = getSearchValue(resolvedSearchParams.status);
  const notice = getMemberNoticeMessage(getSearchValue(resolvedSearchParams.notice));
  const statusFilter: MemberStatusFilter =
    rawStatus && isMemberStatus(rawStatus) ? rawStatus : "ALL";
  const members = await getMembers(query, statusFilter);

  return (
    <main className="page-shell">
      <section className="page-top">
        <div>
          <p className="eyebrow">成员管理</p>
          <h1 className="page-title">成员列表</h1>
          <p className="page-description">维护借阅成员资料，并快速定位活跃与停用成员。</p>
        </div>

        <div className="page-top__actions">
          <Link className="primary-button" href="/members/new">
            新增成员
          </Link>
        </div>
      </section>

      {notice ? <div className="notice-banner">{notice}</div> : null}

      <SearchTransitionProvider>
        <section className="panel toolbar-panel">
          <div className="panel__header">
            <div>
              <h2>筛选成员</h2>
              <p className="section-copy">支持按姓名、编号、电话或邮箱搜索。</p>
            </div>
            <span className="chip chip--blue">{members.length} 位成员</span>
          </div>

          <SearchToolbar
            filterField={{
              clearValue: "ALL",
              label: "状态",
              name: "status",
              options: [
                { label: "全部状态", value: "ALL" },
                ...MEMBER_STATUS_OPTIONS.map((option) => ({
                  label: option.label,
                  value: option.value,
                })),
              ],
              value: statusFilter,
            }}
            queryKey="q"
            queryPlaceholder="搜索姓名、成员编号、电话或邮箱"
            queryValue={query}
            submitLabel="筛选"
            submitPendingLabel="检索中..."
            submitTone="secondary"
          />
        </section>

        <SearchResultsSurface>
          {members.length > 0 ? (
            <section className="books-grid">
              {members.map((member) => (
                <MemberCard key={member.id} member={member} />
              ))}
            </section>
          ) : (
            <section className="panel empty-state">
              <div className="empty-state__icon">
                <Users size={24} />
              </div>
              <h3>没有找到匹配的成员</h3>
              <p>可以调整关键词或状态筛选，也可以先创建一个新的借阅成员。</p>
              <div className="welcome-actions">
                <Link className="primary-button" href="/members/new">
                  新增成员
                </Link>
              </div>
            </section>
          )}
        </SearchResultsSurface>
      </SearchTransitionProvider>
    </main>
  );
}

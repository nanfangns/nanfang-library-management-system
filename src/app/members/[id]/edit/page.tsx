import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleSlash2, FilePenLine } from "lucide-react";

import { MemberForm } from "@/components/member-form";
import { MemberStatusBadge } from "@/components/member-status-badge";
import { getMemberById } from "@/lib/database";

type EditMemberPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditMemberPage({ params }: EditMemberPageProps) {
  const { id } = await params;
  const member = await getMemberById(id);

  if (!member) {
    notFound();
  }

  return (
    <main className="page-shell">
      <section className="page-top">
        <div>
          <p className="eyebrow">编辑成员</p>
          <h1 className="page-title">{member.name}</h1>
          <p className="page-description">更新成员资料、状态和联系方式。</p>
        </div>

        <div className="page-top__actions">
          <MemberStatusBadge status={member.status} />
          <Link className="ghost-button" href="/members">
            返回成员列表
          </Link>
        </div>
      </section>

      <section className="editor-layout editor-layout--edit">
        <section className="panel form-panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">维护资料</p>
              <h2>编辑成员信息</h2>
            </div>
            <span className="chip chip--blue">
              <FilePenLine size={14} />
              编辑模式
            </span>
          </div>

          <MemberForm
            helperText="如果成员还有未归还借阅，系统会阻止直接停用，避免借阅记录进入不一致状态。"
            member={member}
            pendingLabel="保存中..."
            submitLabel="保存修改"
          />
        </section>

        <aside className="editor-sidebar">
          <section className="panel side-panel">
            <h2>当前信息</h2>
            <div className="detail-list">
              <div className="detail-item">
                <span className="detail-item__label">成员编号</span>
                <strong>{member.memberCode}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-item__label">联系电话</span>
                <strong>{member.phone || "未填写"}</strong>
              </div>
              <div className="detail-item">
                <span className="detail-item__label">邮箱</span>
                <strong>{member.email || "未填写"}</strong>
              </div>
            </div>
          </section>

          <section className="panel side-panel side-panel--accent">
            <div className="side-panel__icon">
              <CircleSlash2 size={22} />
            </div>
            <h2>状态说明</h2>
            <p className="section-copy">停用后成员资料仍会保留，但不能再发起新的借阅动作。</p>
          </section>
        </aside>
      </section>
    </main>
  );
}

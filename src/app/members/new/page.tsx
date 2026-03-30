import Link from "next/link";
import { IdCard, UserRoundPlus } from "lucide-react";

import { MemberForm } from "@/components/member-form";

export default function NewMemberPage() {
  return (
    <main className="page-shell">
      <section className="page-top">
        <div>
          <p className="eyebrow">新增成员</p>
          <h1 className="page-title">创建借阅成员</h1>
          <p className="page-description">先把成员资料补齐，后续借阅动作就能直接发起。</p>
        </div>

        <div className="page-top__actions">
          <Link className="ghost-button" href="/members">
            返回成员列表
          </Link>
        </div>
      </section>

      <section className="editor-layout editor-layout--edit">
        <section className="panel form-panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">填写资料</p>
              <h2>成员信息</h2>
            </div>
            <span className="chip chip--blue">
              <UserRoundPlus size={14} />
              创建模式
            </span>
          </div>

          <MemberForm
            helperText="建议成员编号保持稳定，例如 NF-001 这类便于检索和展示的格式。"
            member={null}
            pendingLabel="创建中..."
            submitLabel="创建成员"
          />
        </section>

        <aside className="editor-sidebar">
          <section className="panel side-panel side-panel--accent">
            <div className="side-panel__icon">
              <IdCard size={22} />
            </div>
            <h2>录入建议</h2>
            <div className="check-list">
              <div className="check-item">
                <span>成员编号推荐唯一且可读，方便在借阅页快速定位。</span>
              </div>
              <div className="check-item">
                <span>如果成员暂时不用借书，可以先创建后设为停用。</span>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

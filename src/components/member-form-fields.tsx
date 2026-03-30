import { MEMBER_STATUS_OPTIONS } from "@/lib/members";
import type { MemberFormField, MemberFormState, MemberFormValues } from "@/lib/types";

function getFieldError(
  errors: MemberFormState["errors"],
  field: Exclude<MemberFormField, "form">,
) {
  return errors?.[field]?.[0];
}

export function MemberFormFields({
  member,
  errors,
}: {
  member: MemberFormValues | null;
  errors?: MemberFormState["errors"];
}) {
  return (
    <div className="field-grid">
      <label className="field">
        <span className="field__label">成员姓名</span>
        <input defaultValue={member?.name ?? ""} name="name" placeholder="例如：林书遥" />
        {getFieldError(errors, "name") ? (
          <span className="field__error">{getFieldError(errors, "name")}</span>
        ) : null}
      </label>

      <label className="field">
        <span className="field__label">成员编号</span>
        <input defaultValue={member?.memberCode ?? ""} name="memberCode" placeholder="NF-001" />
        {getFieldError(errors, "memberCode") ? (
          <span className="field__error">{getFieldError(errors, "memberCode")}</span>
        ) : null}
      </label>

      <label className="field">
        <span className="field__label">联系电话</span>
        <input defaultValue={member?.phone ?? ""} name="phone" placeholder="13800000001" />
        {getFieldError(errors, "phone") ? (
          <span className="field__error">{getFieldError(errors, "phone")}</span>
        ) : null}
      </label>

      <label className="field">
        <span className="field__label">邮箱</span>
        <input defaultValue={member?.email ?? ""} name="email" placeholder="name@example.com" />
        {getFieldError(errors, "email") ? (
          <span className="field__error">{getFieldError(errors, "email")}</span>
        ) : null}
      </label>

      <label className="field">
        <span className="field__label">状态</span>
        <select defaultValue={member?.status ?? "ACTIVE"} name="status">
          {MEMBER_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {getFieldError(errors, "status") ? (
          <span className="field__error">{getFieldError(errors, "status")}</span>
        ) : null}
      </label>
    </div>
  );
}

import { z } from "zod";

import { MEMBER_STATUS_VALUES, type MemberStatus } from "./types";

export type MemberStatusFilter = MemberStatus | "ALL";

export const MEMBER_STATUS_OPTIONS = [
  {
    value: "ACTIVE",
    label: "活跃成员",
    description: "可以继续发起借阅和归还流程",
    tone: "green",
  },
  {
    value: "INACTIVE",
    label: "已停用",
    description: "保留资料记录，但不再允许借阅",
    tone: "yellow",
  },
] as const;

const optionalTextField = (max: number) =>
  z
    .union([z.string().trim().max(max, `最多 ${max} 个字符`), z.literal("")])
    .optional()
    .transform((value) => {
      if (!value) {
        return undefined;
      }

      const trimmedValue = value.trim();
      return trimmedValue.length > 0 ? trimmedValue : undefined;
    });

const optionalEmailField = z
  .union([z.string().trim().email("请输入合法的邮箱地址"), z.literal("")])
  .optional()
  .transform((value) => {
    if (!value) {
      return undefined;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
  });

export const memberSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, "请输入成员姓名").max(60, "姓名最多 60 个字符"),
  memberCode: z.string().trim().min(2, "请输入成员编号").max(32, "成员编号最多 32 个字符"),
  phone: optionalTextField(32),
  email: optionalEmailField,
  status: z.enum(MEMBER_STATUS_VALUES),
});

export function isMemberStatus(value: string): value is MemberStatus {
  return MEMBER_STATUS_OPTIONS.some((option) => option.value === value);
}

export function getMemberStatusMeta(status: MemberStatus) {
  return (
    MEMBER_STATUS_OPTIONS.find((option) => option.value === status) ?? MEMBER_STATUS_OPTIONS[0]
  );
}

export function getMemberNoticeMessage(notice: string | undefined) {
  switch (notice) {
    case "created":
      return "成员资料已创建。";
    case "updated":
      return "成员资料已更新。";
    case "inactive-blocked":
      return "该成员还有未归还借阅，暂时不能停用。";
    default:
      return null;
  }
}

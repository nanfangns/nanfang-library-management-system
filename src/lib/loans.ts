import { z } from "zod";

import type { Loan } from "./types";

export type LoanStatusFilter = "ALL" | "ACTIVE" | "RETURNED" | "OVERDUE";

export const DEFAULT_LOAN_DAYS = 30;

export const LOAN_STATUS_FILTER_OPTIONS = [
  { value: "ALL", label: "全部记录" },
  { value: "ACTIVE", label: "借阅中" },
  { value: "RETURNED", label: "已归还" },
  { value: "OVERDUE", label: "已逾期" },
] as const;

const optionalNotesField = z
  .union([z.string().trim().max(240, "备注最多 240 个字符"), z.literal("")])
  .optional()
  .transform((value) => {
    if (!value) {
      return undefined;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
  });

export const checkoutSchema = z.object({
  bookId: z.string().trim().min(1, "缺少图书标识"),
  memberId: z.string().trim().min(1, "请选择借阅成员"),
  notes: optionalNotesField,
});

export const returnLoanSchema = z.object({
  bookId: z.string().trim().min(1, "缺少图书标识"),
  loanId: z.string().trim().min(1, "缺少借阅记录标识"),
});

export function isLoanStatusFilter(value: string): value is LoanStatusFilter {
  return LOAN_STATUS_FILTER_OPTIONS.some((option) => option.value === value);
}

export function formatLoanDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatLoanDateTime(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function getLoanStateMeta(loan: Pick<Loan, "dueAt" | "returnedAt" | "isOverdue">) {
  if (loan.returnedAt) {
    return {
      description: `已于 ${formatLoanDate(loan.returnedAt)} 归还`,
      label: "已归还",
      tone: "green",
    } as const;
  }

  if (loan.isOverdue) {
    return {
      description: `应还日期 ${formatLoanDate(loan.dueAt)}`,
      label: "已逾期",
      tone: "red",
    } as const;
  }

  return {
    description: `应还日期 ${formatLoanDate(loan.dueAt)}`,
    label: "借阅中",
    tone: "blue",
  } as const;
}

export function getLoanNoticeMessage(notice: string | undefined) {
  switch (notice) {
    case "checked-out":
      return "借阅已创建，图书状态已更新为借出中。";
    case "returned":
      return "图书已归还，借阅记录已归档。";
    case "unavailable":
      return "这本书当前不可借出，请先确认状态。";
    case "inactive-member":
      return "停用成员不能发起借阅。";
    case "loan-conflict":
      return "这本书已经有一条未归还借阅。";
    case "missing-member":
      return "请选择一位借阅成员。";
    case "missing-loan":
      return "没有找到可归还的借阅记录。";
    default:
      return null;
  }
}

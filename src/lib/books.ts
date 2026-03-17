import { z } from "zod";

import { BOOK_STATUS_VALUES, type BookStatus } from "./types";

export type StatusFilter = BookStatus | "ALL";

export const BOOK_STATUS_OPTIONS = [
  {
    value: "AVAILABLE",
    label: "在馆可借",
    description: "状态良好，可立即借阅",
    tone: "blue",
  },
  {
    value: "BORROWED",
    label: "借出中",
    description: "当前已被借阅，需要排队",
    tone: "red",
  },
  {
    value: "MAINTENANCE",
    label: "维护中",
    description: "封面、内容或条码正在处理",
    tone: "yellow",
  },
] as const;

const currentYear = new Date().getFullYear();
const optionalTextField = (max: number, emptyValue = undefined as string | undefined) =>
  z
    .union([z.string().trim().max(max, `最多 ${max} 个字符`), z.literal("")])
    .optional()
    .transform((value) => {
      if (!value) {
        return emptyValue;
      }

      const trimmedValue = value.trim();
      return trimmedValue.length > 0 ? trimmedValue : emptyValue;
    });

const optionalUrlField = z
  .union([z.string().trim().url("请输入合法的封面地址"), z.literal("")])
  .optional()
  .transform((value) => {
    if (!value) {
      return undefined;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
  });

const optionalPositiveIntegerField = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }

    return value;
  },
  z
    .coerce
    .number()
    .int("请输入有效的页数")
    .positive("页数必须大于 0")
    .max(100000, "页数不能超过 100000")
    .optional(),
);

export const bookSchema = z.object({
  id: z.string().trim().optional(),
  title: z.string().trim().min(1, "请输入书名").max(100, "书名最多 100 个字符"),
  author: z.string().trim().min(1, "请输入作者").max(60, "作者名最多 60 个字符"),
  isbn: z.string().trim().min(10, "ISBN 至少 10 位").max(32, "ISBN 最多 32 位"),
  category: z.string().trim().min(1, "请输入分类").max(30, "分类最多 30 个字符"),
  publishedYear: z.coerce
    .number()
    .int("请输入有效的出版年份")
    .min(1900, "出版年份不能早于 1900")
    .max(currentYear + 1, `出版年份不能晚于 ${currentYear + 1}`),
  publisher: optionalTextField(80),
  language: optionalTextField(32),
  pageCount: optionalPositiveIntegerField,
  coverUrl: optionalUrlField,
  location: z.string().trim().min(1, "请输入馆藏位置").max(30, "馆藏位置最多 30 个字符"),
  rating: z.coerce.number().int().min(1, "评分范围为 1-5").max(5, "评分范围为 1-5"),
  status: z.enum(BOOK_STATUS_VALUES),
  summary: optionalTextField(280),
});

export function isBookStatus(value: string): value is BookStatus {
  return BOOK_STATUS_OPTIONS.some((option) => option.value === value);
}

export function getStatusMeta(status: BookStatus) {
  return (
    BOOK_STATUS_OPTIONS.find((option) => option.value === status) ?? BOOK_STATUS_OPTIONS[0]
  );
}

export function getNoticeMessage(notice: string | undefined) {
  switch (notice) {
    case "created":
      return "图书已成功录入馆藏。";
    case "updated":
      return "图书信息已经更新。";
    case "deleted":
      return "图书记录已删除。";
    default:
      return null;
  }
}

export function formatBookDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function getImportFeedbackMessage(feedback: string | undefined) {
  switch (feedback) {
    case "duplicate":
      return "本地图书库里已经有相同 ISBN 的记录了。";
    case "incomplete":
      return "这条外部数据缺少关键信息，请先导入到表单里补全。";
    case "invalid":
      return "外部图书数据无效，请重新搜索后再试。";
    default:
      return null;
  }
}

export function getBookTone(seed: string) {
  const tones = ["blue", "red", "yellow", "green"] as const;
  const sum = [...seed].reduce((total, char) => total + char.charCodeAt(0), 0);

  return tones[sum % tones.length];
}

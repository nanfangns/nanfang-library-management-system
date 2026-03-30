import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { cwd } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createClient, type Client as LibsqlClient } from "@libsql/client";
import { createPool, type Pool, type RowDataPacket } from "mysql2/promise";

import { DEFAULT_LOAN_DAYS } from "./loans";
import type {
  BookDetailView,
  BookInput,
  BookRow,
  BookStats,
  BookStatus,
  CatalogBook,
  DashboardStats,
  DetailedBook,
  EditableBook,
  EditableMember,
  ExistingBookMatch,
  Loan,
  Member,
  MemberInput,
  MemberStatus,
} from "./types";

const DEFAULT_SQLITE_PATH = join(cwd(), "data", "library.db");
const DEFAULT_SQLITE_URL = pathToFileURL(DEFAULT_SQLITE_PATH).href;

const SQLITE_BOOK_COLUMN_MIGRATIONS = [
  { name: "publisher", definition: "TEXT" },
  { name: "language", definition: "TEXT" },
  { name: "page_count", definition: "INTEGER" },
  { name: "cover_url", definition: "TEXT" },
] as const;

const MYSQL_BOOK_COLUMN_MIGRATIONS = [
  { name: "publisher", definition: "TEXT NULL" },
  { name: "language", definition: "TEXT NULL" },
  { name: "page_count", definition: "INT NULL" },
  { name: "cover_url", definition: "TEXT NULL" },
] as const;

const SQLITE_MEMBER_COLUMN_MIGRATIONS = [
  { name: "phone", definition: "TEXT" },
  { name: "email", definition: "TEXT" },
  {
    name: "status",
    definition: "TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE'))",
  },
] as const;

const MYSQL_MEMBER_COLUMN_MIGRATIONS = [
  { name: "phone", definition: "VARCHAR(40) NULL" },
  { name: "email", definition: "VARCHAR(120) NULL" },
  { name: "status", definition: "ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE'" },
] as const;

const SQLITE_LOAN_COLUMN_MIGRATIONS = [
  { name: "returned_at", definition: "TEXT" },
  { name: "notes", definition: "TEXT" },
  { name: "active_book_id", definition: "TEXT" },
] as const;

const MYSQL_LOAN_COLUMN_MIGRATIONS = [
  { name: "returned_at", definition: "VARCHAR(40) NULL" },
  { name: "notes", definition: "TEXT NULL" },
  { name: "active_book_id", definition: "VARCHAR(36) NULL" },
] as const;

const SAMPLE_BOOKS: Array<Omit<BookInput, "id">> = [
  {
    title: "Clean Architecture",
    author: "Robert C. Martin",
    isbn: "9780134494166",
    category: "软件工程",
    publishedYear: 2017,
    publisher: "Prentice Hall",
    language: "en",
    pageCount: 432,
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780134494166-M.jpg",
    location: "A-01-03",
    rating: 5,
    summary: "围绕边界、分层与可维护性展开，适合作为工程团队统一架构语言的入门书。",
    status: "AVAILABLE",
  },
  {
    title: "Designing Data-Intensive Applications",
    author: "Martin Kleppmann",
    isbn: "9781449373320",
    category: "数据系统",
    publishedYear: 2017,
    publisher: "O'Reilly Media",
    language: "en",
    pageCount: 616,
    coverUrl: "https://covers.openlibrary.org/b/isbn/9781449373320-M.jpg",
    location: "A-02-07",
    rating: 5,
    summary: "从存储、复制到流处理，系统性梳理现代数据系统的关键设计取舍。",
    status: "AVAILABLE",
  },
  {
    title: "Refactoring",
    author: "Martin Fowler",
    isbn: "9780134757599",
    category: "代码质量",
    publishedYear: 2018,
    publisher: "Addison-Wesley",
    language: "en",
    pageCount: 448,
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780134757599-M.jpg",
    location: "B-01-02",
    rating: 4,
    summary: "通过大量可执行案例解释如何在不改变行为的前提下持续改善代码结构。",
    status: "AVAILABLE",
  },
  {
    title: "The Pragmatic Programmer",
    author: "David Thomas / Andrew Hunt",
    isbn: "9780135957059",
    category: "开发方法论",
    publishedYear: 2019,
    publisher: "Addison-Wesley",
    language: "en",
    pageCount: 352,
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780135957059-M.jpg",
    location: "B-03-05",
    rating: 5,
    summary: "覆盖协作、调试、设计习惯和长期成长，是非常适合反复翻阅的经典开发读物。",
    status: "MAINTENANCE",
  },
];

const SAMPLE_MEMBERS: Array<Omit<MemberInput, "id">> = [
  {
    name: "林书遥",
    memberCode: "NF-001",
    phone: "13800000001",
    email: "shuyao@example.com",
    status: "ACTIVE",
  },
  {
    name: "周允行",
    memberCode: "NF-002",
    phone: "13800000002",
    email: "yunxing@example.com",
    status: "ACTIVE",
  },
  {
    name: "沈知远",
    memberCode: "NF-003",
    phone: "13800000003",
    email: "zhiyuan@example.com",
    status: "INACTIVE",
  },
];

type DatabaseDriver = "sqlite" | "turso" | "mysql";
type DatabaseValue = string | number | null;
type DatabaseStatement =
  | string
  | {
      sql: string;
      args?: DatabaseValue[];
    };
type DatabaseResult = {
  rows: Array<Record<string, unknown>>;
};
type DatabaseExecutor = {
  execute(statement: DatabaseStatement): Promise<DatabaseResult>;
};
type DatabaseRuntime = {
  client: DatabaseExecutor;
  close(): Promise<void>;
  driver: DatabaseDriver;
  isActiveLoanConflictError(error: unknown): boolean;
  isDuplicateIsbnError(error: unknown): boolean;
  isDuplicateMemberCodeError(error: unknown): boolean;
  modeLabel: string;
  url: string;
};
type MysqlConfig = {
  database: string;
  host: string;
  password: string;
  port: number;
  ssl: boolean;
  user: string;
};

const globalForDatabase = globalThis as unknown as {
  databaseRuntimePromise?: Promise<DatabaseRuntime>;
};

const bookSelectColumns = `
  id,
  title,
  author,
  isbn,
  category,
  published_year,
  publisher,
  language,
  page_count,
  cover_url,
  location,
  rating,
  summary,
  status,
  created_at,
  updated_at
`;

const memberSelectColumns = `
  m.id,
  m.name,
  m.member_code,
  m.phone,
  m.email,
  m.status,
  m.created_at,
  m.updated_at,
  SUM(CASE WHEN l.id IS NOT NULL AND l.returned_at IS NULL THEN 1 ELSE 0 END) AS active_loan_count
`;

const loanSelectColumns = `
  l.id,
  l.book_id,
  l.member_id,
  l.borrowed_at,
  l.due_at,
  l.returned_at,
  l.notes,
  l.active_book_id,
  l.created_at,
  l.updated_at,
  b.title AS book_title,
  b.isbn AS book_isbn,
  b.status AS book_status,
  m.name AS member_name,
  m.member_code AS member_code
`;

export class DuplicateIsbnError extends Error {
  constructor() {
    super("ISBN already exists.");
    this.name = "DuplicateIsbnError";
  }
}

export class DuplicateMemberCodeError extends Error {
  constructor() {
    super("Member code already exists.");
    this.name = "DuplicateMemberCodeError";
  }
}

export class BookHasActiveLoanError extends Error {
  constructor() {
    super("Book has active loan.");
    this.name = "BookHasActiveLoanError";
  }
}

export class MemberHasActiveLoansError extends Error {
  constructor() {
    super("Member has active loans.");
    this.name = "MemberHasActiveLoansError";
  }
}

export class BookUnavailableError extends Error {
  constructor() {
    super("Book is not available for checkout.");
    this.name = "BookUnavailableError";
  }
}

export class MemberInactiveError extends Error {
  constructor() {
    super("Member is inactive.");
    this.name = "MemberInactiveError";
  }
}

export class ActiveLoanConflictError extends Error {
  constructor() {
    super("Book already has an active loan.");
    this.name = "ActiveLoanConflictError";
  }
}

export class LoanNotFoundError extends Error {
  constructor() {
    super("Loan not found.");
    this.name = "LoanNotFoundError";
  }
}

function resolveDriver(): DatabaseDriver {
  const driver = process.env.DATABASE_DRIVER?.trim().toLowerCase();

  if (driver === "turso" || driver === "mysql") {
    return driver;
  }

  return "sqlite";
}

function resolveDatabaseUrl(driver: "sqlite" | "turso") {
  const configuredUrl = process.env.DATABASE_URL?.trim();

  if (driver === "turso") {
    if (!configuredUrl) {
      throw new Error("DATABASE_URL is required when DATABASE_DRIVER=turso.");
    }

    return configuredUrl;
  }

  if (!configuredUrl) {
    return DEFAULT_SQLITE_URL;
  }

  if (
    configuredUrl.startsWith("file:") ||
    configuredUrl.startsWith("libsql:") ||
    configuredUrl.startsWith("http:") ||
    configuredUrl.startsWith("https:")
  ) {
    return configuredUrl;
  }

  return pathToFileURL(resolve(cwd(), configuredUrl)).href;
}

function resolveRequiredMysqlSetting(name: "MYSQL_HOST" | "MYSQL_USER" | "MYSQL_DATABASE") {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required when DATABASE_DRIVER=mysql.`);
  }

  return value;
}

function parseBooleanEnv(name: string) {
  const value = process.env[name]?.trim().toLowerCase();

  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function resolveMysqlConfig(): MysqlConfig {
  const rawPort = process.env.MYSQL_PORT?.trim();
  let port = 3306;

  if (rawPort) {
    const parsedPort = Number(rawPort);

    if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
      throw new Error("MYSQL_PORT must be a positive integer when DATABASE_DRIVER=mysql.");
    }

    port = parsedPort;
  }

  return {
    database: resolveRequiredMysqlSetting("MYSQL_DATABASE"),
    host: resolveRequiredMysqlSetting("MYSQL_HOST"),
    password: process.env.MYSQL_PASSWORD ?? "",
    port,
    ssl: parseBooleanEnv("MYSQL_SSL"),
    user: resolveRequiredMysqlSetting("MYSQL_USER"),
  };
}

function buildMysqlDisplayUrl(config: MysqlConfig) {
  return `mysql://${encodeURIComponent(config.user)}@${config.host}:${config.port}/${config.database}`;
}

function getSqliteFilePath(url: string) {
  if (url.startsWith("file://")) {
    return fileURLToPath(url);
  }

  if (!url.startsWith("file:")) {
    return null;
  }

  return resolve(cwd(), url.slice("file:".length));
}

function ensureSqliteDirectory(url: string) {
  const filePath = getSqliteFilePath(url);

  if (!filePath) {
    return;
  }

  const dataDirectory = dirname(filePath);

  if (!existsSync(dataDirectory)) {
    mkdirSync(dataDirectory, { recursive: true });
  }
}

function normalizeStatement(statement: DatabaseStatement) {
  if (typeof statement === "string") {
    return {
      args: [] as DatabaseValue[],
      sql: statement,
    };
  }

  return {
    args: statement.args ?? [],
    sql: statement.sql,
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
}

function normalizeRequiredText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function normalizeNullableText(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function normalizeNullableNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function normalizeMemberCode(value: string) {
  return value.trim().toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function mapRawBookRow(row: Record<string, unknown>): BookRow {
  return {
    author: normalizeRequiredText(row.author),
    category: normalizeRequiredText(row.category),
    cover_url: normalizeNullableText(row.cover_url),
    created_at: normalizeRequiredText(row.created_at),
    id: normalizeRequiredText(row.id),
    isbn: normalizeRequiredText(row.isbn),
    language: normalizeNullableText(row.language),
    location: normalizeRequiredText(row.location),
    page_count: normalizeNullableNumber(row.page_count),
    published_year: normalizeNumber(row.published_year),
    publisher: normalizeNullableText(row.publisher),
    rating: normalizeNumber(row.rating),
    status: normalizeRequiredText(row.status) as BookStatus,
    summary: normalizeNullableText(row.summary),
    title: normalizeRequiredText(row.title),
    updated_at: normalizeRequiredText(row.updated_at),
  };
}

function mapCatalogBook(row: Record<string, unknown>): CatalogBook {
  const record = mapRawBookRow(row);

  return {
    author: record.author,
    category: record.category,
    coverUrl: record.cover_url,
    id: record.id,
    isbn: record.isbn,
    language: record.language,
    location: record.location,
    pageCount: record.page_count,
    publishedYear: record.published_year,
    publisher: record.publisher,
    rating: record.rating,
    status: record.status,
    summary: record.summary,
    title: record.title,
    updatedAt: record.updated_at,
  };
}

function mapEditableBook(row: Record<string, unknown>): EditableBook {
  const record = mapRawBookRow(row);

  return {
    author: record.author,
    category: record.category,
    coverUrl: record.cover_url,
    id: record.id,
    isbn: record.isbn,
    language: record.language,
    location: record.location,
    pageCount: record.page_count,
    publishedYear: record.published_year,
    publisher: record.publisher,
    rating: record.rating,
    status: record.status,
    summary: record.summary,
    title: record.title,
  };
}

function mapDetailedBook(row: Record<string, unknown>): DetailedBook {
  const record = mapRawBookRow(row);

  return {
    author: record.author,
    category: record.category,
    coverUrl: record.cover_url,
    createdAt: record.created_at,
    id: record.id,
    isbn: record.isbn,
    language: record.language,
    location: record.location,
    pageCount: record.page_count,
    publishedYear: record.published_year,
    publisher: record.publisher,
    rating: record.rating,
    status: record.status,
    summary: record.summary,
    title: record.title,
    updatedAt: record.updated_at,
  };
}

function mapMember(row: Record<string, unknown>): Member {
  return {
    activeLoanCount: normalizeNumber(row.active_loan_count),
    createdAt: normalizeRequiredText(row.created_at),
    email: normalizeNullableText(row.email),
    id: normalizeRequiredText(row.id),
    memberCode: normalizeRequiredText(row.member_code),
    name: normalizeRequiredText(row.name),
    phone: normalizeNullableText(row.phone),
    status: normalizeRequiredText(row.status) as MemberStatus,
    updatedAt: normalizeRequiredText(row.updated_at),
  };
}

function mapEditableMember(row: Record<string, unknown>): EditableMember {
  return {
    email: normalizeNullableText(row.email),
    id: normalizeRequiredText(row.id),
    memberCode: normalizeRequiredText(row.member_code),
    name: normalizeRequiredText(row.name),
    phone: normalizeNullableText(row.phone),
    status: normalizeRequiredText(row.status) as MemberStatus,
  };
}

function isLoanOverdue(dueAt: string, returnedAt: string | null, now = new Date().toISOString()) {
  return !returnedAt && dueAt < now;
}

function mapLoan(row: Record<string, unknown>, now = new Date().toISOString()): Loan {
  const dueAt = normalizeRequiredText(row.due_at);
  const returnedAt = normalizeNullableText(row.returned_at);

  return {
    bookId: normalizeRequiredText(row.book_id),
    bookIsbn: normalizeRequiredText(row.book_isbn),
    bookStatus: normalizeRequiredText(row.book_status) as BookStatus,
    bookTitle: normalizeRequiredText(row.book_title),
    borrowedAt: normalizeRequiredText(row.borrowed_at),
    createdAt: normalizeRequiredText(row.created_at),
    dueAt,
    id: normalizeRequiredText(row.id),
    isOverdue: isLoanOverdue(dueAt, returnedAt, now),
    memberCode: normalizeRequiredText(row.member_code),
    memberId: normalizeRequiredText(row.member_id),
    memberName: normalizeRequiredText(row.member_name),
    notes: normalizeNullableText(row.notes),
    returnedAt,
    updatedAt: normalizeRequiredText(row.updated_at),
  };
}

function isLibsqlDuplicateIsbnError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes("UNIQUE constraint failed: books.isbn") ||
      (error.message.includes("SQLITE_CONSTRAINT_UNIQUE") && error.message.includes("books.isbn")) ||
      error.message.includes("uniq_books_isbn"))
  );
}

function isLibsqlDuplicateMemberCodeError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes("UNIQUE constraint failed: members.member_code") ||
      error.message.includes("members.member_code") ||
      error.message.includes("uniq_members_member_code"))
  );
}

function isLibsqlActiveLoanConflictError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes("UNIQUE constraint failed: loans.active_book_id") ||
      error.message.includes("loans.active_book_id") ||
      error.message.includes("uniq_loans_active_book_id"))
  );
}

function isMysqlDuplicateIsbnError(error: unknown) {
  if (!isRecord(error)) {
    return false;
  }

  const code = typeof error.code === "string" ? error.code : "";
  const errno = typeof error.errno === "number" ? error.errno : 0;
  const message =
    error instanceof Error
      ? error.message
      : typeof error.sqlMessage === "string"
        ? error.sqlMessage
        : "";

  return (
    ((code === "ER_DUP_ENTRY" || errno === 1062) &&
      (message.includes("uniq_books_isbn") || message.includes("books.isbn")))
  );
}

function isMysqlDuplicateMemberCodeError(error: unknown) {
  if (!isRecord(error)) {
    return false;
  }

  const code = typeof error.code === "string" ? error.code : "";
  const errno = typeof error.errno === "number" ? error.errno : 0;
  const message =
    error instanceof Error
      ? error.message
      : typeof error.sqlMessage === "string"
        ? error.sqlMessage
        : "";

  return (
    ((code === "ER_DUP_ENTRY" || errno === 1062) &&
      (message.includes("uniq_members_member_code") || message.includes("members.member_code")))
  );
}

function isMysqlActiveLoanConflictError(error: unknown) {
  if (!isRecord(error)) {
    return false;
  }

  const code = typeof error.code === "string" ? error.code : "";
  const errno = typeof error.errno === "number" ? error.errno : 0;
  const message =
    error instanceof Error
      ? error.message
      : typeof error.sqlMessage === "string"
        ? error.sqlMessage
        : "";

  return (
    ((code === "ER_DUP_ENTRY" || errno === 1062) &&
      (message.includes("uniq_loans_active_book_id") || message.includes("loans.active_book_id")))
  );
}

function createLibsqlExecutor(client: LibsqlClient): DatabaseExecutor {
  return {
    execute: async (statement) => {
      const normalizedStatement = normalizeStatement(statement);
      const result =
        normalizedStatement.args.length > 0
          ? await client.execute({
              args: normalizedStatement.args,
              sql: normalizedStatement.sql,
            })
          : await client.execute(normalizedStatement.sql);

      return {
        rows: result.rows.map((row) => ({ ...(row as Record<string, unknown>) })),
      };
    },
  };
}

function createMysqlExecutor(pool: Pool): DatabaseExecutor {
  return {
    execute: async (statement) => {
      const normalizedStatement = normalizeStatement(statement);
      const [rows] = await pool.execute(normalizedStatement.sql, normalizedStatement.args);

      if (!Array.isArray(rows)) {
        return { rows: [] };
      }

      return {
        rows: rows.map((row) => ({ ...(row as RowDataPacket) })),
      };
    },
  };
}

async function getLibsqlColumnNames(client: DatabaseExecutor, table: "books" | "members" | "loans") {
  const result = await client.execute(`PRAGMA table_info(${table})`);

  return new Set(
    result.rows.map((row) => normalizeRequiredText((row as Record<string, unknown>).name)),
  );
}

async function getMysqlColumnNames(client: DatabaseExecutor, table: "books" | "members" | "loans") {
  const result = await client.execute(`SHOW COLUMNS FROM ${table}`);

  return new Set(
    result.rows.map((row) => {
      const record = row as Record<string, unknown>;
      return normalizeRequiredText(record.Field ?? record.field);
    }),
  );
}

function getMysqlIndexColumn(row: Record<string, unknown>) {
  return normalizeRequiredText(row.Column_name ?? row.column_name);
}

function isMysqlUniqueIndex(row: Record<string, unknown>) {
  return normalizeNumber(row.Non_unique ?? row.non_unique) === 0;
}

async function ensureMysqlBookIndexes(client: DatabaseExecutor) {
  const result = await client.execute("SHOW INDEX FROM books");
  const hasUniqueIsbn = result.rows.some((row) => {
    const record = row as Record<string, unknown>;
    return getMysqlIndexColumn(record) === "isbn" && isMysqlUniqueIndex(record);
  });
  const indexedColumns = new Set(
    result.rows.map((row) => getMysqlIndexColumn(row as Record<string, unknown>)),
  );

  if (!hasUniqueIsbn) {
    await client.execute("CREATE UNIQUE INDEX uniq_books_isbn ON books(isbn)");
  }

  if (!indexedColumns.has("status")) {
    await client.execute("CREATE INDEX idx_books_status ON books(status)");
  }

  if (!indexedColumns.has("updated_at")) {
    await client.execute("CREATE INDEX idx_books_updated_at ON books(updated_at)");
  }
}

async function ensureMysqlMemberIndexes(client: DatabaseExecutor) {
  const result = await client.execute("SHOW INDEX FROM members");
  const hasUniqueMemberCode = result.rows.some((row) => {
    const record = row as Record<string, unknown>;
    return getMysqlIndexColumn(record) === "member_code" && isMysqlUniqueIndex(record);
  });
  const indexedColumns = new Set(
    result.rows.map((row) => getMysqlIndexColumn(row as Record<string, unknown>)),
  );

  if (!hasUniqueMemberCode) {
    await client.execute("CREATE UNIQUE INDEX uniq_members_member_code ON members(member_code)");
  }

  if (!indexedColumns.has("status")) {
    await client.execute("CREATE INDEX idx_members_status ON members(status)");
  }

  if (!indexedColumns.has("updated_at")) {
    await client.execute("CREATE INDEX idx_members_updated_at ON members(updated_at)");
  }
}

async function ensureMysqlLoanIndexes(client: DatabaseExecutor) {
  const result = await client.execute("SHOW INDEX FROM loans");
  const hasUniqueActiveBook = result.rows.some((row) => {
    const record = row as Record<string, unknown>;
    return getMysqlIndexColumn(record) === "active_book_id" && isMysqlUniqueIndex(record);
  });
  const indexedColumns = new Set(
    result.rows.map((row) => getMysqlIndexColumn(row as Record<string, unknown>)),
  );

  if (!hasUniqueActiveBook) {
    await client.execute("CREATE UNIQUE INDEX uniq_loans_active_book_id ON loans(active_book_id)");
  }

  if (!indexedColumns.has("book_id")) {
    await client.execute("CREATE INDEX idx_loans_book_id ON loans(book_id)");
  }

  if (!indexedColumns.has("member_id")) {
    await client.execute("CREATE INDEX idx_loans_member_id ON loans(member_id)");
  }

  if (!indexedColumns.has("due_at")) {
    await client.execute("CREATE INDEX idx_loans_due_at ON loans(due_at)");
  }

  if (!indexedColumns.has("returned_at")) {
    await client.execute("CREATE INDEX idx_loans_returned_at ON loans(returned_at)");
  }

  if (!indexedColumns.has("borrowed_at")) {
    await client.execute("CREATE INDEX idx_loans_borrowed_at ON loans(borrowed_at)");
  }
}

async function runLibsqlSchema(client: DatabaseExecutor) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      isbn TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      published_year INTEGER NOT NULL,
      location TEXT NOT NULL,
      rating INTEGER NOT NULL DEFAULT 4,
      summary TEXT,
      status TEXT NOT NULL CHECK (status IN ('AVAILABLE', 'BORROWED', 'MAINTENANCE')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      member_code TEXT NOT NULL UNIQUE,
      phone TEXT,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      borrowed_at TEXT NOT NULL,
      due_at TEXT NOT NULL,
      returned_at TEXT,
      notes TEXT,
      active_book_id TEXT UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  const bookColumns = await getLibsqlColumnNames(client, "books");
  for (const column of SQLITE_BOOK_COLUMN_MIGRATIONS) {
    if (!bookColumns.has(column.name)) {
      await client.execute(`ALTER TABLE books ADD COLUMN ${column.name} ${column.definition}`);
    }
  }

  const memberColumns = await getLibsqlColumnNames(client, "members");
  for (const column of SQLITE_MEMBER_COLUMN_MIGRATIONS) {
    if (!memberColumns.has(column.name)) {
      await client.execute(`ALTER TABLE members ADD COLUMN ${column.name} ${column.definition}`);
    }
  }

  const loanColumns = await getLibsqlColumnNames(client, "loans");
  for (const column of SQLITE_LOAN_COLUMN_MIGRATIONS) {
    if (!loanColumns.has(column.name)) {
      await client.execute(`ALTER TABLE loans ADD COLUMN ${column.name} ${column.definition}`);
    }
  }

  await client.execute("CREATE INDEX IF NOT EXISTS idx_books_status ON books(status)");
  await client.execute("CREATE INDEX IF NOT EXISTS idx_books_updated_at ON books(updated_at DESC)");
  await client.execute("CREATE UNIQUE INDEX IF NOT EXISTS uniq_members_member_code ON members(member_code)");
  await client.execute("CREATE INDEX IF NOT EXISTS idx_members_status ON members(status)");
  await client.execute("CREATE INDEX IF NOT EXISTS idx_members_updated_at ON members(updated_at DESC)");
  await client.execute("CREATE UNIQUE INDEX IF NOT EXISTS uniq_loans_active_book_id ON loans(active_book_id)");
  await client.execute("CREATE INDEX IF NOT EXISTS idx_loans_book_id ON loans(book_id)");
  await client.execute("CREATE INDEX IF NOT EXISTS idx_loans_member_id ON loans(member_id)");
  await client.execute("CREATE INDEX IF NOT EXISTS idx_loans_due_at ON loans(due_at)");
  await client.execute("CREATE INDEX IF NOT EXISTS idx_loans_returned_at ON loans(returned_at)");
  await client.execute("CREATE INDEX IF NOT EXISTS idx_loans_borrowed_at ON loans(borrowed_at DESC)");
}

async function runMysqlSchema(client: DatabaseExecutor) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS books (
      id VARCHAR(36) NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      isbn VARCHAR(255) NOT NULL,
      category TEXT NOT NULL,
      published_year INT NOT NULL,
      location VARCHAR(255) NOT NULL,
      rating INT NOT NULL DEFAULT 4,
      summary TEXT NULL,
      status ENUM('AVAILABLE', 'BORROWED', 'MAINTENANCE') NOT NULL,
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_books_isbn (isbn),
      KEY idx_books_status (status),
      KEY idx_books_updated_at (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS members (
      id VARCHAR(36) NOT NULL,
      name VARCHAR(120) NOT NULL,
      member_code VARCHAR(64) NOT NULL,
      phone VARCHAR(40) NULL,
      email VARCHAR(120) NULL,
      status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_members_member_code (member_code),
      KEY idx_members_status (status),
      KEY idx_members_updated_at (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS loans (
      id VARCHAR(36) NOT NULL,
      book_id VARCHAR(36) NOT NULL,
      member_id VARCHAR(36) NOT NULL,
      borrowed_at VARCHAR(40) NOT NULL,
      due_at VARCHAR(40) NOT NULL,
      returned_at VARCHAR(40) NULL,
      notes TEXT NULL,
      active_book_id VARCHAR(36) NULL,
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_loans_active_book_id (active_book_id),
      KEY idx_loans_book_id (book_id),
      KEY idx_loans_member_id (member_id),
      KEY idx_loans_due_at (due_at),
      KEY idx_loans_returned_at (returned_at),
      KEY idx_loans_borrowed_at (borrowed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const bookColumns = await getMysqlColumnNames(client, "books");
  for (const column of MYSQL_BOOK_COLUMN_MIGRATIONS) {
    if (!bookColumns.has(column.name)) {
      await client.execute(`ALTER TABLE books ADD COLUMN ${column.name} ${column.definition}`);
    }
  }

  const memberColumns = await getMysqlColumnNames(client, "members");
  for (const column of MYSQL_MEMBER_COLUMN_MIGRATIONS) {
    if (!memberColumns.has(column.name)) {
      await client.execute(`ALTER TABLE members ADD COLUMN ${column.name} ${column.definition}`);
    }
  }

  const loanColumns = await getMysqlColumnNames(client, "loans");
  for (const column of MYSQL_LOAN_COLUMN_MIGRATIONS) {
    if (!loanColumns.has(column.name)) {
      await client.execute(`ALTER TABLE loans ADD COLUMN ${column.name} ${column.definition}`);
    }
  }

  await ensureMysqlBookIndexes(client);
  await ensureMysqlMemberIndexes(client);
  await ensureMysqlLoanIndexes(client);
}

async function createLibsqlRuntime(driver: "sqlite" | "turso"): Promise<DatabaseRuntime> {
  const url = resolveDatabaseUrl(driver);

  if (driver === "sqlite") {
    ensureSqliteDirectory(url);
  }

  const client = createClient({
    authToken: driver === "turso" ? process.env.DATABASE_AUTH_TOKEN?.trim() : undefined,
    url,
  });
  const executor = createLibsqlExecutor(client);

  await runLibsqlSchema(executor);

  return {
    client: executor,
    close: async () => {},
    driver,
    isActiveLoanConflictError: isLibsqlActiveLoanConflictError,
    isDuplicateIsbnError: isLibsqlDuplicateIsbnError,
    isDuplicateMemberCodeError: isLibsqlDuplicateMemberCodeError,
    modeLabel: driver === "turso" ? "Turso remote database" : "SQLite local database",
    url,
  };
}

async function createMysqlRuntime(): Promise<DatabaseRuntime> {
  const config = resolveMysqlConfig();
  const pool = createPool({
    database: config.database,
    host: config.host,
    password: config.password,
    port: config.port,
    ssl: config.ssl ? {} : undefined,
    user: config.user,
    waitForConnections: true,
  });
  const executor = createMysqlExecutor(pool);

  await runMysqlSchema(executor);

  return {
    client: executor,
    close: async () => {
      await pool.end();
    },
    driver: "mysql",
    isActiveLoanConflictError: isMysqlActiveLoanConflictError,
    isDuplicateIsbnError: isMysqlDuplicateIsbnError,
    isDuplicateMemberCodeError: isMysqlDuplicateMemberCodeError,
    modeLabel: "MySQL database",
    url: buildMysqlDisplayUrl(config),
  };
}

async function createDatabaseRuntime(): Promise<DatabaseRuntime> {
  const driver = resolveDriver();

  if (driver === "mysql") {
    return createMysqlRuntime();
  }

  return createLibsqlRuntime(driver);
}

function getDatabaseRuntimePromise() {
  const runtimePromise = globalForDatabase.databaseRuntimePromise ?? createDatabaseRuntime();

  if (process.env.NODE_ENV !== "production") {
    globalForDatabase.databaseRuntimePromise = runtimePromise;
  }

  return runtimePromise;
}

async function getDatabaseRuntime() {
  return getDatabaseRuntimePromise();
}

async function queryCount(client: DatabaseExecutor, sql: string, args: DatabaseValue[] = []) {
  const result = await client.execute({ sql, args });
  return normalizeNumber((result.rows[0] as Record<string, unknown> | undefined)?.count);
}

async function hasActiveLoanForBook(client: DatabaseExecutor, bookId: string) {
  return queryCount(client, "SELECT COUNT(*) AS count FROM loans WHERE active_book_id = ?", [bookId]);
}

async function hasActiveLoansForMember(client: DatabaseExecutor, memberId: string) {
  return queryCount(
    client,
    "SELECT COUNT(*) AS count FROM loans WHERE member_id = ? AND returned_at IS NULL",
    [memberId],
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeBookInput(input: BookInput) {
  return {
    author: input.author.trim(),
    category: input.category.trim(),
    coverUrl: normalizeOptionalText(input.coverUrl),
    isbn: input.isbn.trim(),
    language: normalizeOptionalText(input.language),
    location: input.location.trim(),
    pageCount: typeof input.pageCount === "number" ? input.pageCount : null,
    publishedYear: input.publishedYear,
    publisher: normalizeOptionalText(input.publisher),
    rating: input.rating,
    requestedStatus: input.status,
    summary: input.summary?.trim() ? input.summary.trim() : null,
    title: input.title.trim(),
  };
}

function normalizeMemberInput(input: MemberInput) {
  return {
    email: normalizeOptionalText(input.email),
    memberCode: normalizeMemberCode(input.memberCode),
    name: input.name.trim(),
    phone: normalizeOptionalText(input.phone),
    status: input.status,
  };
}

async function resolveManagedBookStatus(
  client: DatabaseExecutor,
  bookId: string | undefined,
  requestedStatus: BookStatus,
) {
  if (bookId && (await hasActiveLoanForBook(client, bookId)) > 0) {
    return "BORROWED" as const;
  }

  if (requestedStatus === "MAINTENANCE") {
    return "MAINTENANCE" as const;
  }

  return "AVAILABLE" as const;
}

async function setBookStatus(client: DatabaseExecutor, bookId: string, status: BookStatus, now: string) {
  await client.execute({
    sql: "UPDATE books SET status = ?, updated_at = ? WHERE id = ?",
    args: [status, now, bookId],
  });
}

export async function closeDatabaseRuntime() {
  const runtimePromise = globalForDatabase.databaseRuntimePromise;

  if (!runtimePromise) {
    return;
  }

  globalForDatabase.databaseRuntimePromise = undefined;

  try {
    const runtime = await runtimePromise;
    await runtime.close();
  } catch {
    // Ignore startup failures while cleaning up script-owned runtimes.
  }
}

export async function getDatabaseInfo() {
  const runtime = await getDatabaseRuntime();

  return {
    driver: runtime.driver,
    modeLabel: runtime.modeLabel,
    url: runtime.url,
  };
}

export async function getCatalogBooks(query: string, status: BookStatus | "ALL") {
  const { client } = await getDatabaseRuntime();
  const clauses: string[] = [];
  const args: DatabaseValue[] = [];

  if (query) {
    const likeValue = `%${query}%`;
    clauses.push("(title LIKE ? OR author LIKE ? OR isbn LIKE ? OR category LIKE ?)");
    args.push(likeValue, likeValue, likeValue, likeValue);
  }

  if (status !== "ALL") {
    clauses.push("status = ?");
    args.push(status);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await client.execute({
    sql: `
      SELECT ${bookSelectColumns}
      FROM books
      ${whereClause}
      ORDER BY
        CASE status
          WHEN 'AVAILABLE' THEN 0
          WHEN 'BORROWED' THEN 1
          ELSE 2
        END,
        updated_at DESC
    `,
    args,
  });

  return result.rows.map((row) => mapCatalogBook(row as Record<string, unknown>));
}

export async function getBookById(id: string) {
  const { client } = await getDatabaseRuntime();
  const result = await client.execute({
    sql: `SELECT ${bookSelectColumns} FROM books WHERE id = ? LIMIT 1`,
    args: [id],
  });
  const row = result.rows[0];

  return row ? mapEditableBook(row as Record<string, unknown>) : null;
}

export async function getBookByIsbn(isbn: string) {
  const normalizedIsbn = isbn.trim();

  if (!normalizedIsbn) {
    return null;
  }

  const { client } = await getDatabaseRuntime();
  const result = await client.execute({
    sql: "SELECT id, isbn, title FROM books WHERE isbn = ? LIMIT 1",
    args: [normalizedIsbn],
  });
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: normalizeRequiredText((row as Record<string, unknown>).id),
    isbn: normalizeRequiredText((row as Record<string, unknown>).isbn),
    title: normalizeRequiredText((row as Record<string, unknown>).title),
  } satisfies ExistingBookMatch;
}

export async function getBooksByIsbns(isbns: string[]) {
  const uniqueIsbns = [...new Set(isbns.map((isbn) => isbn.trim()).filter(Boolean))];

  if (uniqueIsbns.length === 0) {
    return new Map<string, ExistingBookMatch>();
  }

  const { client } = await getDatabaseRuntime();
  const placeholders = uniqueIsbns.map(() => "?").join(", ");
  const result = await client.execute({
    sql: `SELECT id, isbn, title FROM books WHERE isbn IN (${placeholders})`,
    args: uniqueIsbns,
  });

  return new Map(
    result.rows.map((row) => {
      const record = row as Record<string, unknown>;
      const item = {
        id: normalizeRequiredText(record.id),
        isbn: normalizeRequiredText(record.isbn),
        title: normalizeRequiredText(record.title),
      } satisfies ExistingBookMatch;

      return [item.isbn, item] as const;
    }),
  );
}

export async function getBookStats(): Promise<BookStats> {
  const { client } = await getDatabaseRuntime();
  const [totalResult, availableResult, borrowedResult, maintenanceResult, averageResult] =
    await Promise.all([
      client.execute("SELECT COUNT(*) AS count FROM books"),
      client.execute("SELECT COUNT(*) AS count FROM books WHERE status = 'AVAILABLE'"),
      client.execute("SELECT COUNT(*) AS count FROM books WHERE status = 'BORROWED'"),
      client.execute("SELECT COUNT(*) AS count FROM books WHERE status = 'MAINTENANCE'"),
      client.execute("SELECT AVG(rating) AS value FROM books"),
    ]);

  return {
    averageRating:
      normalizeNullableNumber((averageResult.rows[0] as Record<string, unknown> | undefined)?.value) ??
      0,
    availableBooks: normalizeNumber(
      (availableResult.rows[0] as Record<string, unknown> | undefined)?.count,
    ),
    borrowedBooks: normalizeNumber(
      (borrowedResult.rows[0] as Record<string, unknown> | undefined)?.count,
    ),
    maintenanceBooks: normalizeNumber(
      (maintenanceResult.rows[0] as Record<string, unknown> | undefined)?.count,
    ),
    totalBooks: normalizeNumber((totalResult.rows[0] as Record<string, unknown> | undefined)?.count),
  };
}

export async function saveBook(input: BookInput) {
  const runtime = await getDatabaseRuntime();
  const { client } = runtime;
  const now = new Date().toISOString();
  const normalizedInput = normalizeBookInput(input);
  const nextStatus = await resolveManagedBookStatus(client, input.id, normalizedInput.requestedStatus);

  try {
    if (input.id) {
      await client.execute({
        sql: `
          UPDATE books
          SET
            title = ?,
            author = ?,
            isbn = ?,
            category = ?,
            published_year = ?,
            publisher = ?,
            language = ?,
            page_count = ?,
            cover_url = ?,
            location = ?,
            rating = ?,
            summary = ?,
            status = ?,
            updated_at = ?
          WHERE id = ?
        `,
        args: [
          normalizedInput.title,
          normalizedInput.author,
          normalizedInput.isbn,
          normalizedInput.category,
          normalizedInput.publishedYear,
          normalizedInput.publisher,
          normalizedInput.language,
          normalizedInput.pageCount,
          normalizedInput.coverUrl,
          normalizedInput.location,
          normalizedInput.rating,
          normalizedInput.summary,
          nextStatus,
          now,
          input.id,
        ],
      });

      return input.id;
    }

    const id = randomUUID();

    await client.execute({
      sql: `
        INSERT INTO books (
          id,
          title,
          author,
          isbn,
          category,
          published_year,
          publisher,
          language,
          page_count,
          cover_url,
          location,
          rating,
          summary,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        normalizedInput.title,
        normalizedInput.author,
        normalizedInput.isbn,
        normalizedInput.category,
        normalizedInput.publishedYear,
        normalizedInput.publisher,
        normalizedInput.language,
        normalizedInput.pageCount,
        normalizedInput.coverUrl,
        normalizedInput.location,
        normalizedInput.rating,
        normalizedInput.summary,
        nextStatus,
        now,
        now,
      ],
    });

    return id;
  } catch (error) {
    if (runtime.isDuplicateIsbnError(error)) {
      throw new DuplicateIsbnError();
    }

    throw error;
  }
}

export async function deleteBook(id: string) {
  const { client } = await getDatabaseRuntime();

  if ((await hasActiveLoanForBook(client, id)) > 0) {
    throw new BookHasActiveLoanError();
  }

  await client.execute({
    sql: "DELETE FROM loans WHERE book_id = ?",
    args: [id],
  });

  await client.execute({
    sql: "DELETE FROM books WHERE id = ?",
    args: [id],
  });
}

export async function getMembers(query: string, status: MemberStatus | "ALL") {
  const { client } = await getDatabaseRuntime();
  const clauses: string[] = [];
  const args: DatabaseValue[] = [];

  if (query) {
    const likeValue = `%${query}%`;
    clauses.push("(m.name LIKE ? OR m.member_code LIKE ? OR m.phone LIKE ? OR m.email LIKE ?)");
    args.push(likeValue, likeValue, likeValue, likeValue);
  }

  if (status !== "ALL") {
    clauses.push("m.status = ?");
    args.push(status);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await client.execute({
    sql: `
      SELECT ${memberSelectColumns}
      FROM members m
      LEFT JOIN loans l ON l.member_id = m.id
      ${whereClause}
      GROUP BY
        m.id,
        m.name,
        m.member_code,
        m.phone,
        m.email,
        m.status,
        m.created_at,
        m.updated_at
      ORDER BY
        CASE m.status
          WHEN 'ACTIVE' THEN 0
          ELSE 1
        END,
        m.updated_at DESC
    `,
    args,
  });

  return result.rows.map((row) => mapMember(row as Record<string, unknown>));
}

export async function getActiveMembers() {
  return getMembers("", "ACTIVE");
}

export async function getMemberById(id: string) {
  const { client } = await getDatabaseRuntime();
  const result = await client.execute({
    sql: "SELECT id, name, member_code, phone, email, status FROM members WHERE id = ? LIMIT 1",
    args: [id],
  });
  const row = result.rows[0];

  return row ? mapEditableMember(row as Record<string, unknown>) : null;
}

export async function saveMember(input: MemberInput) {
  const runtime = await getDatabaseRuntime();
  const { client } = runtime;
  const now = new Date().toISOString();
  const normalizedInput = normalizeMemberInput(input);

  if (input.id && normalizedInput.status === "INACTIVE") {
    if ((await hasActiveLoansForMember(client, input.id)) > 0) {
      throw new MemberHasActiveLoansError();
    }
  }

  try {
    if (input.id) {
      await client.execute({
        sql: `
          UPDATE members
          SET
            name = ?,
            member_code = ?,
            phone = ?,
            email = ?,
            status = ?,
            updated_at = ?
          WHERE id = ?
        `,
        args: [
          normalizedInput.name,
          normalizedInput.memberCode,
          normalizedInput.phone,
          normalizedInput.email,
          normalizedInput.status,
          now,
          input.id,
        ],
      });

      return input.id;
    }

    const id = randomUUID();

    await client.execute({
      sql: `
        INSERT INTO members (
          id,
          name,
          member_code,
          phone,
          email,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        normalizedInput.name,
        normalizedInput.memberCode,
        normalizedInput.phone,
        normalizedInput.email,
        normalizedInput.status,
        now,
        now,
      ],
    });

    return id;
  } catch (error) {
    if (runtime.isDuplicateMemberCodeError(error)) {
      throw new DuplicateMemberCodeError();
    }

    throw error;
  }
}

export async function getLoans(query: string, status: "ALL" | "ACTIVE" | "RETURNED" | "OVERDUE") {
  const { client } = await getDatabaseRuntime();
  const clauses: string[] = [];
  const args: DatabaseValue[] = [];
  const now = new Date().toISOString();

  if (query) {
    const likeValue = `%${query}%`;
    clauses.push(
      "(b.title LIKE ? OR b.isbn LIKE ? OR m.name LIKE ? OR m.member_code LIKE ? OR l.notes LIKE ?)",
    );
    args.push(likeValue, likeValue, likeValue, likeValue, likeValue);
  }

  if (status === "ACTIVE") {
    clauses.push("l.returned_at IS NULL");
  } else if (status === "RETURNED") {
    clauses.push("l.returned_at IS NOT NULL");
  } else if (status === "OVERDUE") {
    clauses.push("l.returned_at IS NULL");
    clauses.push("l.due_at < ?");
    args.push(now);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await client.execute({
    sql: `
      SELECT ${loanSelectColumns}
      FROM loans l
      INNER JOIN books b ON b.id = l.book_id
      INNER JOIN members m ON m.id = l.member_id
      ${whereClause}
      ORDER BY
        CASE
          WHEN l.returned_at IS NULL AND l.due_at < ? THEN 0
          WHEN l.returned_at IS NULL THEN 1
          ELSE 2
        END,
        l.borrowed_at DESC
    `,
    args: [...args, now],
  });

  return result.rows.map((row) => mapLoan(row as Record<string, unknown>, now));
}

export async function getBookLoanHistory(bookId: string) {
  const { client } = await getDatabaseRuntime();
  const now = new Date().toISOString();
  const result = await client.execute({
    sql: `
      SELECT ${loanSelectColumns}
      FROM loans l
      INNER JOIN books b ON b.id = l.book_id
      INNER JOIN members m ON m.id = l.member_id
      WHERE l.book_id = ?
      ORDER BY
        CASE
          WHEN l.returned_at IS NULL THEN 0
          ELSE 1
        END,
        l.borrowed_at DESC
    `,
    args: [bookId],
  });

  return result.rows.map((row) => mapLoan(row as Record<string, unknown>, now));
}

export async function getBookDetailView(id: string): Promise<BookDetailView | null> {
  const { client } = await getDatabaseRuntime();
  const result = await client.execute({
    sql: `SELECT ${bookSelectColumns} FROM books WHERE id = ? LIMIT 1`,
    args: [id],
  });
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const loanHistory = await getBookLoanHistory(id);

  return {
    book: mapDetailedBook(row as Record<string, unknown>),
    currentLoan: loanHistory.find((loan) => !loan.returnedAt) ?? null,
    loanHistory,
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { client } = await getDatabaseRuntime();
  const now = new Date().toISOString();
  const [
    totalBooks,
    availableBooks,
    borrowedBooks,
    maintenanceBooks,
    activeLoans,
    overdueLoans,
    activeMembers,
    recentBooksResult,
  ] = await Promise.all([
    queryCount(client, "SELECT COUNT(*) AS count FROM books"),
    queryCount(client, "SELECT COUNT(*) AS count FROM books WHERE status = 'AVAILABLE'"),
    queryCount(client, "SELECT COUNT(*) AS count FROM books WHERE status = 'BORROWED'"),
    queryCount(client, "SELECT COUNT(*) AS count FROM books WHERE status = 'MAINTENANCE'"),
    queryCount(client, "SELECT COUNT(*) AS count FROM loans WHERE returned_at IS NULL"),
    queryCount(
      client,
      "SELECT COUNT(*) AS count FROM loans WHERE returned_at IS NULL AND due_at < ?",
      [now],
    ),
    queryCount(client, "SELECT COUNT(*) AS count FROM members WHERE status = 'ACTIVE'"),
    client.execute({
      sql: `
        SELECT ${bookSelectColumns}
        FROM books
        ORDER BY created_at DESC, updated_at DESC
        LIMIT 4
      `,
    }),
  ]);

  return {
    activeLoans,
    activeMembers,
    availableBooks,
    borrowedBooks,
    maintenanceBooks,
    overdueLoans,
    recentBooks: recentBooksResult.rows.map((row) => mapCatalogBook(row as Record<string, unknown>)),
    totalBooks,
  };
}

export async function checkoutBook(input: { bookId: string; memberId: string; notes?: string | null }) {
  const runtime = await getDatabaseRuntime();
  const { client } = runtime;
  const bookResult = await client.execute({
    sql: "SELECT id, status FROM books WHERE id = ? LIMIT 1",
    args: [input.bookId],
  });
  const bookRow = bookResult.rows[0] as Record<string, unknown> | undefined;

  if (!bookRow || normalizeRequiredText(bookRow.status) === "MAINTENANCE") {
    throw new BookUnavailableError();
  }

  if ((await hasActiveLoanForBook(client, input.bookId)) > 0) {
    throw new ActiveLoanConflictError();
  }

  const memberResult = await client.execute({
    sql: "SELECT id, status FROM members WHERE id = ? LIMIT 1",
    args: [input.memberId],
  });
  const memberRow = memberResult.rows[0] as Record<string, unknown> | undefined;

  if (!memberRow || normalizeRequiredText(memberRow.status) !== "ACTIVE") {
    throw new MemberInactiveError();
  }

  const now = new Date();
  const borrowedAt = now.toISOString();
  const dueAt = addDays(now, DEFAULT_LOAN_DAYS).toISOString();
  const id = randomUUID();

  try {
    await client.execute({
      sql: `
        INSERT INTO loans (
          id,
          book_id,
          member_id,
          borrowed_at,
          due_at,
          returned_at,
          notes,
          active_book_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        input.bookId,
        input.memberId,
        borrowedAt,
        dueAt,
        null,
        normalizeOptionalText(input.notes),
        input.bookId,
        borrowedAt,
        borrowedAt,
      ],
    });
  } catch (error) {
    if (runtime.isActiveLoanConflictError(error)) {
      throw new ActiveLoanConflictError();
    }

    throw error;
  }

  await setBookStatus(client, input.bookId, "BORROWED", borrowedAt);

  return id;
}

export async function returnBook(input: { bookId: string; loanId: string }) {
  const { client } = await getDatabaseRuntime();
  const activeLoan = await client.execute({
    sql: "SELECT id FROM loans WHERE id = ? AND book_id = ? AND returned_at IS NULL LIMIT 1",
    args: [input.loanId, input.bookId],
  });

  if (!activeLoan.rows[0]) {
    throw new LoanNotFoundError();
  }

  const now = new Date().toISOString();

  await client.execute({
    sql: `
      UPDATE loans
      SET
        returned_at = ?,
        active_book_id = NULL,
        updated_at = ?
      WHERE id = ?
    `,
    args: [now, now, input.loanId],
  });

  await setBookStatus(client, input.bookId, "AVAILABLE", now);

  return input.loanId;
}

export async function getBookCount() {
  const { client } = await getDatabaseRuntime();
  return queryCount(client, "SELECT COUNT(*) AS count FROM books");
}

export async function resetBooks() {
  const { client } = await getDatabaseRuntime();

  await client.execute("DELETE FROM loans");
  await client.execute("DELETE FROM members");
  await client.execute("DELETE FROM books");
}

export async function seedSampleBooks() {
  const runtime = await getDatabaseRuntime();
  const { client } = runtime;
  const now = new Date().toISOString();

  for (const book of SAMPLE_BOOKS) {
    const normalizedBook = normalizeBookInput(book);

    try {
      await client.execute({
        sql: `
          INSERT INTO books (
            id,
            title,
            author,
            isbn,
            category,
            published_year,
            publisher,
            language,
            page_count,
            cover_url,
            location,
            rating,
            summary,
            status,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          randomUUID(),
          normalizedBook.title,
          normalizedBook.author,
          normalizedBook.isbn,
          normalizedBook.category,
          normalizedBook.publishedYear,
          normalizedBook.publisher,
          normalizedBook.language,
          normalizedBook.pageCount,
          normalizedBook.coverUrl,
          normalizedBook.location,
          normalizedBook.rating,
          normalizedBook.summary,
          normalizedBook.requestedStatus === "MAINTENANCE" ? "MAINTENANCE" : "AVAILABLE",
          now,
          now,
        ],
      });
    } catch (error) {
      if (!runtime.isDuplicateIsbnError(error)) {
        throw error;
      }
    }
  }

  for (const member of SAMPLE_MEMBERS) {
    const normalizedMember = normalizeMemberInput(member);

    try {
      await client.execute({
        sql: `
          INSERT INTO members (
            id,
            name,
            member_code,
            phone,
            email,
            status,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          randomUUID(),
          normalizedMember.name,
          normalizedMember.memberCode,
          normalizedMember.phone,
          normalizedMember.email,
          normalizedMember.status,
          now,
          now,
        ],
      });
    } catch (error) {
      if (!runtime.isDuplicateMemberCodeError(error)) {
        throw error;
      }
    }
  }

  if ((await queryCount(client, "SELECT COUNT(*) AS count FROM loans")) > 0) {
    return;
  }

  const books = await client.execute({
    sql: "SELECT id, isbn FROM books WHERE isbn IN (?, ?)",
    args: ["9780134494166", "9781449373320"],
  });
  const members = await client.execute({
    sql: "SELECT id, member_code FROM members WHERE member_code IN (?, ?)",
    args: ["NF-001", "NF-002"],
  });
  const bookMap = new Map(
    books.rows.map((row) => {
      const record = row as Record<string, unknown>;
      return [normalizeRequiredText(record.isbn), normalizeRequiredText(record.id)] as const;
    }),
  );
  const memberMap = new Map(
    members.rows.map((row) => {
      const record = row as Record<string, unknown>;
      return [normalizeRequiredText(record.member_code), normalizeRequiredText(record.id)] as const;
    }),
  );
  const returnedBookId = bookMap.get("9780134494166");
  const borrowedBookId = bookMap.get("9781449373320");
  const firstMemberId = memberMap.get("NF-001");
  const secondMemberId = memberMap.get("NF-002");

  if (returnedBookId && firstMemberId) {
    const borrowedAt = addDays(new Date(), -90).toISOString();
    const dueAt = addDays(new Date(), -60).toISOString();
    const returnedAt = addDays(new Date(), -55).toISOString();

    await client.execute({
      sql: `
        INSERT INTO loans (
          id,
          book_id,
          member_id,
          borrowed_at,
          due_at,
          returned_at,
          notes,
          active_book_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        randomUUID(),
        returnedBookId,
        firstMemberId,
        borrowedAt,
        dueAt,
        returnedAt,
        "架构专题复习借阅",
        null,
        borrowedAt,
        returnedAt,
      ],
    });
  }

  if (borrowedBookId && secondMemberId) {
    const borrowedAt = addDays(new Date(), -40).toISOString();
    const dueAt = addDays(new Date(), -10).toISOString();

    await client.execute({
      sql: `
        INSERT INTO loans (
          id,
          book_id,
          member_id,
          borrowed_at,
          due_at,
          returned_at,
          notes,
          active_book_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        randomUUID(),
        borrowedBookId,
        secondMemberId,
        borrowedAt,
        dueAt,
        null,
        "数据平台项目参考资料",
        borrowedBookId,
        borrowedAt,
        borrowedAt,
      ],
    });

    await setBookStatus(client, borrowedBookId, "BORROWED", borrowedAt);
  }
}

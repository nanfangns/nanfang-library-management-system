import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { cwd } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createClient, type Client } from "@libsql/client";

import type {
  BookInput,
  BookRow,
  BookStats,
  BookStatus,
  CatalogBook,
  EditableBook,
  ExistingBookMatch,
} from "./types";

const DEFAULT_SQLITE_PATH = join(cwd(), "data", "library.db");
const DEFAULT_SQLITE_URL = pathToFileURL(DEFAULT_SQLITE_PATH).href;
const COLUMN_MIGRATIONS = [
  { name: "publisher", definition: "TEXT" },
  { name: "language", definition: "TEXT" },
  { name: "page_count", definition: "INTEGER" },
  { name: "cover_url", definition: "TEXT" },
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
    status: "BORROWED",
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

type DatabaseDriver = "sqlite" | "turso";
type DatabaseRuntime = {
  client: Client;
  driver: DatabaseDriver;
  url: string;
};

const globalForDatabase = globalThis as unknown as {
  databaseRuntimePromise?: Promise<DatabaseRuntime>;
};

export class DuplicateIsbnError extends Error {
  constructor() {
    super("ISBN already exists.");
    this.name = "DuplicateIsbnError";
  }
}

function resolveDriver(): DatabaseDriver {
  return process.env.DATABASE_DRIVER === "turso" ? "turso" : "sqlite";
}

function resolveDatabaseUrl(driver: DatabaseDriver) {
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
    configuredUrl.startsWith("http:")
  ) {
    return configuredUrl;
  }

  return pathToFileURL(resolve(cwd(), configuredUrl)).href;
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

function normalizeOptionalText(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
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

    if (!Number.isNaN(parsed)) {
      return parsed;
    }
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

function normalizeNullableText(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function normalizeRequiredText(value: unknown) {
  return normalizeNullableText(value) ?? "";
}

function mapRawRow(row: Record<string, unknown>): BookRow {
  return {
    id: normalizeRequiredText(row.id),
    title: normalizeRequiredText(row.title),
    author: normalizeRequiredText(row.author),
    isbn: normalizeRequiredText(row.isbn),
    category: normalizeRequiredText(row.category),
    published_year: normalizeNumber(row.published_year),
    publisher: normalizeNullableText(row.publisher),
    language: normalizeNullableText(row.language),
    page_count: normalizeNullableNumber(row.page_count),
    cover_url: normalizeNullableText(row.cover_url),
    location: normalizeRequiredText(row.location),
    rating: normalizeNumber(row.rating),
    summary: normalizeNullableText(row.summary),
    status: normalizeRequiredText(row.status) as BookStatus,
    created_at: normalizeRequiredText(row.created_at),
    updated_at: normalizeRequiredText(row.updated_at),
  };
}

function mapRow(row: Record<string, unknown>): CatalogBook {
  const record = mapRawRow(row);

  return {
    id: record.id,
    title: record.title,
    author: record.author,
    isbn: record.isbn,
    category: record.category,
    publishedYear: record.published_year,
    publisher: record.publisher,
    language: record.language,
    pageCount: record.page_count,
    coverUrl: record.cover_url,
    location: record.location,
    rating: record.rating,
    summary: record.summary,
    status: record.status,
    updatedAt: record.updated_at,
  };
}

function mapEditableRow(row: Record<string, unknown>): EditableBook {
  const record = mapRawRow(row);

  return {
    id: record.id,
    title: record.title,
    author: record.author,
    isbn: record.isbn,
    category: record.category,
    publishedYear: record.published_year,
    publisher: record.publisher,
    language: record.language,
    pageCount: record.page_count,
    coverUrl: record.cover_url,
    location: record.location,
    rating: record.rating,
    summary: record.summary,
    status: record.status,
  };
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes("UNIQUE constraint failed: books.isbn") ||
      error.message.includes("SQLITE_CONSTRAINT_UNIQUE") ||
      error.message.includes("books.isbn"))
  );
}

async function runSchema(client: Client) {
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

  await client.execute("CREATE INDEX IF NOT EXISTS idx_books_status ON books(status)");
  await client.execute("CREATE INDEX IF NOT EXISTS idx_books_updated_at ON books(updated_at DESC)");

  const columnResult = await client.execute("PRAGMA table_info(books)");
  const existingColumns = new Set(
    columnResult.rows.map((row) => normalizeRequiredText((row as Record<string, unknown>).name)),
  );

  for (const column of COLUMN_MIGRATIONS) {
    if (!existingColumns.has(column.name)) {
      await client.execute(`ALTER TABLE books ADD COLUMN ${column.name} ${column.definition}`);
    }
  }
}

async function createDatabaseRuntime(): Promise<DatabaseRuntime> {
  const driver = resolveDriver();
  const url = resolveDatabaseUrl(driver);

  if (driver === "sqlite") {
    ensureSqliteDirectory(url);
  }

  const client = createClient({
    url,
    authToken: driver === "turso" ? process.env.DATABASE_AUTH_TOKEN?.trim() : undefined,
  });

  await runSchema(client);

  return {
    client,
    driver,
    url,
  };
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

export async function getDatabaseInfo() {
  const runtime = await getDatabaseRuntime();

  return {
    driver: runtime.driver,
    url: runtime.url,
    modeLabel: runtime.driver === "turso" ? "Turso 远程数据库" : "SQLite 本地数据库",
  };
}

const selectColumns = `
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

export async function getCatalogBooks(query: string, status: BookStatus | "ALL") {
  const { client } = await getDatabaseRuntime();
  const clauses: string[] = [];
  const args: Array<string | number | null> = [];

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
      SELECT ${selectColumns}
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

  return result.rows.map((row) => mapRow(row as Record<string, unknown>));
}

export async function getBookById(id: string) {
  const { client } = await getDatabaseRuntime();
  const result = await client.execute({
    sql: `SELECT ${selectColumns} FROM books WHERE id = ? LIMIT 1`,
    args: [id],
  });
  const row = result.rows[0];

  return row ? mapEditableRow(row as Record<string, unknown>) : null;
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
  const [totalResult, availableResult, borrowedResult, averageResult] = await Promise.all([
    client.execute("SELECT COUNT(*) AS count FROM books"),
    client.execute("SELECT COUNT(*) AS count FROM books WHERE status = 'AVAILABLE'"),
    client.execute("SELECT COUNT(*) AS count FROM books WHERE status = 'BORROWED'"),
    client.execute("SELECT AVG(rating) AS value FROM books"),
  ]);

  return {
    totalBooks: normalizeNumber((totalResult.rows[0] as Record<string, unknown> | undefined)?.count),
    availableBooks: normalizeNumber(
      (availableResult.rows[0] as Record<string, unknown> | undefined)?.count,
    ),
    borrowedBooks: normalizeNumber(
      (borrowedResult.rows[0] as Record<string, unknown> | undefined)?.count,
    ),
    averageRating:
      normalizeNullableNumber((averageResult.rows[0] as Record<string, unknown> | undefined)?.value) ??
      0,
  };
}

export async function saveBook(input: BookInput) {
  const { client } = await getDatabaseRuntime();
  const now = new Date().toISOString();
  const publisher = normalizeOptionalText(input.publisher);
  const language = normalizeOptionalText(input.language);
  const coverUrl = normalizeOptionalText(input.coverUrl);
  const summary = input.summary?.trim() ? input.summary.trim() : null;
  const pageCount = typeof input.pageCount === "number" ? input.pageCount : null;

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
          input.title,
          input.author,
          input.isbn,
          input.category,
          input.publishedYear,
          publisher,
          language,
          pageCount,
          coverUrl,
          input.location,
          input.rating,
          summary,
          input.status,
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
        input.title,
        input.author,
        input.isbn,
        input.category,
        input.publishedYear,
        publisher,
        language,
        pageCount,
        coverUrl,
        input.location,
        input.rating,
        summary,
        input.status,
        now,
        now,
      ],
    });

    return id;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateIsbnError();
    }

    throw error;
  }
}

export async function deleteBook(id: string) {
  const { client } = await getDatabaseRuntime();

  await client.execute({
    sql: "DELETE FROM books WHERE id = ?",
    args: [id],
  });
}

export async function getBookCount() {
  const { client } = await getDatabaseRuntime();
  const result = await client.execute("SELECT COUNT(*) AS count FROM books");

  return normalizeNumber((result.rows[0] as Record<string, unknown> | undefined)?.count);
}

export async function resetBooks() {
  const { client } = await getDatabaseRuntime();

  await client.execute("DELETE FROM books");
}

export async function seedSampleBooks() {
  const { client } = await getDatabaseRuntime();
  const now = new Date().toISOString();

  for (const book of SAMPLE_BOOKS) {
    await client.execute({
      sql: `
        INSERT OR IGNORE INTO books (
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
        book.title,
        book.author,
        book.isbn,
        book.category,
        book.publishedYear,
        book.publisher ?? null,
        book.language ?? null,
        book.pageCount ?? null,
        book.coverUrl ?? null,
        book.location,
        book.rating,
        book.summary ?? null,
        book.status,
        now,
        now,
      ],
    });
  }
}

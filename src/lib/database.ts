import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { cwd } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createClient, type Client as LibsqlClient } from "@libsql/client";
import { createPool, type Pool, type RowDataPacket } from "mysql2/promise";

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
const SQLITE_COLUMN_MIGRATIONS = [
  { name: "publisher", definition: "TEXT" },
  { name: "language", definition: "TEXT" },
  { name: "page_count", definition: "INTEGER" },
  { name: "cover_url", definition: "TEXT" },
] as const;
const MYSQL_COLUMN_MIGRATIONS = [
  { name: "publisher", definition: "TEXT NULL" },
  { name: "language", definition: "TEXT NULL" },
  { name: "page_count", definition: "INT NULL" },
  { name: "cover_url", definition: "TEXT NULL" },
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
  isDuplicateIsbnError(error: unknown): boolean;
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

export class DuplicateIsbnError extends Error {
  constructor() {
    super("ISBN already exists.");
    this.name = "DuplicateIsbnError";
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

function mapRow(row: Record<string, unknown>): CatalogBook {
  const record = mapRawRow(row);

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

function mapEditableRow(row: Record<string, unknown>): EditableBook {
  const record = mapRawRow(row);

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLibsqlDuplicateIsbnError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes("UNIQUE constraint failed: books.isbn") ||
      error.message.includes("SQLITE_CONSTRAINT_UNIQUE") ||
      error.message.includes("books.isbn"))
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
    code === "ER_DUP_ENTRY" ||
    errno === 1062 ||
    message.includes("for key 'uniq_books_isbn'") ||
    message.includes("for key 'books.isbn'") ||
    message.includes("Duplicate entry")
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

  await client.execute("CREATE INDEX IF NOT EXISTS idx_books_status ON books(status)");
  await client.execute("CREATE INDEX IF NOT EXISTS idx_books_updated_at ON books(updated_at DESC)");

  const columnResult = await client.execute("PRAGMA table_info(books)");
  const existingColumns = new Set(
    columnResult.rows.map((row) => normalizeRequiredText((row as Record<string, unknown>).name)),
  );

  for (const column of SQLITE_COLUMN_MIGRATIONS) {
    if (!existingColumns.has(column.name)) {
      await client.execute(`ALTER TABLE books ADD COLUMN ${column.name} ${column.definition}`);
    }
  }
}

async function ensureMysqlIndexes(client: DatabaseExecutor) {
  const indexResult = await client.execute("SHOW INDEX FROM books");

  const hasUniqueIsbnIndex = indexResult.rows.some((row) => {
    const record = row as Record<string, unknown>;
    return (
      normalizeRequiredText(record.Column_name ?? record.column_name) === "isbn" &&
      normalizeNumber(record.Non_unique ?? record.non_unique) === 0
    );
  });
  const hasStatusIndex = indexResult.rows.some((row) => {
    const record = row as Record<string, unknown>;
    return normalizeRequiredText(record.Column_name ?? record.column_name) === "status";
  });
  const hasUpdatedAtIndex = indexResult.rows.some((row) => {
    const record = row as Record<string, unknown>;
    return normalizeRequiredText(record.Column_name ?? record.column_name) === "updated_at";
  });

  if (!hasUniqueIsbnIndex) {
    await client.execute("CREATE UNIQUE INDEX uniq_books_isbn ON books(isbn)");
  }

  if (!hasStatusIndex) {
    await client.execute("CREATE INDEX idx_books_status ON books(status)");
  }

  if (!hasUpdatedAtIndex) {
    await client.execute("CREATE INDEX idx_books_updated_at ON books(updated_at)");
  }
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

  const columnResult = await client.execute("SHOW COLUMNS FROM books");
  const existingColumns = new Set(
    columnResult.rows.map((row) => {
      const record = row as Record<string, unknown>;
      return normalizeRequiredText(record.Field ?? record.field);
    }),
  );

  for (const column of MYSQL_COLUMN_MIGRATIONS) {
    if (!existingColumns.has(column.name)) {
      await client.execute(`ALTER TABLE books ADD COLUMN ${column.name} ${column.definition}`);
    }
  }

  await ensureMysqlIndexes(client);
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
    isDuplicateIsbnError: isLibsqlDuplicateIsbnError,
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
    isDuplicateIsbnError: isMysqlDuplicateIsbnError,
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
    averageRating:
      normalizeNullableNumber((averageResult.rows[0] as Record<string, unknown> | undefined)?.value) ??
      0,
    availableBooks: normalizeNumber(
      (availableResult.rows[0] as Record<string, unknown> | undefined)?.count,
    ),
    borrowedBooks: normalizeNumber(
      (borrowedResult.rows[0] as Record<string, unknown> | undefined)?.count,
    ),
    totalBooks: normalizeNumber((totalResult.rows[0] as Record<string, unknown> | undefined)?.count),
  };
}

function normalizeBookInput(input: BookInput) {
  return {
    author: input.author,
    category: input.category,
    coverUrl: normalizeOptionalText(input.coverUrl),
    language: normalizeOptionalText(input.language),
    location: input.location,
    pageCount: typeof input.pageCount === "number" ? input.pageCount : null,
    publishedYear: input.publishedYear,
    publisher: normalizeOptionalText(input.publisher),
    rating: input.rating,
    status: input.status,
    summary: input.summary?.trim() ? input.summary.trim() : null,
    title: input.title,
  };
}

export async function saveBook(input: BookInput) {
  const runtime = await getDatabaseRuntime();
  const { client } = runtime;
  const now = new Date().toISOString();
  const normalizedInput = normalizeBookInput(input);

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
          input.isbn,
          normalizedInput.category,
          normalizedInput.publishedYear,
          normalizedInput.publisher,
          normalizedInput.language,
          normalizedInput.pageCount,
          normalizedInput.coverUrl,
          normalizedInput.location,
          normalizedInput.rating,
          normalizedInput.summary,
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
        input.isbn,
        normalizedInput.category,
        normalizedInput.publishedYear,
        normalizedInput.publisher,
        normalizedInput.language,
        normalizedInput.pageCount,
        normalizedInput.coverUrl,
        normalizedInput.location,
        normalizedInput.rating,
        normalizedInput.summary,
        normalizedInput.status,
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
  const runtime = await getDatabaseRuntime();
  const { client } = runtime;
  const now = new Date().toISOString();

  for (const book of SAMPLE_BOOKS) {
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
    } catch (error) {
      if (!runtime.isDuplicateIsbnError(error)) {
        throw error;
      }
    }
  }
}

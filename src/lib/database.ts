import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { cwd } from "node:process";
import { DatabaseSync } from "node:sqlite";

import type {
  BookInput,
  BookRow,
  BookStats,
  BookStatus,
  CatalogBook,
  EditableBook,
  ExistingBookMatch,
} from "./types";

const DB_PATH = join(cwd(), "data", "library.db");

const globalForDatabase = globalThis as unknown as {
  database?: DatabaseSync;
};

export class DuplicateIsbnError extends Error {
  constructor() {
    super("ISBN already exists.");
    this.name = "DuplicateIsbnError";
  }
}

const COLUMN_MIGRATIONS = [
  { name: "publisher", definition: "TEXT" },
  { name: "language", definition: "TEXT" },
  { name: "page_count", definition: "INTEGER" },
  { name: "cover_url", definition: "TEXT" },
] as const;

function sleepSync(durationMs: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, durationMs);
}

function isLockedError(error: unknown) {
  return error instanceof Error && error.message.includes("database is locked");
}

function isDuplicateColumnError(error: unknown) {
  return error instanceof Error && error.message.includes("duplicate column name");
}

function runSchemaStatement(database: DatabaseSync, statement: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      database.exec(statement);
      return;
    } catch (error) {
      if (isDuplicateColumnError(error)) {
        return;
      }

      if (isLockedError(error)) {
        lastError = error;
        sleepSync(120);
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

function ensureBookColumns(database: DatabaseSync) {
  const columns = database.prepare("PRAGMA table_info(books)").all() as Array<{
    name: string;
  }>;
  const existingColumnNames = new Set(columns.map((column) => column.name));

  for (const column of COLUMN_MIGRATIONS) {
    if (!existingColumnNames.has(column.name)) {
      runSchemaStatement(database, `ALTER TABLE books ADD COLUMN ${column.name} ${column.definition}`);
    }
  }
}

function ensureDatabase() {
  const dataDir = dirname(DB_PATH);

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const database = new DatabaseSync(DB_PATH);
  database.exec("PRAGMA busy_timeout = 5000");

  runSchemaStatement(
    database,
    `
    PRAGMA journal_mode = WAL;

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
    );

    CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
    CREATE INDEX IF NOT EXISTS idx_books_updated_at ON books(updated_at DESC);
  `,
  );

  ensureBookColumns(database);

  return database;
}

const database = globalForDatabase.database ?? ensureDatabase();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.database = database;
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

function mapRow(row: BookRow): CatalogBook {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    isbn: row.isbn,
    category: row.category,
    publishedYear: row.published_year,
    publisher: row.publisher,
    language: row.language,
    pageCount: row.page_count,
    coverUrl: row.cover_url,
    location: row.location,
    rating: row.rating,
    summary: row.summary,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function mapEditableRow(row: BookRow): EditableBook {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    isbn: row.isbn,
    category: row.category,
    publishedYear: row.published_year,
    publisher: row.publisher,
    language: row.language,
    pageCount: row.page_count,
    coverUrl: row.cover_url,
    location: row.location,
    rating: row.rating,
    summary: row.summary,
    status: row.status,
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed: books.isbn");
}

export function getCatalogBooks(query: string, status: BookStatus | "ALL") {
  const clauses: string[] = [];
  const values: Array<string | number> = [];

  if (query) {
    const likeValue = `%${query}%`;

    clauses.push("(title LIKE ? OR author LIKE ? OR isbn LIKE ? OR category LIKE ?)");
    values.push(likeValue, likeValue, likeValue, likeValue);
  }

  if (status !== "ALL") {
    clauses.push("status = ?");
    values.push(status);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const statement = database.prepare(`
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
  `);

  return (statement.all(...values) as BookRow[]).map(mapRow);
}

export function getBookById(id: string) {
  const row = database
    .prepare(`SELECT ${selectColumns} FROM books WHERE id = ? LIMIT 1`)
    .get(id) as BookRow | undefined;

  return row ? mapEditableRow(row) : null;
}

export function getBookByIsbn(isbn: string) {
  const normalizedIsbn = isbn.trim();

  if (!normalizedIsbn) {
    return null;
  }

  const row = database
    .prepare("SELECT id, isbn, title FROM books WHERE isbn = ? LIMIT 1")
    .get(normalizedIsbn) as ExistingBookMatch | undefined;

  return row ?? null;
}

export function getBooksByIsbns(isbns: string[]) {
  const uniqueIsbns = [...new Set(isbns.map((isbn) => isbn.trim()).filter(Boolean))];

  if (uniqueIsbns.length === 0) {
    return new Map<string, ExistingBookMatch>();
  }

  const placeholders = uniqueIsbns.map(() => "?").join(", ");
  const rows = database
    .prepare(`SELECT id, isbn, title FROM books WHERE isbn IN (${placeholders})`)
    .all(...uniqueIsbns) as ExistingBookMatch[];

  return new Map(rows.map((row) => [row.isbn, row]));
}

export function getBookStats(): BookStats {
  const total = database.prepare("SELECT COUNT(*) AS count FROM books").get() as {
    count: number;
  };
  const available = database
    .prepare("SELECT COUNT(*) AS count FROM books WHERE status = 'AVAILABLE'")
    .get() as { count: number };
  const borrowed = database
    .prepare("SELECT COUNT(*) AS count FROM books WHERE status = 'BORROWED'")
    .get() as { count: number };
  const average = database.prepare("SELECT AVG(rating) AS value FROM books").get() as {
    value: number | null;
  };

  return {
    totalBooks: total.count,
    availableBooks: available.count,
    borrowedBooks: borrowed.count,
    averageRating: average.value ?? 0,
  };
}

export function saveBook(input: BookInput) {
  const now = new Date().toISOString();
  const publisher = normalizeOptionalText(input.publisher);
  const language = normalizeOptionalText(input.language);
  const coverUrl = normalizeOptionalText(input.coverUrl);
  const summary = input.summary?.trim() ? input.summary.trim() : null;
  const pageCount = typeof input.pageCount === "number" ? input.pageCount : null;

  try {
    if (input.id) {
      database
        .prepare(`
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
        `)
        .run(
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
        );

      return input.id;
    }

    const id = randomUUID();

    database
      .prepare(`
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
      `)
      .run(
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
      );

    return id;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateIsbnError();
    }

    throw error;
  }
}

export function deleteBook(id: string) {
  database.prepare("DELETE FROM books WHERE id = ?").run(id);
}

export function getBookCount() {
  const row = database.prepare("SELECT COUNT(*) AS count FROM books").get() as {
    count: number;
  };

  return row.count;
}

export function seedSampleBooks() {
  const now = new Date().toISOString();
  const insert = database.prepare(`
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
  `);

  const books: Array<Omit<BookInput, "id">> = [
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
      summary: "围绕架构边界、业务规则和可维护性，适合作为工程团队的架构共识读本。",
      status: "AVAILABLE",
    },
    {
      title: "Designing Data-Intensive Applications",
      author: "Martin Kleppmann",
      isbn: "9781449373320",
      category: "数据库",
      publishedYear: 2017,
      publisher: "O'Reilly Media",
      language: "en",
      pageCount: 616,
      coverUrl: "https://covers.openlibrary.org/b/isbn/9781449373320-M.jpg",
      location: "A-02-07",
      rating: 5,
      summary: "从存储、流处理到分布式系统设计，系统性理解现代数据系统的关键取舍。",
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
      summary: "通过大量案例解释如何在不破坏行为的前提下持续改善代码结构。",
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
      summary: "涵盖团队协作、调试、设计习惯等工程实践，是成长型开发者常读常新的经典。",
      status: "MAINTENANCE",
    },
  ];

  for (const book of books) {
    insert.run(
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
    );
  }
}

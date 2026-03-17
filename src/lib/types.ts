export const BOOK_STATUS_VALUES = ["AVAILABLE", "BORROWED", "MAINTENANCE"] as const;

export type BookStatus = (typeof BOOK_STATUS_VALUES)[number];

export type BookFormField =
  | "title"
  | "author"
  | "isbn"
  | "category"
  | "publishedYear"
  | "publisher"
  | "language"
  | "pageCount"
  | "coverUrl"
  | "location"
  | "rating"
  | "status"
  | "summary"
  | "form";

export type BookFormState = {
  errors?: Partial<Record<BookFormField, string[]>>;
};

export type BookMetadata = {
  publisher: string | null;
  language: string | null;
  pageCount: number | null;
  coverUrl: string | null;
};

export type BookInput = {
  id?: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  publishedYear: number;
  location: string;
  rating: number;
  status: BookStatus;
  summary?: string | null;
} & Partial<BookMetadata>;

export type EditableBook = Omit<BookInput, keyof BookMetadata | "summary"> &
  BookMetadata & {
  summary: string | null;
};

export type CatalogBook = EditableBook & {
  updatedAt: string;
};

export type BookFormValues = Partial<Omit<EditableBook, "id">> & {
  id?: string;
};

export type BookRow = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  published_year: number;
  publisher: string | null;
  language: string | null;
  page_count: number | null;
  cover_url: string | null;
  location: string;
  rating: number;
  summary: string | null;
  status: BookStatus;
  created_at: string;
  updated_at: string;
};

export type BookStats = {
  totalBooks: number;
  availableBooks: number;
  borrowedBooks: number;
  averageRating: number;
};

export type ExistingBookMatch = {
  id: string;
  isbn: string;
  title: string;
};

export type ExternalBookProvider = "OPEN_LIBRARY";

export type ExternalBookCandidate = {
  provider: ExternalBookProvider;
  rawKey: string;
  sourceLabel: string;
  title: string;
  author: string;
  isbn: string;
  publishedYear: number | null;
  publisher: string | null;
  language: string | null;
  pageCount: number | null;
  coverUrl: string | null;
  summary: string | null;
  categories: string[];
  sourceUrl: string | null;
  canQuickImport: boolean;
};

export type ImportDraft = {
  provider: ExternalBookProvider;
  sourceLabel: string;
  sourceUrl: string | null;
  title: string | null;
  author: string | null;
  isbn: string | null;
  category: string | null;
  publishedYear: number | null;
  publisher: string | null;
  language: string | null;
  pageCount: number | null;
  coverUrl: string | null;
  location: string | null;
  rating: number | null;
  status: BookStatus | null;
  summary: string | null;
};

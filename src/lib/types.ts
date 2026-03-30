export const BOOK_STATUS_VALUES = ["AVAILABLE", "BORROWED", "MAINTENANCE"] as const;
export const MEMBER_STATUS_VALUES = ["ACTIVE", "INACTIVE"] as const;

export type BookStatus = (typeof BOOK_STATUS_VALUES)[number];
export type MemberStatus = (typeof MEMBER_STATUS_VALUES)[number];

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

export type MemberFormField = "name" | "memberCode" | "phone" | "email" | "status" | "form";

export type MemberFormState = {
  errors?: Partial<Record<MemberFormField, string[]>>;
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

export type DetailedBook = EditableBook & {
  createdAt: string;
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
  maintenanceBooks: number;
  averageRating: number;
};

export type MemberInput = {
  id?: string;
  name: string;
  memberCode: string;
  phone?: string | null;
  email?: string | null;
  status: MemberStatus;
};

export type EditableMember = {
  id: string;
  name: string;
  memberCode: string;
  phone: string | null;
  email: string | null;
  status: MemberStatus;
};

export type MemberFormValues = Partial<Omit<EditableMember, "id">> & {
  id?: string;
};

export type Member = EditableMember & {
  createdAt: string;
  updatedAt: string;
  activeLoanCount: number;
};

export type MemberRow = {
  id: string;
  name: string;
  member_code: string;
  phone: string | null;
  email: string | null;
  status: MemberStatus;
  created_at: string;
  updated_at: string;
  active_loan_count?: number;
};

export type Loan = {
  id: string;
  bookId: string;
  memberId: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  bookTitle: string;
  bookIsbn: string;
  bookStatus: BookStatus;
  memberName: string;
  memberCode: string;
  isOverdue: boolean;
};

export type LoanRow = {
  id: string;
  book_id: string;
  member_id: string;
  borrowed_at: string;
  due_at: string;
  returned_at: string | null;
  notes: string | null;
  active_book_id: string | null;
  created_at: string;
  updated_at: string;
  book_title: string;
  book_isbn: string;
  book_status: BookStatus;
  member_name: string;
  member_code: string;
};

export type DashboardStats = {
  totalBooks: number;
  availableBooks: number;
  borrowedBooks: number;
  maintenanceBooks: number;
  activeLoans: number;
  overdueLoans: number;
  activeMembers: number;
  recentBooks: CatalogBook[];
};

export type BookDetailView = {
  book: DetailedBook;
  currentLoan: Loan | null;
  loanHistory: Loan[];
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

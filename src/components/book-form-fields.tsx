import { BOOK_STATUS_OPTIONS } from "@/lib/books";
import type { BookFormField, BookFormState, BookFormValues } from "@/lib/types";

function getFieldError(
  errors: BookFormState["errors"],
  field: Exclude<BookFormField, "form">,
) {
  return errors?.[field]?.[0];
}

export function BookFormFields({
  book,
  errors,
}: {
  book: BookFormValues | null;
  errors?: BookFormState["errors"];
}) {
  return (
    <div className="field-grid">
      <label className="field">
        <span className="field__label">书名</span>
        <input defaultValue={book?.title ?? ""} name="title" placeholder="例如：代码大全" />
        {getFieldError(errors, "title") ? (
          <span className="field__error">{getFieldError(errors, "title")}</span>
        ) : null}
      </label>

      <label className="field">
        <span className="field__label">作者</span>
        <input defaultValue={book?.author ?? ""} name="author" placeholder="例如：Steve McConnell" />
        {getFieldError(errors, "author") ? (
          <span className="field__error">{getFieldError(errors, "author")}</span>
        ) : null}
      </label>

      <label className="field">
        <span className="field__label">ISBN</span>
        <input defaultValue={book?.isbn ?? ""} name="isbn" placeholder="978..." />
        {getFieldError(errors, "isbn") ? (
          <span className="field__error">{getFieldError(errors, "isbn")}</span>
        ) : null}
      </label>

      <label className="field">
        <span className="field__label">分类</span>
        <input defaultValue={book?.category ?? ""} name="category" placeholder="软件工程 / 数据库" />
        {getFieldError(errors, "category") ? (
          <span className="field__error">{getFieldError(errors, "category")}</span>
        ) : null}
      </label>

      <label className="field">
        <span className="field__label">出版年份</span>
        <input
          defaultValue={book?.publishedYear ?? ""}
          inputMode="numeric"
          name="publishedYear"
          placeholder="2024"
          type="number"
        />
        {getFieldError(errors, "publishedYear") ? (
          <span className="field__error">{getFieldError(errors, "publishedYear")}</span>
        ) : null}
      </label>

      <label className="field">
        <span className="field__label">出版社</span>
        <input defaultValue={book?.publisher ?? ""} name="publisher" placeholder="例如：人民邮电出版社" />
        {getFieldError(errors, "publisher") ? (
          <span className="field__error">{getFieldError(errors, "publisher")}</span>
        ) : null}
      </label>

      <label className="field">
        <span className="field__label">语言</span>
        <input defaultValue={book?.language ?? ""} name="language" placeholder="例如：zh / en" />
        {getFieldError(errors, "language") ? (
          <span className="field__error">{getFieldError(errors, "language")}</span>
        ) : null}
      </label>

      <label className="field">
        <span className="field__label">页数</span>
        <input
          defaultValue={book?.pageCount ?? ""}
          inputMode="numeric"
          min={1}
          name="pageCount"
          placeholder="320"
          type="number"
        />
        {getFieldError(errors, "pageCount") ? (
          <span className="field__error">{getFieldError(errors, "pageCount")}</span>
        ) : null}
      </label>

      <label className="field">
        <span className="field__label">封面地址</span>
        <input
          defaultValue={book?.coverUrl ?? ""}
          name="coverUrl"
          placeholder="https://covers.openlibrary.org/..."
        />
        {getFieldError(errors, "coverUrl") ? (
          <span className="field__error">{getFieldError(errors, "coverUrl")}</span>
        ) : null}
      </label>

      <label className="field">
        <span className="field__label">馆藏位置</span>
        <input defaultValue={book?.location ?? ""} name="location" placeholder="A-01-03" />
        {getFieldError(errors, "location") ? (
          <span className="field__error">{getFieldError(errors, "location")}</span>
        ) : null}
      </label>

      <label className="field">
        <span className="field__label">评分</span>
        <input defaultValue={book?.rating ?? 4} max={5} min={1} name="rating" type="number" />
        {getFieldError(errors, "rating") ? (
          <span className="field__error">{getFieldError(errors, "rating")}</span>
        ) : null}
      </label>

      <label className="field">
        <span className="field__label">状态</span>
        <select defaultValue={book?.status ?? BOOK_STATUS_OPTIONS[0].value} name="status">
          {BOOK_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {getFieldError(errors, "status") ? (
          <span className="field__error">{getFieldError(errors, "status")}</span>
        ) : null}
      </label>

      <label className="field field--full">
        <span className="field__label">简介</span>
        <textarea
          defaultValue={book?.summary ?? ""}
          name="summary"
          placeholder="用一段简洁描述帮助管理员快速理解书籍内容和定位价值。"
          rows={5}
        />
        {getFieldError(errors, "summary") ? (
          <span className="field__error">{getFieldError(errors, "summary")}</span>
        ) : null}
      </label>
    </div>
  );
}

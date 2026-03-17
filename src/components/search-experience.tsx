"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { LoaderCircle, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type SearchFilterOption = {
  label: string;
  value: string;
};

type SearchFilterConfig = {
  clearValue: string;
  label: string;
  name: string;
  options: SearchFilterOption[];
  value: string;
};

type SearchToolbarProps = {
  filterField?: SearchFilterConfig;
  queryKey: string;
  queryPlaceholder: string;
  queryValue: string;
  resetLabel?: string;
  submitLabel: string;
  submitPendingLabel?: string;
  submitTone?: "primary" | "secondary";
};

type SearchTransitionContextValue = {
  isPending: boolean;
  navigate: (params: URLSearchParams) => void;
};

const SearchTransitionContext = createContext<SearchTransitionContextValue | null>(null);

function useSearchTransitionContext() {
  const context = useContext(SearchTransitionContext);

  if (!context) {
    throw new Error("SearchTransition components must be wrapped in SearchTransitionProvider.");
  }

  return context;
}

export function SearchTransitionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const value = useMemo<SearchTransitionContextValue>(
    () => ({
      isPending,
      navigate: (params) => {
        const nextQuery = params.toString();
        const nextHref = nextQuery ? `${pathname}?${nextQuery}` : pathname;
        const currentQuery = searchParams.toString();
        const currentHref = currentQuery ? `${pathname}?${currentQuery}` : pathname;

        if (nextHref === currentHref) {
          return;
        }

        startTransition(() => {
          router.replace(nextHref, { scroll: false });
        });
      },
    }),
    [isPending, pathname, router, searchParams],
  );

  return (
    <SearchTransitionContext.Provider value={value}>{children}</SearchTransitionContext.Provider>
  );
}

export function SearchToolbar({
  filterField,
  queryKey,
  queryPlaceholder,
  queryValue,
  resetLabel = "重置",
  submitLabel,
  submitPendingLabel = "搜索中...",
  submitTone = "primary",
}: SearchToolbarProps) {
  const { isPending, navigate } = useSearchTransitionContext();
  const [query, setQuery] = useState(queryValue);
  const [filterValue, setFilterValue] = useState(filterField?.value ?? filterField?.clearValue ?? "");

  useEffect(() => {
    setQuery(queryValue);
  }, [queryValue]);

  useEffect(() => {
    setFilterValue(filterField?.value ?? filterField?.clearValue ?? "");
  }, [filterField?.clearValue, filterField?.value]);

  function buildParams() {
    const params = new URLSearchParams();
    const normalizedQuery = query.trim();

    if (normalizedQuery) {
      params.set(queryKey, normalizedQuery);
    }

    if (filterField && filterValue !== filterField.clearValue) {
      params.set(filterField.name, filterValue);
    }

    return params;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(buildParams());
  }

  function handleReset() {
    setQuery("");

    if (filterField) {
      setFilterValue(filterField.clearValue);
    }

    navigate(new URLSearchParams());
  }

  const submitButtonClassName = submitTone === "secondary" ? "secondary-button" : "primary-button";

  return (
    <form
      className={`toolbar-form ${filterField ? "" : "toolbar-form--import"} search-toolbar ${isPending ? "search-toolbar--pending" : ""}`}
      onSubmit={handleSubmit}
    >
      <label className="search-field">
        <Search size={18} />
        <input
          name={queryKey}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={queryPlaceholder}
          value={query}
        />
      </label>

      {filterField ? (
        <label className="field compact-field">
          <span className="field__label">{filterField.label}</span>
          <select
            name={filterField.name}
            onChange={(event) => setFilterValue(event.target.value)}
            value={filterValue}
          >
            {filterField.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <button
        aria-busy={isPending}
        className={`${submitButtonClassName} search-toolbar__submit`}
        disabled={isPending}
        type="submit"
      >
        {isPending ? (
          <LoaderCircle className="search-toolbar__spinner" size={16} />
        ) : (
          <Search size={16} />
        )}
        {isPending ? submitPendingLabel : submitLabel}
      </button>

      <button className="ghost-button" disabled={isPending} onClick={handleReset} type="button">
        {resetLabel}
      </button>

      <span aria-hidden="true" className="search-toolbar__progress" />
    </form>
  );
}

export function SearchResultsSurface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { isPending } = useSearchTransitionContext();

  return (
    <div
      aria-busy={isPending}
      className={`search-results-surface ${isPending ? "search-results-surface--pending" : ""} ${className}`.trim()}
    >
      <div className="search-results-surface__content">{children}</div>
      <div aria-hidden="true" className="search-results-surface__overlay">
        <div className="search-results-surface__scan" />
        <div className="search-results-surface__orb" />
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LibraryBig, Plus } from "lucide-react";
import { useSyncExternalStore } from "react";

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/books/import") {
    return pathname === "/books/import";
  }

  if (href === "/books/new") {
    return pathname === "/books/new";
  }

  if (href === "/books") {
    return pathname === "/books" || (pathname.startsWith("/books/") && !pathname.startsWith("/books/new") && !pathname.startsWith("/books/import"));
  }

  return pathname === href;
}

function subscribe() {
  return () => undefined;
}

export function SiteHeader() {
  const pathname = usePathname();
  const isMounted = useSyncExternalStore(subscribe, () => true, () => false);

  const items = [
    { href: "/", label: "首页" },
    { href: "/books", label: "图书列表" },
    { href: "/books/import", label: "导入图书" },
    { href: "/books/new", label: "新增图书" },
  ] as const;

  if (!isMounted) {
    return <div aria-hidden="true" className="site-header-spacer" />;
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="site-brand" href="/">
          <span className="site-brand__icon">
            <LibraryBig size={18} />
          </span>
          <span>图书管理系统</span>
        </Link>

        <nav className="site-nav" aria-label="主导航">
          {items.map((item) => (
            <Link
              className={`site-nav__link ${isActive(pathname, item.href) ? "site-nav__link--active" : ""}`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link className="primary-button site-header__cta" href="/books/new">
          <Plus size={16} />
          新增图书
        </Link>
      </div>
    </header>
  );
}

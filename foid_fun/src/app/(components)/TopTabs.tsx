"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TopTabsItem = { label: string; href: string; external?: boolean };

export default function TopTabs({
  items,
  className,
}: {
  items: TopTabsItem[];
  className?: string;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav
      aria-label="Primary navigation"
      className={`pray-nav-tabs-wrapper${className ? ` ${className}` : ""}`}
    >
      <div className="pray-nav-tabs" role="tablist">
        {items.map((item) =>
          item.external ? (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="pray-nav-tab"
              role="tab"
              aria-selected={false}
            >
              {item.label}
            </a>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className={`pray-nav-tab${isActive(item.href) ? " pray-nav-tab--active" : ""}`}
              role="tab"
              aria-selected={isActive(item.href)}
            >
              {item.label}
            </Link>
          )
        )}
      </div>
    </nav>
  );
}

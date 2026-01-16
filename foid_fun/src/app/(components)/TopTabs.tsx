"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TopTabsItem = { label: string; href: string };

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
    <div className={`pray-nav-tabs${className ? ` ${className}` : ""}`}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`pray-nav-tab${isActive(item.href) ? " pray-nav-tab--active" : ""}`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

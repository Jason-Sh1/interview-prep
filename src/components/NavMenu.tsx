"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** The nav links behind a Menu button on narrow screens. */
export function NavMenu({ links }: { links: { href: string; label: string; badge?: number; match?: string[] }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const box = useRef<HTMLDivElement>(null);
  // Close after navigating, and on any click outside.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  const current = links.find((l) => (l.match ?? [l.href]).some((m) => pathname.startsWith(m)));
  return (
    <div ref={box} className="relative lg:hidden">
      <button className="btn-ghost" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        {current?.label ?? "Menu"} <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="card absolute left-0 top-full z-20 mt-1 flex w-52 flex-col p-1 shadow-lg">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={`btn-ghost justify-start ${l.href === current?.href ? "font-medium text-accent" : ""}`}>
              {l.label}
              {l.badge && <span className="ml-1 rounded-full bg-accent px-1.5 text-xs text-white">{l.badge}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

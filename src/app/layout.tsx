import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Interview Prep",
  description: "A personalized coding interview track that adapts to every attempt.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <Nav />
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="border-t border-line px-4 py-4 text-center text-xs text-muted">
          <Link href="/privacy" className="hover:text-ink hover:underline">Privacy</Link>
        </footer>
      </body>
    </html>
  );
}

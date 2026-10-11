import type { Metadata } from "next";
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
      </body>
    </html>
  );
}

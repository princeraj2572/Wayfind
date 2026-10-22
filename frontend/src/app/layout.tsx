import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wayfind",
  description: "Ask your company knowledge base.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The init script sets data-theme before paint, so the attribute legitimately differs from the server HTML.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

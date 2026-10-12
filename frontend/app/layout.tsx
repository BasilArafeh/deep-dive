import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Deep Dive — Research anything. Understand everything.",
  description:
    "An AI agent that searches the web and academic papers, synthesizes findings, and produces a structured cited research report.",
  openGraph: {
    title: "Deep Dive — Research anything. Understand everything.",
    description:
      "An AI research agent that turns any topic into a structured cited report.",
  },
};

/**
 * Root layout: Inter typeface, warm background, and global toast host.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full bg-background font-sans text-text-primary antialiased">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            className:
              "border border-border bg-surface text-text-primary shadow-none",
          }}
        />
      </body>
    </html>
  );
}

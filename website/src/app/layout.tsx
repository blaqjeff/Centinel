import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Centinel — Monetize APIs for AI Agents & Bots",
  description:
    "A low-code middleware framework to charge AI agents (ChatGPT, Claude, custom bots) micropayments in crypto to access your API routes. Built on the x402 protocol.",
  openGraph: {
    title: "Centinel — Monetize APIs for AI Agents & Bots",
    description:
      "A low-code middleware framework to charge AI agents micropayments in crypto. Built on the x402 protocol.",
    type: "website",
    url: "https://centinel.ejemotech.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Centinel — Monetize APIs for AI Agents & Bots",
    description:
      "A low-code middleware framework to charge AI agents micropayments in crypto. Built on the x402 protocol.",
  },
};

async function getGitHubStars(): Promise<number | null> {
  try {
    const res = await fetch("https://api.github.com/repos/blaqjeff/Centinel", {
      next: { revalidate: 1800 }, // Cache for 30 minutes
      headers: {
        "User-Agent": "Centinel-Docs-Website",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.stargazers_count as number;
  } catch (error) {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const stars = await getGitHubStars();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} style={{ scrollBehavior: "smooth" }} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body>
        <Navbar starCount={stars} />
        <div style={{ paddingTop: "64px" }}>
          {children}
        </div>
      </body>
    </html>
  );
}

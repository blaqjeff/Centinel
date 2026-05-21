"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./Navbar.module.css";

interface NavbarProps {
  starCount: number | null;
}

export default function Navbar({ starCount: initialStarCount }: NavbarProps) {
  const [stars, setStars] = useState<number | null>(initialStarCount);

  useEffect(() => {
    // Dynamically fetch from local route to get fresh stars count
    async function fetchStars() {
      try {
        const res = await fetch("/api/github-stars");
        if (res.ok) {
          const data = await res.json();
          if (typeof data.stars === "number") {
            setStars(data.stars);
          }
        }
      } catch (err) {
        console.error("Failed to fetch dynamic GitHub stars:", err);
      }
    }
    fetchStars();
  }, []);

  return (
    <header className={styles.navbar}>
      <Link href="/" className={styles.logo}>
        <svg
          className={styles.logoSvg}
          viewBox="0 0 24 24"
          width="24"
          height="24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm0 18c-3.75-1-6-4.98-6-9V8.24l6-3.33 6 3.33V11c0 4.02-2.25 8-6 9z"
            fillRule="evenodd"
          />
        </svg>
        <span>Centinel</span>
      </Link>

      <nav className={styles.navLinks}>
        <Link href="/#features" className={styles.link}>
          Features
        </Link>
        <Link href="/#use-cases" className={styles.link}>
          Use Cases
        </Link>
        <Link href="/docs" className={styles.link}>
          Documentation
        </Link>
      </nav>

      <div className={styles.actions}>
        <a
          href="https://github.com/blaqjeff/Centinel"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.githubBadge}
        >
          <svg
            height="18"
            viewBox="0 0 16 16"
            width="18"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <span>GitHub</span>
          <span className={styles.starsCount}>
            <svg viewBox="0 0 24 24" width="12" height="12">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
            {stars !== null ? stars : "—"}
          </span>
        </a>

        <a
          href="https://www.npmjs.com/package/@ejemo/centinel"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.npmLink}
        >
          <span>NPM</span>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </header>
  );
}

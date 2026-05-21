"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import styles from "./page.module.css";

/* ─── Terminal Animation Sequence ────────────────────────────────────────── */

interface TermLine {
  text: string;
  type: "cmd" | "info" | "success" | "blank";
  delay: number; // ms to wait BEFORE showing this line
}

const SEQUENCE: TermLine[] = [
  { text: "$ npm install @ejemo/centinel", type: "cmd", delay: 0 },
  { text: "", type: "blank", delay: 600 },
  { text: "added 1 package in 1.2s", type: "info", delay: 800 },
  { text: "", type: "blank", delay: 500 },
  { text: "$ npx centinel init", type: "cmd", delay: 700 },
  { text: "", type: "blank", delay: 500 },
  { text: "🛡️  Initializing Centinel (x402-Connect)...", type: "info", delay: 600 },
  { text: "", type: "blank", delay: 300 },
  { text: "   Detected framework:  Next.js", type: "info", delay: 400 },
  { text: "   Language:            TypeScript", type: "info", delay: 300 },
  { text: "   src/ directory:      Yes", type: "info", delay: 300 },
  { text: "", type: "blank", delay: 400 },
  { text: "   ✅ Created centinel.config.json", type: "success", delay: 400 },
  { text: "   ✅ Created .env with JWT_SECRET", type: "success", delay: 350 },
  { text: "   ✅ Created src/middleware.ts", type: "success", delay: 350 },
  { text: "", type: "blank", delay: 400 },
  { text: "🎉 Centinel setup complete!", type: "success", delay: 500 },
];

const RESTART_DELAY = 3000; // pause before looping

export default function Home() {
  const [copied, setCopied] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [termLines, setTermLines] = useState<TermLine[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typedText, setTypedText] = useState("");
  const termRef = useRef<HTMLDivElement>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText("npm install @ejemo/centinel");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  // Diagram animation
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 5);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  // Terminal animation
  const runSequence = useCallback(async () => {
    setTermLines([]);
    setTypedText("");
    setIsTyping(false);

    for (let i = 0; i < SEQUENCE.length; i++) {
      const line = SEQUENCE[i];

      // Wait before showing this line
      if (line.delay > 0) {
        await new Promise((r) => setTimeout(r, line.delay));
      }

      // For command lines, type them out character by character
      if (line.type === "cmd") {
        setIsTyping(true);
        setTypedText("");
        for (let c = 0; c < line.text.length; c++) {
          await new Promise((r) => setTimeout(r, 30 + Math.random() * 25));
          setTypedText(line.text.slice(0, c + 1));
        }
        setIsTyping(false);
        setTermLines((prev) => [...prev, line]);
        setTypedText("");
      } else {
        // Info/success lines appear instantly
        setTermLines((prev) => [...prev, line]);
      }

      // Auto-scroll
      if (termRef.current) {
        termRef.current.scrollTop = termRef.current.scrollHeight;
      }
    }

    // Pause before restarting
    await new Promise((r) => setTimeout(r, RESTART_DELAY));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loop = async () => {
      while (!cancelled) {
        await runSequence();
      }
    };
    loop();

    return () => { cancelled = true; };
  }, [runSequence]);

  return (
    <main style={{ minHeight: "100vh", overflowX: "hidden" }}>
      <div className="hero-gradient" />

      {/* Hero Section */}
      <section className={styles.hero}>
        <h1 className={styles.title}>
          Monetize your APIs
          <br />
          for AI Agents and Bots
        </h1>
        <p className={styles.subtitle}>
          A low-code middleware framework that lets developers charge AI agents
          micropayments in crypto to access protected routes. Drop it into
          Express or Next.js in under 2 minutes.
        </p>

        <div className={styles.ctaGroup}>
          <Link href="/docs" className="btn btn-primary">
            Get Started
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <a href="https://github.com/blaqjeff/Centinel" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            View on GitHub
          </a>
        </div>

        {/* Animated Mini Terminal */}
        <div className={styles.miniTerminal}>
          <div className={styles.miniTermHeader}>
            <div className={styles.miniTermDots}>
              <span style={{ background: "#ff5f57" }} />
              <span style={{ background: "#febc2e" }} />
              <span style={{ background: "#28c840" }} />
            </div>
            <span className={styles.miniTermTitle}>Terminal</span>
            <button className={styles.copyBtn} onClick={handleCopy} title="Copy install command">
              {copied ? (
                <svg className={styles.copySuccess} viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          </div>
          <div className={styles.miniTermBody} ref={termRef}>
            {termLines.map((line, i) => (
              <div
                key={i}
                className={`${styles.termLine} ${
                  line.type === "cmd" ? styles.termCmd :
                  line.type === "success" ? styles.termSuccess :
                  line.type === "blank" ? styles.termBlank :
                  styles.termInfo
                }`}
              >
                {line.text}
              </div>
            ))}
            {/* Currently typing line */}
            {(isTyping || typedText) && (
              <div className={`${styles.termLine} ${styles.termCmd}`}>
                {typedText}
                <span className={styles.cursor} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Protocol Diagram Section */}
      <section className={styles.section} id="protocol">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>How it works</h2>
          <p className={styles.sectionSubtitle}>
            The x402 payment loop — from first request to verified access.
          </p>
        </div>

        <div className={styles.diagramContainer}>
          <div className={styles.diagram}>
            <div className={styles.diagramNode} style={{ borderColor: activeStep === 0 || activeStep === 2 || activeStep === 3 ? "var(--primary)" : "var(--border-color)" }}>
              <h4>AI Agent / Bot</h4>
              <p>Crawling content or querying an endpoint</p>
            </div>

            <div className={styles.diagramFlow}>
              <div className={`${styles.diagramStep} ${activeStep === 0 ? styles.stepActive : ""}`}>
                <span className={styles.stepNumber}>1</span>
                <span className={styles.stepText}>GET /api/scraped-data</span>
                <span className={styles.stepDirection}>→</span>
              </div>
              <div className={`${styles.diagramStep} ${activeStep === 1 ? styles.stepActive : ""}`}>
                <span className={styles.stepNumber}>2</span>
                <span className={styles.stepText}>402 Payment Required</span>
                <span className={styles.stepDirection}>←</span>
              </div>
              <div className={`${styles.diagramStep} ${activeStep === 2 ? styles.stepActive : ""}`}>
                <span className={styles.stepNumber}>3</span>
                <span className={styles.stepText}>USDC Payment (on-chain)</span>
                <span className={styles.stepDirection}>→</span>
              </div>
              <div className={`${styles.diagramStep} ${activeStep === 3 ? styles.stepActive : ""}`}>
                <span className={styles.stepNumber}>4</span>
                <span className={styles.stepText}>GET with X-Payment-Signature</span>
                <span className={styles.stepDirection}>→</span>
              </div>
              <div className={`${styles.diagramStep} ${activeStep === 4 ? styles.stepActive : ""}`}>
                <span className={styles.stepNumber}>5</span>
                <span className={styles.stepText}>200 OK + Payload Released</span>
                <span className={styles.stepDirection}>←</span>
              </div>
            </div>

            <div className={styles.diagramNode} style={{ borderColor: activeStep === 1 || activeStep === 4 ? "var(--success)" : "var(--border-color)" }}>
              <h4>Your API + Centinel</h4>
              <p>Validates on-chain signatures &amp; manages sessions</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.section} id="features">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Built for production</h2>
          <p className={styles.sectionSubtitle}>
            Everything you need for machine-to-machine micropayments, out of the box.
          </p>
        </div>

        <div className="container">
          <div className={styles.grid}>
            <div className={`${styles.card} glow-card`}>
              <div className={styles.cardIcon}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h3 className={styles.cardTitle}>Replay protection</h3>
              <p className={styles.cardDesc}>
                In-memory signature deduplication and on-chain transaction age checks prevent double-spending. Each signature can only be used once.
              </p>
            </div>

            <div className={`${styles.card} glow-card`}>
              <div className={styles.cardIcon}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <h3 className={styles.cardTitle}>Multi-chain, multi-token</h3>
              <p className={styles.cardDesc}>
                Accepts USDC, SOL, and ETH across Solana and Base L2. Agents pay with whatever token they have — you get paid either way.
              </p>
            </div>

            <div className={`${styles.card} glow-card`}>
              <div className={styles.cardIcon}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <h3 className={styles.cardTitle}>Flexible billing</h3>
              <p className={styles.cardDesc}>
                Choose <strong>per_request</strong> for pay-as-you-go access or <strong>per_session</strong> for timed JWT tokens. Set different prices per route.
              </p>
            </div>

            <div className={`${styles.card} glow-card`}>
              <div className={styles.cardIcon}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <h3 className={styles.cardTitle}>Rate limiting</h3>
              <p className={styles.cardDesc}>
                Built-in per-IP rate limiter blocks signature spamming after 5 failed attempts, protecting your RPC nodes from abuse.
              </p>
            </div>

            <div className={`${styles.card} glow-card`}>
              <div className={styles.cardIcon}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <h3 className={styles.cardTitle}>Zero config</h3>
              <p className={styles.cardDesc}>
                The CLI auto-detects your framework, language, and directory structure. One command scaffolds everything you need.
              </p>
            </div>

            <div className={`${styles.card} glow-card`}>
              <div className={styles.cardIcon}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <h3 className={styles.cardTitle}>Edge-ready</h3>
              <p className={styles.cardDesc}>
                Next.js middleware runs at the edge with Web Crypto — no cold starts, no Node.js SDK dependencies. Works on Vercel out of the box.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className={styles.section} id="use-cases">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Who is this for?</h2>
          <p className={styles.sectionSubtitle}>
            If bots are consuming your resources for free, Centinel lets you charge them.
          </p>
        </div>

        <div className="container">
          <div className={styles.useCaseGrid}>
            <div className={styles.useCaseCard}>
              <div className={styles.useCaseIcon}>
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                </svg>
              </div>
              <h3 className={styles.useCaseTitle}>Publishers &amp; Bloggers</h3>
              <p className={styles.useCaseDesc}>
                AI crawlers like GPTBot and ClaudeBot are training on your articles, recipes, and reporting. Centinel lets you charge them per-page instead of blocking them entirely with robots.txt.
              </p>
            </div>

            <div className={styles.useCaseCard}>
              <div className={styles.useCaseIcon}>
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <h3 className={styles.useCaseTitle}>API &amp; SaaS Providers</h3>
              <p className={styles.useCaseDesc}>
                Instead of requiring agents to sign up, enter a credit card, and commit to subscriptions, charge them fractions of a cent per call. No accounts. No onboarding friction.
              </p>
            </div>

            <div className={styles.useCaseCard}>
              <div className={styles.useCaseIcon}>
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
                  <rect x="9" y="9" width="6" height="6" />
                  <line x1="9" y1="1" x2="9" y2="4" />
                  <line x1="15" y1="1" x2="15" y2="4" />
                  <line x1="9" y1="20" x2="9" y2="23" />
                  <line x1="15" y1="20" x2="15" y2="23" />
                  <line x1="20" y1="9" x2="23" y2="9" />
                  <line x1="20" y1="14" x2="23" y2="14" />
                  <line x1="1" y1="9" x2="4" y2="9" />
                  <line x1="1" y1="14" x2="4" y2="14" />
                </svg>
              </div>
              <h3 className={styles.useCaseTitle}>AI Compute Hosts</h3>
              <p className={styles.useCaseDesc}>
                Running GPU models or fine-tuned nets? Charge executing agents exactly what the inference costs. Per-request pricing that matches your actual compute spend.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className="container">
          <p>
            © {new Date().getFullYear()} Ejemo Tech. Released under the MIT License.
            <a href="https://github.com/blaqjeff/Centinel" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>
              GitHub
            </a>
            <a href="https://www.npmjs.com/package/@ejemo/centinel" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>
              NPM Registry
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}

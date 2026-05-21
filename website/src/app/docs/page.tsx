"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./Docs.module.css";

interface SidebarItem {
  id: string;
  label: string;
}

const sidebarItems: SidebarItem[] = [
  { id: "intro", label: "Introduction" },
  { id: "quickstart", label: "Quick Start" },
  { id: "cli", label: "CLI & Auto-Detection" },
  { id: "express", label: "Express Setup" },
  { id: "nextjs", label: "Next.js Setup" },
  { id: "config", label: "Configuration" },
  { id: "security", label: "Security & Verification" },
  { id: "environment", label: "Environment Variables" },
  { id: "mocking", label: "Local Mocking" },
];

/* ─── Token Types for Syntax Highlighting ────────────────────────────────── */

type TokenType = "keyword" | "string" | "comment" | "builtin" | "number" | "punctuation" | "operator" | "type" | "property" | "plain";

interface Token {
  type: TokenType;
  value: string;
}

/**
 * A lightweight tokenizer that produces IDE-quality syntax highlighting.
 * Processes code character-by-character to avoid regex collision issues.
 */
function tokenize(code: string, lang: string): Token[] {
  const tokens: Token[] = [];

  const jsKeywords = new Set([
    "import", "from", "export", "const", "let", "var", "function", "return",
    "await", "async", "interface", "type", "if", "else", "true", "false",
    "null", "undefined", "typeof", "class", "new", "as", "default", "extends",
    "implements", "throw", "try", "catch", "finally", "for", "while", "do",
    "switch", "case", "break", "continue", "void", "in", "of", "static",
  ]);

  const jsTypes = new Set([
    "string", "number", "boolean", "any", "Promise", "NextRequest",
    "NextResponse", "Request", "Response", "NextFunction",
  ]);

  const jsBuiltins = new Set([
    "console", "process", "JSON", "Math", "Date", "Error", "Array",
    "Object", "require", "module", "exports",
  ]);

  if (lang === "json") {
    return tokenizeJson(code);
  }

  if (lang === "bash" || lang === "shell") {
    return tokenizeBash(code);
  }

  let i = 0;
  const len = code.length;

  while (i < len) {
    // Line comments
    if (code[i] === "/" && code[i + 1] === "/") {
      let end = code.indexOf("\n", i);
      if (end === -1) end = len;
      tokens.push({ type: "comment", value: code.slice(i, end) });
      i = end;
      continue;
    }

    // Block comments
    if (code[i] === "/" && code[i + 1] === "*") {
      let end = code.indexOf("*/", i + 2);
      if (end === -1) end = len;
      else end += 2;
      tokens.push({ type: "comment", value: code.slice(i, end) });
      i = end;
      continue;
    }

    // Strings (single, double, backtick)
    if (code[i] === '"' || code[i] === "'" || code[i] === "`") {
      const quote = code[i];
      let j = i + 1;
      while (j < len && code[j] !== quote) {
        if (code[j] === "\\") j++; // skip escaped chars
        j++;
      }
      j++; // include closing quote
      tokens.push({ type: "string", value: code.slice(i, j) });
      i = j;
      continue;
    }

    // Numbers
    if (/\d/.test(code[i]) && (i === 0 || /[\s,;:=({[+\-*/]/.test(code[i - 1]))) {
      let j = i;
      while (j < len && /[\d.xXa-fA-FeE_n]/.test(code[j])) j++;
      tokens.push({ type: "number", value: code.slice(i, j) });
      i = j;
      continue;
    }

    // Words (identifiers, keywords, types)
    if (/[a-zA-Z_$@]/.test(code[i])) {
      let j = i;
      while (j < len && /[a-zA-Z0-9_$]/.test(code[j])) j++;
      const word = code.slice(i, j);

      if (jsKeywords.has(word)) {
        tokens.push({ type: "keyword", value: word });
      } else if (jsTypes.has(word)) {
        tokens.push({ type: "type", value: word });
      } else if (jsBuiltins.has(word)) {
        tokens.push({ type: "builtin", value: word });
      } else if (j < len && code[j] === "(") {
        tokens.push({ type: "builtin", value: word });
      } else if (j < len && code[j] === ":") {
        tokens.push({ type: "property", value: word });
      } else {
        tokens.push({ type: "plain", value: word });
      }
      i = j;
      continue;
    }

    // Punctuation & operators
    if (/[{}()\[\];,.:=<>!&|?+\-*/%^~@#]/.test(code[i])) {
      // Multi-char operators
      const twoChar = code.slice(i, i + 2);
      const threeChar = code.slice(i, i + 3);
      if (["===", "!==", "==>", "..."].includes(threeChar)) {
        tokens.push({ type: "operator", value: threeChar });
        i += 3;
        continue;
      }
      if (["=>", "==", "!=", ">=", "<=", "&&", "||", "??", "?."].includes(twoChar)) {
        tokens.push({ type: "operator", value: twoChar });
        i += 2;
        continue;
      }
      tokens.push({ type: "punctuation", value: code[i] });
      i++;
      continue;
    }

    // Whitespace and everything else
    let j = i;
    while (j < len && !/[a-zA-Z0-9_$"'`/{}()\[\];,.:=<>!&|?+\-*/%^~@#]/.test(code[j])) j++;
    if (j === i) j = i + 1;
    tokens.push({ type: "plain", value: code.slice(i, j) });
    i = j;
  }

  return tokens;
}

function tokenizeJson(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = code.length;

  while (i < len) {
    // Strings
    if (code[i] === '"') {
      let j = i + 1;
      while (j < len && code[j] !== '"') {
        if (code[j] === "\\") j++;
        j++;
      }
      j++;
      const str = code.slice(i, j);
      // Check if it's a key (followed by colon)
      let k = j;
      while (k < len && /\s/.test(code[k])) k++;
      if (k < len && code[k] === ":") {
        tokens.push({ type: "property", value: str });
      } else {
        tokens.push({ type: "string", value: str });
      }
      i = j;
      continue;
    }

    // Numbers
    if (/[\d]/.test(code[i])) {
      let j = i;
      while (j < len && /[\d.]/.test(code[j])) j++;
      tokens.push({ type: "number", value: code.slice(i, j) });
      i = j;
      continue;
    }

    // Keywords (true, false, null)
    if (/[a-z]/.test(code[i])) {
      let j = i;
      while (j < len && /[a-z]/.test(code[j])) j++;
      const word = code.slice(i, j);
      if (["true", "false", "null"].includes(word)) {
        tokens.push({ type: "keyword", value: word });
      } else {
        tokens.push({ type: "plain", value: word });
      }
      i = j;
      continue;
    }

    // Punctuation
    if (/[{}[\]:,]/.test(code[i])) {
      tokens.push({ type: "punctuation", value: code[i] });
      i++;
      continue;
    }

    // Whitespace
    let j = i;
    while (j < len && /\s/.test(code[j])) j++;
    if (j === i) j++;
    tokens.push({ type: "plain", value: code.slice(i, j) });
    i = j;
  }

  return tokens;
}

function tokenizeBash(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = code.length;

  while (i < len) {
    // Comments
    if (code[i] === "#") {
      let end = code.indexOf("\n", i);
      if (end === -1) end = len;
      tokens.push({ type: "comment", value: code.slice(i, end) });
      i = end;
      continue;
    }

    // Strings
    if (code[i] === '"' || code[i] === "'") {
      const quote = code[i];
      let j = i + 1;
      while (j < len && code[j] !== quote) j++;
      j++;
      tokens.push({ type: "string", value: code.slice(i, j) });
      i = j;
      continue;
    }

    // $ prompt
    if (code[i] === "$" && (i === 0 || code[i - 1] === "\n")) {
      tokens.push({ type: "operator", value: "$" });
      i++;
      continue;
    }

    // Words
    if (/[a-zA-Z_@\-]/.test(code[i])) {
      let j = i;
      while (j < len && /[a-zA-Z0-9_@\-/.]/.test(code[j])) j++;
      const word = code.slice(i, j);
      const bashCmds = new Set(["npm", "npx", "install", "init", "run", "cd", "mkdir", "echo", "export", "curl"]);
      if (bashCmds.has(word)) {
        tokens.push({ type: "keyword", value: word });
      } else if (word.startsWith("--") || word.startsWith("-")) {
        tokens.push({ type: "type", value: word });
      } else {
        tokens.push({ type: "plain", value: word });
      }
      i = j;
      continue;
    }

    let j = i + 1;
    tokens.push({ type: "plain", value: code.slice(i, j) });
    i = j;
  }

  return tokens;
}

/* ─── Color Map for Token Types ──────────────────────────────────────────── */

const tokenColors: Record<TokenType, string> = {
  keyword: "#c678dd",     // purple
  string: "#98c379",      // green
  comment: "#5c6370",     // grey, italic
  builtin: "#61afef",     // blue
  number: "#d19a66",      // orange
  punctuation: "#abb2bf",  // light grey
  operator: "#56b6c2",    // cyan
  type: "#e5c07b",        // yellow
  property: "#e06c75",    // red/coral
  plain: "#abb2bf",       // default light grey
};

/* ─── Main Component ─────────────────────────────────────────────────────── */

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("intro");
  const [copyLlmCopied, setCopyLlmCopied] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeSection]);

  const handleCopyCode = useCallback(async (codeId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCodeId(codeId);
      setTimeout(() => setCopiedCodeId(null), 2000);
    } catch (err) {
      console.error("Failed to copy code: ", err);
    }
  }, []);

  const handleCopyForLlm = async () => {
    try {
      const response = await fetch("/llms.txt");
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      setCopyLlmCopied(true);
      setTimeout(() => setCopyLlmCopied(false), 2000);
    } catch (err) {
      console.error("Failed to fetch/copy llms.txt: ", err);
    }
  };

  /* ─── CodeBlock component with IDE-quality syntax highlighting ──────── */

  const CodeBlock = ({ id, code, filename, lang = "typescript" }: { id: string; code: string; filename?: string; lang?: string }) => {
    const tokens = tokenize(code, lang);

    return (
      <div className={styles.codeBlockWrapper}>
        <div className={styles.codeBlockHeader}>
          <div className={styles.codeBlockDots}>
            <span className={styles.dot} style={{ background: "#ff5f57" }} />
            <span className={styles.dot} style={{ background: "#febc2e" }} />
            <span className={styles.dot} style={{ background: "#28c840" }} />
            <span className={styles.codeBlockFilename}>{filename || lang}</span>
          </div>
          <button
            onClick={() => handleCopyCode(id, code)}
            className={styles.copyCodeBtn}
            title="Copy snippet"
          >
            {copiedCodeId === id ? (
              <>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
        <pre className={styles.codeBlockBody}>
          <code>
            {tokens.map((token, i) => (
              <span
                key={i}
                style={{
                  color: tokenColors[token.type],
                  fontStyle: token.type === "comment" ? "italic" : undefined,
                }}
              >
                {token.value}
              </span>
            ))}
          </code>
        </pre>
        <div className={styles.codeBlockLineNumbers}>
          {code.split("\n").map((_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* Sidebar Navigation */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTitle}>Documentation</div>
        <ul className={styles.sidebarList}>
          {sidebarItems.map((item) => (
            <li
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`${styles.sidebarItem} ${
                activeSection === item.id ? styles.sidebarItemActive : ""
              }`}
            >
              {item.label}
            </li>
          ))}
        </ul>
      </aside>

      {/* Main Content Area */}
      <main className={styles.contentArea}>
        {/* LLM / AI Prompt Helper Banner */}
        <div className={styles.llmBar}>
          <div className={styles.llmText}>
            <strong>AI-Ready Docs:</strong> Feed these docs directly into your AI assistant (Claude, GPT, Cursor, Copilot). Get the complete reference as a single markdown file.
          </div>
          <div className={styles.llmBtnGroup}>
            <button
              onClick={handleCopyForLlm}
              className="btn btn-primary"
              style={{ padding: "8px 14px", fontSize: "0.8rem" }}
            >
              {copyLlmCopied ? "Copied!" : "Copy for LLM"}
            </button>
            <a
              href="/llms.txt"
              download="llms.txt"
              className="btn btn-secondary"
              style={{ padding: "8px 14px", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              llms.txt
            </a>
          </div>
        </div>

        {/* ══════════════════ INTRODUCTION ══════════════════ */}
        <section className={`${styles.section} ${activeSection === "intro" ? styles.sectionActive : ""}`}>
          <h1 className={styles.docTitle}>Introduction</h1>
          <p className={styles.docSubtitle}>
            Centinel is a low-code middleware framework that implements the HTTP 402 Payment Required protocol to monetize bot and AI agent traffic on your web server.
          </p>

          <h2>Why Centinel?</h2>
          <p>
            AI agents, web scrapers, and automated scripts (ChatGPT, ClaudeBot, custom crawlers) now account for a rapidly growing share of internet traffic. Traditional responses are binary: allow them unlimited free access, or block them entirely with CAPTCHAs and WAFs.
          </p>
          <p>
            Centinel introduces a third way: <strong>The Agentic Web Paywall</strong>. Instead of blocking bots, Centinel challenges them with a machine-readable payment request. If the agent pays (in USDC, SOL, or ETH), it gets instant, cryptographically verified access. No sign-ups. No credit cards. No subscription overhead.
          </p>

          <h2>What Centinel Protects</h2>
          <p>
            Centinel sits as middleware on your server and intercepts requests to any route you define — <strong>API endpoints, page routes, file paths, or any URL pattern</strong>. When an unpaid request hits a protected route, Centinel responds with a standardized <span className={styles.inlineCode}>402 Payment Required</span> challenge containing wallet addresses, price, and chain information. The agent parses this, pays on-chain, and retries with the transaction signature.
          </p>

          <h2>The x402 Protocol Flow</h2>
          <ol>
            <li><strong>Request:</strong> An agent or bot sends a request to a protected route.</li>
            <li><strong>Challenge:</strong> Centinel intercepts the request and returns HTTP <span className={styles.inlineCode}>402</span> with payment instructions in <span className={styles.inlineCode}>WWW-Authenticate</span> headers and a JSON body.</li>
            <li><strong>Payment:</strong> The agent executes a USDC/SOL/ETH transfer on Solana or Base, then retries the request with the transaction signature in <span className={styles.inlineCode}>X-Payment-Signature</span> and <span className={styles.inlineCode}>X-Payment-Chain</span> headers.</li>
            <li><strong>Verification:</strong> Centinel verifies the transaction on-chain (destination, amount, recency). On success, it issues a cryptographically signed <strong>Time-Locked Proof</strong> (JWT) and serves the route payload.</li>
            <li><strong>Session:</strong> For <span className={styles.inlineCode}>per_session</span> routes, subsequent requests within the TTL window bypass payment using the JWT proof.</li>
          </ol>

          <h2>Supported Payments</h2>
          <p>
            Centinel natively verifies transfers of <strong>USDC</strong>, <strong>SOL</strong> (native Solana), and <strong>ETH</strong> (native Base) across both supported blockchains. USDC provides stable, predictable pricing while native token support gives agents maximum flexibility.
          </p>
        </section>

        {/* ══════════════════ QUICK START ══════════════════ */}
        <section className={`${styles.section} ${activeSection === "quickstart" ? styles.sectionActive : ""}`}>
          <h1 className={styles.docTitle}>Quick Start</h1>
          <p className={styles.docSubtitle}>
            Get Centinel running in your project in under 2 minutes.
          </p>

          <h2>1. Install</h2>
          <CodeBlock
            id="install-npm"
            code="npm install @ejemo/centinel"
            lang="bash"
          />

          <h2>2. Initialize</h2>
          <p>
            Run the CLI to automatically set up your project. Centinel will detect your framework, language, and directory structure, then scaffold everything for you:
          </p>
          <CodeBlock
            id="init-cmd"
            code="npx centinel init"
            lang="bash"
          />
          <p>This single command does the following:</p>
          <ul>
            <li>Detects whether you're using <strong>Next.js</strong> or <strong>Express.js</strong> from your <span className={styles.inlineCode}>package.json</span></li>
            <li>Detects whether you use <strong>TypeScript</strong> or <strong>JavaScript</strong> by checking for <span className={styles.inlineCode}>tsconfig.json</span></li>
            <li>Detects whether you use a <span className={styles.inlineCode}>src/</span> directory layout</li>
            <li>Creates <span className={styles.inlineCode}>centinel.config.json</span> with example rules and placeholder wallets</li>
            <li>Generates a secure <span className={styles.inlineCode}>JWT_SECRET</span> and injects it into your <span className={styles.inlineCode}>.env</span> file</li>
            <li>For Next.js: auto-creates a <span className={styles.inlineCode}>middleware.ts</span> (or <span className={styles.inlineCode}>.js</span>) file in the correct location</li>
            <li>For Express: prints the exact import and middleware snippet you need</li>
          </ul>

          <h2>3. Configure Your Wallets</h2>
          <p>
            Open <span className={styles.inlineCode}>centinel.config.json</span> and replace the placeholder wallet addresses with your actual Solana and/or Base wallet addresses:
          </p>
          <CodeBlock
            id="config-json-quickstart"
            code={`{
  "wallets": {
    "solana": "YOUR_SOLANA_WALLET_ADDRESS_HERE",
    "base": "YOUR_BASE_WALLET_ADDRESS_HERE"
  },
  "rules": [
    {
      "path": "/api/scraped-data",
      "price": "0.01",
      "model": "per_request"
    },
    {
      "path": "/premium-tools/*",
      "price": "0.10",
      "model": "per_session",
      "duration": "1h"
    }
  ],
  "maxTransactionAge": 300
}`}
            filename="centinel.config.json"
            lang="json"
          />

          <h2>4. Start Your Server</h2>
          <p>That's it. Start your development server as usual and Centinel will begin intercepting requests to the routes defined in your config.</p>
        </section>

        {/* ══════════════════ CLI & AUTO-DETECTION ══════════════════ */}
        <section className={`${styles.section} ${activeSection === "cli" ? styles.sectionActive : ""}`}>
          <h1 className={styles.docTitle}>CLI &amp; Auto-Detection</h1>
          <p className={styles.docSubtitle}>
            Centinel's CLI intelligently inspects your project and scaffolds the right files in the right places.
          </p>

          <h2>What Gets Detected</h2>
          <p>
            When you run <span className={styles.inlineCode}>npx centinel init</span>, the CLI reads your project directory and detects:
          </p>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Detection</th>
                  <th>How</th>
                  <th>Effect</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className={styles.inlineCode}>Framework</span></td>
                  <td>Checks <span className={styles.inlineCode}>package.json</span> dependencies for <span className={styles.inlineCode}>next</span> or <span className={styles.inlineCode}>express</span></td>
                  <td>Determines which middleware to scaffold</td>
                </tr>
                <tr>
                  <td><span className={styles.inlineCode}>Language</span></td>
                  <td>Checks for <span className={styles.inlineCode}>tsconfig.json</span></td>
                  <td>Generates <span className={styles.inlineCode}>.ts</span> or <span className={styles.inlineCode}>.js</span> files accordingly</td>
                </tr>
                <tr>
                  <td><span className={styles.inlineCode}>src/ directory</span></td>
                  <td>Checks if a <span className={styles.inlineCode}>src/</span> folder exists</td>
                  <td>Places middleware in <span className={styles.inlineCode}>src/middleware.ts</span> or <span className={styles.inlineCode}>middleware.ts</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>What Gets Created</h2>
          <p>The CLI creates the following files automatically:</p>

          <h3>centinel.config.json</h3>
          <p>
            The main configuration file with placeholder wallet addresses and example paywall rules. Always created in the project root.
          </p>

          <h3>.env (JWT_SECRET)</h3>
          <p>
            A cryptographically secure 64-character hex JWT secret is generated and injected into your <span className={styles.inlineCode}>.env</span> file. If the file already exists and contains a <span className={styles.inlineCode}>JWT_SECRET</span>, it is left untouched.
          </p>

          <h3>middleware.ts / middleware.js (Next.js only)</h3>
          <p>
            For Next.js projects, Centinel creates a complete Edge-compatible middleware file. It uses a catch-all matcher that routes through Centinel, which then consults <span className={styles.inlineCode}>centinel.config.json</span> to decide which paths require payment. If a middleware file already exists, Centinel prints integration instructions instead of overwriting it.
          </p>

          <h2>Example CLI Output</h2>
          <CodeBlock
            id="cli-output"
            code={`🛡️  Initializing Centinel (x402-Connect)...

   Detected framework:  Next.js
   Language:            TypeScript
   src/ directory:      Yes

   ✅ Created centinel.config.json
   ✅ Created .env with JWT_SECRET and RPC config
   ✅ Created src/middleware.ts

🎉 Centinel setup complete! Next steps:

   1. Open centinel.config.json and replace the wallet placeholders
      with your Solana and/or Base wallet addresses.
   2. Edit the "rules" array to define which routes are paywalled,
      their prices, and payment models (per_request or per_session).`}
            filename="Terminal"
            lang="bash"
          />
        </section>

        {/* ══════════════════ EXPRESS SETUP ══════════════════ */}
        <section className={`${styles.section} ${activeSection === "express" ? styles.sectionActive : ""}`}>
          <h1 className={styles.docTitle}>Express Setup</h1>
          <p className={styles.docSubtitle}>
            Protect your Express.js API endpoints with the Centinel middleware.
          </p>

          <h2>Middleware Integration</h2>
          <p>
            After running <span className={styles.inlineCode}>npx centinel init</span>, add the Centinel middleware to your Express app. Centinel automatically reads <span className={styles.inlineCode}>centinel.config.json</span> from the project root and matches incoming requests against your rules.
          </p>
          <CodeBlock
            id="express-setup"
            code={`import express from 'express';
import { centinelExpress } from '@ejemo/centinel';

const app = express();

// Apply Centinel middleware — reads rules from centinel.config.json
// Place this BEFORE your route handlers
app.use(centinelExpress());

// Your routes work exactly as before
app.get('/api/data', (req, res) => {
  res.json({
    data: "This response was paid for by the requesting agent.",
    timestamp: new Date()
  });
});

app.get('/premium-tools/analyze', (req, res) => {
  res.json({ result: "Premium analysis complete." });
});

app.listen(3000, () => console.log('Server running on port 3000'));`}
            filename="server.ts"
          />

          <h2>How It Works</h2>
          <ol>
            <li>When a request arrives, Centinel checks the path against the <span className={styles.inlineCode}>rules</span> array in your config.</li>
            <li>If the path doesn't match any rule, the request passes through untouched.</li>
            <li>If the path matches but no valid payment proof is found, Centinel returns a <span className={styles.inlineCode}>402 Payment Required</span> response with payment instructions.</li>
            <li>If the request includes valid <span className={styles.inlineCode}>X-Payment-Signature</span> and <span className={styles.inlineCode}>X-Payment-Chain</span> headers, Centinel verifies the transaction on-chain and grants access.</li>
          </ol>

          <h2>Session Token Extraction</h2>
          <p>
            Centinel automatically extracts session proof tokens from multiple sources in this priority order:
          </p>
          <ul>
            <li><span className={styles.inlineCode}>x-centinel-proof</span> cookie (works with <span className={styles.inlineCode}>cookie-parser</span> or Centinel's built-in cookie reader)</li>
            <li><span className={styles.inlineCode}>Authorization: Bearer &lt;token&gt;</span> header</li>
            <li><span className={styles.inlineCode}>X-Centinel-Proof</span> header</li>
          </ul>
          <p>
            <strong>Note:</strong> <span className={styles.inlineCode}>cookie-parser</span> is optional. Centinel includes a built-in fallback cookie parser, so you do not need to install it as a separate dependency.
          </p>
        </section>

        {/* ══════════════════ NEXT.JS SETUP ══════════════════ */}
        <section className={`${styles.section} ${activeSection === "nextjs" ? styles.sectionActive : ""}`}>
          <h1 className={styles.docTitle}>Next.js Setup</h1>
          <p className={styles.docSubtitle}>
            Use Centinel as Next.js Edge Middleware to enforce payment checks at the edge with zero cold starts.
          </p>

          <h2>Auto-Scaffolded Middleware</h2>
          <p>
            When you run <span className={styles.inlineCode}>npx centinel init</span> in a Next.js project, Centinel generates this middleware file for you automatically. The file is placed in <span className={styles.inlineCode}>src/middleware.ts</span> or <span className={styles.inlineCode}>middleware.ts</span> depending on your project structure:
          </p>
          <CodeBlock
            id="nextjs-scaffolded"
            code={`import { nextCentinel } from '@ejemo/centinel/next';
import type { NextRequest } from 'next/server';
import centinelConfig from '../centinel.config.json';

export async function middleware(request: NextRequest) {
  return await nextCentinel(request, centinelConfig);
}

// Centinel runs on all routes and checks centinel.config.json
// to decide which paths require payment. No need to list paths
// here — just edit centinel.config.json to add, remove, or
// change protected routes.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};`}
            filename="src/middleware.ts"
          />

          <h2>How the Next.js Middleware Works</h2>
          <p>
            Unlike Express where Centinel reads the config file at runtime, the Next.js middleware imports <span className={styles.inlineCode}>centinel.config.json</span> directly as a JSON module. This is because Next.js Edge Middleware runs in a V8 isolate that doesn't have filesystem access.
          </p>
          <p>
            The broad <span className={styles.inlineCode}>matcher</span> pattern catches all routes except static assets. Centinel then checks each request against your <span className={styles.inlineCode}>rules</span> array internally — unmatched paths pass through with <span className={styles.inlineCode}>NextResponse.next()</span>.
          </p>

          <h2>Existing Middleware</h2>
          <p>
            If you already have a <span className={styles.inlineCode}>middleware.ts</span> file, the CLI will <strong>not overwrite it</strong>. Instead, it prints the exact code you need to integrate Centinel alongside your existing middleware logic:
          </p>
          <CodeBlock
            id="nextjs-existing"
            code={`import { nextCentinel } from '@ejemo/centinel/next';
import type { NextRequest } from 'next/server';
import centinelConfig from '../centinel.config.json';

// Inside your existing middleware function:
const centinelResponse = await nextCentinel(request, centinelConfig);
if (centinelResponse.status === 402) return centinelResponse;`}
            filename="Integration snippet"
          />

          <h2>Edge Compatibility</h2>
          <p>
            Centinel's Next.js integration is fully Edge-compatible. It uses the native <span className={styles.inlineCode}>Web Crypto API</span> for JWT signing and verification (no Node.js <span className={styles.inlineCode}>crypto</span> or <span className={styles.inlineCode}>jsonwebtoken</span> dependency). On-chain verification is done via raw <span className={styles.inlineCode}>fetch</span> calls to JSON-RPC endpoints, with no SDK dependencies required at the Edge.
          </p>
        </section>

        {/* ══════════════════ CONFIGURATION ══════════════════ */}
        <section className={`${styles.section} ${activeSection === "config" ? styles.sectionActive : ""}`}>
          <h1 className={styles.docTitle}>Configuration</h1>
          <p className={styles.docSubtitle}>
            The complete reference for <span className={styles.inlineCode}>centinel.config.json</span>.
          </p>

          <h2>Full Config Example</h2>
          <CodeBlock
            id="config-full"
            code={`{
  "wallets": {
    "solana": "7EcDhSwZ1mG58z9L7P9D6HtgpLhS9Kq7z4yP18WpD6aB",
    "base": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
  },
  "rules": [
    {
      "path": "/api/scraped-data",
      "price": "0.01",
      "model": "per_request"
    },
    {
      "path": "/premium-tools/*",
      "price": "0.10",
      "model": "per_session",
      "duration": "1h"
    }
  ],
  "maxTransactionAge": 300
}`}
            filename="centinel.config.json"
            lang="json"
          />

          <h2>Config Properties</h2>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className={styles.inlineCode}>wallets.solana</span></td>
                  <td>string</td>
                  <td>Optional*</td>
                  <td>Solana wallet address to receive USDC/SOL payments.</td>
                </tr>
                <tr>
                  <td><span className={styles.inlineCode}>wallets.base</span></td>
                  <td>string</td>
                  <td>Optional*</td>
                  <td>EVM wallet address to receive USDC/ETH payments on Base.</td>
                </tr>
                <tr>
                  <td><span className={styles.inlineCode}>rules</span></td>
                  <td>array</td>
                  <td>Yes</td>
                  <td>Array of route protection rules (see below).</td>
                </tr>
                <tr>
                  <td><span className={styles.inlineCode}>maxTransactionAge</span></td>
                  <td>number</td>
                  <td>No</td>
                  <td>Maximum age of a transaction in seconds before it's rejected. Prevents replay attacks. Default: <span className={styles.inlineCode}>300</span> (5 minutes).</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            * At least one wallet (Solana or Base) must be configured with a real address. If both contain placeholder values, Centinel returns a <span className={styles.inlineCode}>500</span> configuration error instead of a <span className={styles.inlineCode}>402</span>.
          </p>

          <h2>Rule Properties</h2>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Type</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className={styles.inlineCode}>path</span></td>
                  <td>string</td>
                  <td>Glob-style route pattern. Examples: <span className={styles.inlineCode}>/api/data</span>, <span className={styles.inlineCode}>/premium/*</span>, <span className={styles.inlineCode}>/posts/*/comments</span></td>
                </tr>
                <tr>
                  <td><span className={styles.inlineCode}>price</span></td>
                  <td>string</td>
                  <td>Cost in USDC (or equivalent in SOL/ETH) that the agent must pay. Example: <span className={styles.inlineCode}>"0.05"</span></td>
                </tr>
                <tr>
                  <td><span className={styles.inlineCode}>model</span></td>
                  <td>string</td>
                  <td>Either <span className={styles.inlineCode}>"per_request"</span> (pay every time) or <span className={styles.inlineCode}>"per_session"</span> (pay once, access for a duration)</td>
                </tr>
                <tr>
                  <td><span className={styles.inlineCode}>duration</span></td>
                  <td>string</td>
                  <td>Required for <span className={styles.inlineCode}>per_session</span>. TTL for the session access token. Examples: <span className={styles.inlineCode}>"15m"</span>, <span className={styles.inlineCode}>"1h"</span>, <span className={styles.inlineCode}>"24h"</span>, <span className={styles.inlineCode}>"7d"</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ══════════════════ SECURITY & VERIFICATION ══════════════════ */}
        <section className={`${styles.section} ${activeSection === "security" ? styles.sectionActive : ""}`}>
          <h1 className={styles.docTitle}>Security &amp; Verification</h1>
          <p className={styles.docSubtitle}>
            How Centinel protects against abuse, double-spending, and replay attacks.
          </p>

          <h2>On-Chain Verification</h2>
          <p>
            When a payment signature is submitted, Centinel performs the following checks against the actual blockchain:
          </p>
          <ol>
            <li><strong>Transaction existence:</strong> Fetches the transaction from the blockchain RPC (with up to 3 retries for propagation delays).</li>
            <li><strong>Transaction success:</strong> Confirms the transaction was not reverted or failed on-chain.</li>
            <li><strong>Recipient match:</strong> Verifies the payment was sent to the wallet address specified in your config.</li>
            <li><strong>Amount match:</strong> Verifies the transferred amount meets or exceeds the rule's price.</li>
            <li><strong>Transaction age:</strong> Rejects transactions older than <span className={styles.inlineCode}>maxTransactionAge</span> seconds (default: 5 minutes) to prevent replays.</li>
            <li><strong>Future transaction rejection:</strong> Rejects transactions with timestamps more than 60 seconds in the future (clock manipulation protection).</li>
          </ol>

          <h2>Replay Protection</h2>
          <p>
            Centinel uses a dual-layer replay protection strategy:
          </p>
          <ul>
            <li><strong>In-memory signature cache:</strong> Every verified signature is stored in a <span className={styles.inlineCode}>Set</span>. Any duplicate submission is immediately rejected without an RPC call.</li>
            <li><strong>Transaction age validation:</strong> Even if the cache is cleared (e.g., server restart), old transactions are rejected by the <span className={styles.inlineCode}>maxTransactionAge</span> check.</li>
          </ul>

          <h2>Rate Limiting</h2>
          <p>
            To prevent bots from spamming invalid signatures and exhausting your RPC node's rate limits, Centinel includes a built-in rate limiter:
          </p>
          <ul>
            <li>Tracks failed verification attempts per IP address</li>
            <li>After <strong>5 failed attempts</strong> within a <strong>60-second window</strong>, the IP is temporarily blocked</li>
            <li>Blocked IPs receive a <span className={styles.inlineCode}>429 Too Many Requests</span> response without triggering RPC calls</li>
            <li>Successful verification resets the failure counter for that IP</li>
          </ul>

          <h2>CORS (Next.js Edge)</h2>
          <p>
            The Next.js middleware automatically handles CORS for cross-origin agent requests. It responds to <span className={styles.inlineCode}>OPTIONS</span> preflight requests and includes <span className={styles.inlineCode}>Access-Control-Allow-Origin: *</span> with all necessary payment-related headers exposed.
          </p>
        </section>

        {/* ══════════════════ ENVIRONMENT VARIABLES ══════════════════ */}
        <section className={`${styles.section} ${activeSection === "environment" ? styles.sectionActive : ""}`}>
          <h1 className={styles.docTitle}>Environment Variables</h1>
          <p className={styles.docSubtitle}>
            Configure these in your <span className={styles.inlineCode}>.env</span> file. The CLI auto-generates the required ones for you.
          </p>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Default</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className={styles.inlineCode}>JWT_SECRET</span></td>
                  <td>(auto-generated)</td>
                  <td><strong>Required.</strong> Secret key for signing session proof JWTs. The CLI generates a secure 64-character hex string for you.</td>
                </tr>
                <tr>
                  <td><span className={styles.inlineCode}>SOLANA_RPC_URL</span></td>
                  <td><span className={styles.inlineCode}>https://api.mainnet-beta.solana.com</span></td>
                  <td>Solana RPC endpoint for verifying transactions. Replace with your own node (Helius, QuickNode, etc.) for production reliability.</td>
                </tr>
                <tr>
                  <td><span className={styles.inlineCode}>BASE_RPC_URL</span></td>
                  <td><span className={styles.inlineCode}>https://mainnet.base.org</span></td>
                  <td>Base L2 RPC endpoint for verifying EVM transactions. Replace with your own node for production reliability.</td>
                </tr>
                <tr>
                  <td><span className={styles.inlineCode}>CENTINEL_ALLOW_MOCK</span></td>
                  <td><span className={styles.inlineCode}>false</span></td>
                  <td>Set to <span className={styles.inlineCode}>true</span> to explicitly allow mock signatures. Only needed if you want mocks in a production-like environment.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>Auto-Generated .env</h2>
          <p>
            The CLI creates or appends to your <span className={styles.inlineCode}>.env</span> with the following template:
          </p>
          <CodeBlock
            id="env-template"
            code={`# Centinel Session JWT Key
JWT_SECRET="a1b2c3d4e5f6...your-auto-generated-64-char-hex..."

# Centinel RPC Endpoints (Optional)
# If left blank, Centinel falls back to public mainnet nodes.
# Uncomment and replace with your own reliable RPC URLs for production.
# SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"
# BASE_RPC_URL="https://mainnet.base.org"`}
            filename=".env"
            lang="bash"
          />
        </section>

        {/* ══════════════════ LOCAL MOCKING ══════════════════ */}
        <section className={`${styles.section} ${activeSection === "mocking" ? styles.sectionActive : ""}`}>
          <h1 className={styles.docTitle}>Local Mocking</h1>
          <p className={styles.docSubtitle}>
            Test the full payment flow locally without touching the blockchain.
          </p>

          <h2>How Mock Signatures Work</h2>
          <p>
            During local development or CI testing, you can bypass real blockchain verification by sending a signature that starts with <span className={styles.inlineCode}>mock_</span>. Centinel recognizes these and accepts them immediately — no RPC calls, no on-chain transactions needed.
          </p>

          <h2>Production Safety</h2>
          <p>
            Mock signatures are <strong>automatically blocked in production</strong>. They only work when:
          </p>
          <ul>
            <li><span className={styles.inlineCode}>NODE_ENV</span> is not set to <span className={styles.inlineCode}>production</span> (the default for local dev), <strong>or</strong></li>
            <li><span className={styles.inlineCode}>CENTINEL_ALLOW_MOCK=true</span> is explicitly set in the environment</li>
          </ul>
          <p>
            If an agent sends a <span className={styles.inlineCode}>mock_</span> signature in production without the override, the request falls through to the <span className={styles.inlineCode}>402</span> challenge (Express) or is rejected with an error message (verifier).
          </p>

          <h2>Testing Locally</h2>
          <CodeBlock
            id="mock-curl"
            code={`# Test a protected endpoint with a mock payment
curl -X GET http://localhost:3000/api/scraped-data \\
  -H "X-Payment-Signature: mock_solana_tx_12345" \\
  -H "X-Payment-Chain: solana"

# You should receive the actual API response, not a 402`}
            filename="Terminal"
            lang="bash"
          />

          <h2>Mock in Code</h2>
          <CodeBlock
            id="mock-code"
            code={`// Example: Agent-side test script
const response = await fetch('http://localhost:3000/api/data', {
  headers: {
    'X-Payment-Signature': 'mock_test_signature_001',
    'X-Payment-Chain': 'solana',
  },
});

const data = await response.json();
console.log(data); // Your actual API response`}
            filename="test-agent.ts"
          />
        </section>
        {/* ══════════════════ PREV / NEXT NAVIGATION ══════════════════ */}
        <div className={styles.sectionNav}>
          {sidebarItems.findIndex((s) => s.id === activeSection) > 0 && (
            <button
              className={styles.navPrev}
              onClick={() => {
                const idx = sidebarItems.findIndex((s) => s.id === activeSection);
                if (idx > 0) setActiveSection(sidebarItems[idx - 1].id);
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              {sidebarItems[sidebarItems.findIndex((s) => s.id === activeSection) - 1]?.label}
            </button>
          )}
          {sidebarItems.findIndex((s) => s.id === activeSection) < sidebarItems.length - 1 && (
            <button
              className={styles.navNext}
              onClick={() => {
                const idx = sidebarItems.findIndex((s) => s.id === activeSection);
                if (idx < sidebarItems.length - 1) setActiveSection(sidebarItems[idx + 1].id);
              }}
            >
              {sidebarItems[sidebarItems.findIndex((s) => s.id === activeSection) + 1]?.label}
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

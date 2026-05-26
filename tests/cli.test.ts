import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

// Helper to create a temp directory for each test
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'centinel-cli-test-'));
}

// Helper to clean up temp directories
function cleanupDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// Helper to run the CLI init command in a given directory
function runCentinelInit(cwd: string): string {
  const initScript = path.resolve(__dirname, '../src/cli/init.ts');
  try {
    return execSync(`npx ts-node "${initScript}" init`, {
      cwd,
      encoding: 'utf-8',
      env: { ...process.env, NODE_ENV: 'test' },
    });
  } catch (err: any) {
    return err.stdout || err.message;
  }
}

// ─── parseMajorVersion & isNext16OrGreater ──────────────────────────────────

// We can't import these directly since they're not exported,
// so we test them indirectly through the CLI behavior.

// ─── Next.js 16+ proxy.ts Generation ────────────────────────────────────────

describe('CLI scaffolding: Next.js 16+ proxy.ts', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) cleanupDir(tempDir);
  });

  test('generates proxy.ts for Next.js 16+', () => {
    tempDir = createTempDir();
    const srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir);

    // Create package.json with Next.js 16
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        dependencies: { next: '16.1.2', react: '19.0.0' },
      }),
      'utf-8'
    );

    // Create tsconfig.json (TypeScript project)
    fs.writeFileSync(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { resolveJsonModule: true } }),
      'utf-8'
    );

    const output = runCentinelInit(tempDir);

    // Should create proxy.ts, NOT middleware.ts
    const proxyPath = path.join(srcDir, 'proxy.ts');
    const middlewarePath = path.join(srcDir, 'middleware.ts');
    expect(fs.existsSync(proxyPath)).toBe(true);
    expect(fs.existsSync(middlewarePath)).toBe(false);

    // The generated file should export a 'proxy' function
    const content = fs.readFileSync(proxyPath, 'utf-8');
    expect(content).toContain('export async function proxy(');
    expect(content).not.toContain('export async function middleware(');
    expect(content).toContain("import { nextCentinel } from '@ejemo/centinel/next'");
  });

  test('generates proxy.js for Next.js ^16 (JS project)', () => {
    tempDir = createTempDir();

    // No tsconfig.json and no src/ dir = JS project without src directory
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-app-js',
        dependencies: { next: '^16.0.0', react: '19.0.0' },
      }),
      'utf-8'
    );

    const output = runCentinelInit(tempDir);

    const proxyPath = path.join(tempDir, 'proxy.js');
    const middlewarePath = path.join(tempDir, 'middleware.js');
    expect(fs.existsSync(proxyPath)).toBe(true);
    expect(fs.existsSync(middlewarePath)).toBe(false);

    const content = fs.readFileSync(proxyPath, 'utf-8');
    expect(content).toContain('export async function proxy(');
  });

  test('generates proxy.ts with ^ version range for Next.js 16', () => {
    tempDir = createTempDir();
    const srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir);

    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        dependencies: { next: '^16.0.0' },
      }),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: {} }),
      'utf-8'
    );

    runCentinelInit(tempDir);

    expect(fs.existsSync(path.join(srcDir, 'proxy.ts'))).toBe(true);
    expect(fs.existsSync(path.join(srcDir, 'middleware.ts'))).toBe(false);
  });
});

// ─── Next.js <16 middleware.ts Generation (Regression) ──────────────────────

describe('CLI scaffolding: Next.js <16 middleware.ts (regression)', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) cleanupDir(tempDir);
  });

  test('generates middleware.ts for Next.js 15', () => {
    tempDir = createTempDir();
    const srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir);

    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-app-15',
        dependencies: { next: '15.2.0', react: '18.0.0' },
      }),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: {} }),
      'utf-8'
    );

    runCentinelInit(tempDir);

    const middlewarePath = path.join(srcDir, 'middleware.ts');
    const proxyPath = path.join(srcDir, 'proxy.ts');
    expect(fs.existsSync(middlewarePath)).toBe(true);
    expect(fs.existsSync(proxyPath)).toBe(false);

    const content = fs.readFileSync(middlewarePath, 'utf-8');
    expect(content).toContain('export async function middleware(');
    expect(content).not.toContain('export async function proxy(');
  });

  test('generates middleware.ts for Next.js 14', () => {
    tempDir = createTempDir();

    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-app-14',
        dependencies: { next: '^14.0.0' },
      }),
      'utf-8'
    );

    runCentinelInit(tempDir);

    const middlewarePath = path.join(tempDir, 'middleware.js');
    expect(fs.existsSync(middlewarePath)).toBe(true);

    const content = fs.readFileSync(middlewarePath, 'utf-8');
    expect(content).toContain('export async function middleware(');
  });

  test('generates middleware.ts for Next.js 13', () => {
    tempDir = createTempDir();
    const srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir);

    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-app-13',
        dependencies: { next: '~13.5.0' },
      }),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: {} }),
      'utf-8'
    );

    runCentinelInit(tempDir);

    expect(fs.existsSync(path.join(srcDir, 'middleware.ts'))).toBe(true);
    expect(fs.existsSync(path.join(srcDir, 'proxy.ts'))).toBe(false);
  });
});

// ─── Existing File Detection ────────────────────────────────────────────────

describe('CLI scaffolding: existing file detection', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) cleanupDir(tempDir);
  });

  test('detects existing proxy.ts and does not overwrite', () => {
    tempDir = createTempDir();
    const srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir);

    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        dependencies: { next: '16.1.2' },
      }),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: {} }),
      'utf-8'
    );

    // Pre-create existing proxy.ts
    const existingContent = '// My existing proxy file\nexport function proxy() {}';
    fs.writeFileSync(path.join(srcDir, 'proxy.ts'), existingContent, 'utf-8');

    const output = runCentinelInit(tempDir);

    // Should NOT overwrite the existing file
    const content = fs.readFileSync(path.join(srcDir, 'proxy.ts'), 'utf-8');
    expect(content).toBe(existingContent);

    // Output should mention integration instructions
    expect(output).toContain('already exists');
  });

  test('detects existing middleware.ts on Next.js 16+ and warns about migration', () => {
    tempDir = createTempDir();
    const srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir);

    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        dependencies: { next: '16.0.0' },
      }),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: {} }),
      'utf-8'
    );

    // Pre-create existing middleware.ts (old convention)
    const existingContent = '// Old middleware\nexport function middleware() {}';
    fs.writeFileSync(path.join(srcDir, 'middleware.ts'), existingContent, 'utf-8');

    const output = runCentinelInit(tempDir);

    // Should NOT create proxy.ts since middleware.ts exists
    expect(fs.existsSync(path.join(srcDir, 'proxy.ts'))).toBe(false);

    // Should warn about migration
    expect(output).toContain('renamed middleware to proxy');
  });
});

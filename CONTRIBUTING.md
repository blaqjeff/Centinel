# Contributing to Centinel

Thank you for your interest in contributing to Centinel! We are building a low-code middleware framework to monetize AI agent and bot traffic using HTTP `402 Payment Required` status codes, and your contributions help make machine-to-machine payments seamless and reliable.

By contributing to this project, you agree to abide by our code of conduct, maintain high code standards, and collaborate respectfully with the community.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Testing](#testing)
5. [Contributing to the Website](#contributing-to-the-website)
6. [Pull Request Process](#pull-request-process)
7. [Release Guidelines](#release-guidelines)

---

## Project Structure

Centinel is organized as a monorepo-lite codebase, consisting of the core NPM package and the Next.js marketing/docs website:

* **`/src`**: Core framework code
  * `/src/core`: Verifiers and configuration engines
  * `/src/middleware`: Middleware implementations for Next.js (Edge-compatible) and Express
  * `/src/cli`: Command Line Interface (`npx centinel init`)
* **`/tests`**: Unit and integration test suites using Jest
* **`/examples`**: Simple setups showing Centinel in action
* **`/website`**: Next.js App Router website (landing page, interactive diagrams, documentation site, and LLM-friendly documentation exports)

---

## Getting Started

### Prerequisites

* **Node.js**: `v18` or `v20`+ (Recommended)
* **npm**: `v9`+ or another package manager (e.g., `pnpm`, `yarn`)
* **Git** installed on your system

### Installation

1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Centinel.git
   cd Centinel
   ```
3. Install core dependencies:
   ```bash
   npm install
   ```

---

## Development Workflow

### Building the Package

Centinel is written in TypeScript and transpiles to JavaScript for publication.

To compile TypeScript source files:
```bash
npm run build
```
This will compile files from `/src` and output them to the `/dist` directory.

### Running Demo Demos

We have pre-configured demonstration scripts in the `/examples` or root directory to test end-to-end payment intercept loops.

1. **Start the demo server**:
   ```bash
   npm run demo:server
   ```
2. **Run the demo agent** (which makes requests and signs mock headers):
   ```bash
   npm run demo:agent
   ```

---

## Testing

We use Jest to write and run unit and integration tests. Writing tests is highly encouraged for any new features or bug fixes.

To run the entire test suite:
```bash
npm test
```

To run tests in watch mode during development:
```bash
npx jest --watch
```

---

## Contributing to the Website

The website is a Next.js App Router project that hosts our marketing landing page, step-by-step payment animations, and developers' guides.

1. Navigate to the website directory:
   ```bash
   cd website
   ```
2. Install website-specific dependencies:
   ```bash
   npm install
   ```
3. Run the local development server:
   ```bash
   npm run dev
   ```
4. Build the static pages for production to verify changes:
   ```bash
   npm run build
   ```

---

## Pull Request Process

We follow a typical Git branch workflow.

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-awesome-feature
   # or
   git checkout -b fix/issue-name
   ```
2. **Write clean code** and ensure it meets our linting/TS requirements. Do not introduce raw design gradients on the website, and preserve dark-black background aesthetics.
3. **Write tests** covering your new features or bug fixes.
4. Run `npm test` and `npm run build` to confirm everything builds and passes.
5. **Commit your changes** using semantic messages (e.g., `feat: add ...`, `fix: resolve ...`, `docs: update ...`).
6. **Push to your fork** and submit a Pull Request (PR) to the `main` branch.

### PR Checklist

Before submitting your PR, please verify:
- [ ] Code compiles without warnings or errors (`npm run build`).
- [ ] All unit tests pass successfully (`npm test`).
- [ ] Code style matches the project formatting.
- [ ] Proper documentation is updated (if applicable).
- [ ] Description includes details of the problem and the proposed solution.

---

## Release Guidelines

*This section is intended for maintainers publishing to npm.*

To release a new version:
1. Update the version number in `package.json` using semantic versioning:
   ```bash
   npm version [patch | minor | major]
   ```
2. Run the release pipeline script which automatically builds, tests, and publishes the package to npm:
   ```bash
   npm run release
   ```

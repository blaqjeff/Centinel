# Centinel Future Roadmap

This document tracks planned features, improvements, and known edge cases that we want to address in future releases.

## High Priority

- [ ] **Rate limiting on failed verifications:** Add protection to prevent bots from spamming invalid signatures, which could cause excessive RPC calls to Solana or Base nodes.
- [ ] **Per-currency pricing:** Allow setting different prices for different currencies (e.g., $0.01 in USDC but 0.0001 in SOL) rather than a single uniform price across all supported chains.

## Medium Priority

- [ ] **Payment webhook/callbacks:** Provide a way for developers to receive webhooks or register callbacks when a payment is successfully verified. This is useful for recording transactions in a custom database.
- [ ] **Dashboard/Analytics:** Build a UI or provide tooling to view revenue metrics, track the most-accessed protected paths, and analyze bot traffic.

## Maintenance / Other

- [ ] **Version management:** Establish a process for version bumping and publishing to npm.
- [ ] **Automated CI/CD:** Add GitHub Actions to automatically run unit tests and type checks on every push or pull request.

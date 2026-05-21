# Centinel Express Demo

This is a local playground to test how Centinel protects an Express server and how an AI agent interacts with it using the HTTP 402 protocol.

## Contents
- **`server.ts`**: A basic Express backend running on `http://localhost:3000`. It uses the Centinel middleware to protect the `/api/weather` and `/api/news` endpoints.
- **`agent.ts`**: A mock script simulating an AI agent that hits the protected server, processes the 402 challenge, generates a mock signature, and re-submits the request.

## How to Run

1. **Start the Server:**
   Open a terminal and start the backend:
   ```bash
   npx ts-node server.ts
   ```

2. **Run the Agent:**
   Open a second terminal window and run the agent to see the 402 protocol in action:
   ```bash
   npx ts-node agent.ts
   ```

*(Note: The agent uses "mock" signatures to bypass blockchain verifications for easy local testing. Real applications in production will require valid on-chain hashes).*

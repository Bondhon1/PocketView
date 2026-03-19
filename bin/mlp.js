#!/usr/bin/env node
import { startProxyServer } from "../src/server.js";

const target = process.argv[2];
const portArg = process.argv[3];
const port = portArg ? Number(portArg) : Number(process.env.PORT ?? 5050);

if (!target || target === "-h" || target === "--help") {
  console.log("Usage: mlp <target-url> [port]");
  console.log("Example: mlp http://localhost:3000");
  process.exit(target ? 0 : 1);
}

try {
  new URL(target);
} catch {
  console.error(`Invalid URL: ${target}`);
  process.exit(1);
}

if (!Number.isInteger(port) || port <= 0) {
  console.error(`Invalid port: ${portArg}`);
  process.exit(1);
}

startProxyServer({ target, port });

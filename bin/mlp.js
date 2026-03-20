#!/usr/bin/env node
import net from "node:net";
import { startProxyServer } from "../src/server.js";

const DEVICE_PRESETS = {
  "iphone se": { name: "iPhone SE", width: 375, height: 667 },
  "iphone 14": { name: "iPhone 14", width: 390, height: 844 },
  "iphone 14 pro max": { name: "iPhone 14 Pro Max", width: 430, height: 932 },
  "pixel 7": { name: "Pixel 7", width: 412, height: 915 },
  "pixel 8 pro": { name: "Pixel 8 Pro", width: 448, height: 998 },
  "galaxy s23": { name: "Galaxy S23", width: 393, height: 852 },
  "galaxy z fold 5": { name: "Galaxy Z Fold 5", width: 636, height: 904 }
};

async function isPortAvailable(port) {
  return await new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "127.0.0.1");
  });
}

async function resolvePort(preferredPort) {
  if (!Number.isInteger(preferredPort) || preferredPort <= 0) {
    throw new Error(`Invalid port: ${preferredPort}`);
  }

  const maxOffset = 100;
  for (let offset = 0; offset <= maxOffset; offset += 1) {
    const candidate = preferredPort + offset;
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }

  throw new Error(`No available port found in range ${preferredPort}-${preferredPort + maxOffset}`);
}

async function main() {
  const args = process.argv.slice(2);
  const hasHelpArg = args.includes("-h") || args.includes("--help");

  let targetArg;
  let portArg;
  let deviceArg;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (value === "--device") {
      const deviceTokens = [];
      let cursor = index + 1;

      while (cursor < args.length && !args[cursor].startsWith("-")) {
        deviceTokens.push(args[cursor]);
        cursor += 1;
      }

      if (deviceTokens.length === 0) {
        console.error("Missing value for --device");
        process.exit(1);
      }

      deviceArg = deviceTokens.join(" ");
      index = cursor - 1;
      continue;
    }

    if ((value === "--port" || value === "-p") && args[index + 1]) {
      portArg = args[index + 1];
      index += 1;
      continue;
    }

    if (!value.startsWith("-") && !targetArg) {
      targetArg = value;
      continue;
    }

    if (!value.startsWith("-") && !portArg) {
      portArg = value;
      continue;
    }
  }

  if (hasHelpArg) {
    console.log("Usage: mlp [target-url] [port] [--device <preset>] [--port <port>]");
    console.log("Example: mlp http://localhost:3000 --device \"Pixel 8 Pro\"");
    console.log("Default target URL: http://localhost:3000 (or POCKETVIEW_TARGET)");
    console.log("Device presets: iPhone SE, iPhone 14, iPhone 14 Pro Max, Pixel 7, Pixel 8 Pro, Galaxy S23, Galaxy Z Fold 5");
    process.exit(0);
  }

  const target = targetArg || process.env.POCKETVIEW_TARGET || "http://localhost:3000";
  const preferredPortRaw = portArg || process.env.PORT || "5050";
  const preferredPort = Number(preferredPortRaw);
  const selectedDevice = deviceArg ? DEVICE_PRESETS[String(deviceArg).toLowerCase()] : DEVICE_PRESETS["iphone se"];

  if (!selectedDevice) {
    console.error(`Invalid device preset: ${deviceArg}`);
    console.error("Supported presets: iPhone SE, iPhone 14, iPhone 14 Pro Max, Pixel 7, Pixel 8 Pro, Galaxy S23, Galaxy Z Fold 5");
    process.exit(1);
  }

  try {
    new URL(target);
  } catch {
    console.error(`Invalid URL: ${target}`);
    process.exit(1);
  }

  let port;
  try {
    port = await resolvePort(preferredPort);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  if (port !== preferredPort) {
    console.log(`Preferred port ${preferredPort} is busy; using ${port}`);
  }

  startProxyServer({
    target,
    port,
    device: selectedDevice
  });
}

void main();

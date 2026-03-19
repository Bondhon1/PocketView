#!/usr/bin/env node
import { startProxyServer } from "../src/server.js";

const DEVICE_PRESETS = {
  "iphone se": { name: "iPhone SE", width: 375, height: 667 },
  "iphone 14": { name: "iPhone 14", width: 390, height: 844 },
  "pixel 7": { name: "Pixel 7", width: 412, height: 915 }
};

const args = process.argv.slice(2);
const hasHelpArg = args.includes("-h") || args.includes("--help");

let target;
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

  if (!value.startsWith("-") && !target) {
    target = value;
    continue;
  }

  if (!value.startsWith("-") && !portArg) {
    portArg = value;
    continue;
  }
}

const port = portArg ? Number(portArg) : Number(process.env.PORT ?? 5050);
const selectedDevice = deviceArg ? DEVICE_PRESETS[String(deviceArg).toLowerCase()] : DEVICE_PRESETS["iphone se"];

if (!target || hasHelpArg) {
  console.log("Usage: mlp <target-url> [port] [--device <preset>]");
  console.log("Example: mlp http://localhost:3000 5050 --device \"iPhone 14\"");
  console.log("Device presets: iPhone SE, iPhone 14, Pixel 7");
  process.exit(target ? 0 : 1);
}

if (!selectedDevice) {
  console.error(`Invalid device preset: ${deviceArg}`);
  console.error("Supported presets: iPhone SE, iPhone 14, Pixel 7");
  process.exit(1);
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

startProxyServer({
  target,
  port,
  device: selectedDevice
});

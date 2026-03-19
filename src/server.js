import express from "express";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createProxyMiddleware, responseInterceptor } from "http-proxy-middleware";
import { WebSocket, WebSocketServer } from "ws";

const injectedSnippet = `<script>(function(){var run=function(){try{var scheme=location.protocol==='https:'?'wss':'ws';var socket=new WebSocket(scheme+'://'+location.host+'/__pocketview_ws');socket.addEventListener('error',function(){});}catch(e){}};if('requestIdleCallback'in window){requestIdleCallback(run,{timeout:1000});}else{setTimeout(run,0);}})();</script>`;

function injectBeforeBodyEnd(html) {
  if (html.includes("/__pocketview_ws")) {
    return html;
  }

  if (html.includes("</body>")) {
    return html.replace("</body>", `${injectedSnippet}</body>`);
  }

  return `${html}${injectedSnippet}`;
}

function detectClientType(userAgent = "") {
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent) ? "mobile-preview" : "desktop";
}

export function startProxyServer({ target, port }) {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({
    server,
    path: "/__pocketview_ws"
  });
  const connectedClients = new Map();

  wss.on("connection", (socket, request) => {
    const id = randomUUID();
    const clientType = detectClientType(String(request.headers["user-agent"] || ""));
    connectedClients.set(socket, {
      id,
      type: clientType
    });

    socket.on("message", (message, isBinary) => {
      for (const client of connectedClients.keys()) {
        if (client === socket || client.readyState !== WebSocket.OPEN) {
          continue;
        }

        client.send(message, { binary: isBinary });
      }
    });

    socket.on("close", () => {
      connectedClients.delete(socket);
    });
  });

  app.use(
    "/",
    createProxyMiddleware({
      target,
      changeOrigin: true,
      ws: true,
      xfwd: true,
      cookieDomainRewrite: "",
      cookiePathRewrite: "/",
      selfHandleResponse: true,
      onProxyRes: responseInterceptor(async (responseBuffer, proxyRes) => {
        const contentType = String(proxyRes.headers["content-type"] || "").toLowerCase();
        if (!contentType.includes("text/html")) {
          return responseBuffer;
        }

        const html = responseBuffer.toString("utf8");
        return injectBeforeBodyEnd(html);
      })
    })
  );

  server.listen(port, () => {
    console.log(`Proxy server running on http://localhost:${port}`);
    console.log(`Forwarding to ${target}`);
  });
}

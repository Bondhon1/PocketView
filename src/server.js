import express from "express";
import { createProxyMiddleware, responseInterceptor } from "http-proxy-middleware";

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

export function startProxyServer({ target, port }) {
  const app = express();

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

  app.listen(port, () => {
    console.log(`Proxy server running on http://localhost:${port}`);
    console.log(`Forwarding to ${target}`);
  });
}

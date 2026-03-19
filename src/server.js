import express from "express";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createProxyMiddleware } from "http-proxy-middleware";
import open from "open";
import { WebSocket, WebSocketServer } from "ws";

const injectedSnippet = `<script>(function(){
  var WS_PATH='__pocketview_ws';
  var MOBILE_WIDTH=375;
  var isApplyingRemoteEvent=false;
  var socket=null;
  var isOpen=false;
  var isShuttingDown=false;
  var listenersBound=false;
  var pendingScrollFrame=0;
  var lastSentScrollX=-1;
  var lastSentScrollY=-1;
  var reconnectTimer=0;
  var reconnectAttempt=0;
  var initialBackoffMs=200;
  var maxBackoffMs=3000;

  function getMobileWidth(){
    try{
      var value=Number(new URLSearchParams(window.location.search).get('mw'));
      if(Number.isFinite(value)&&value>=240&&value<=1024){
        return Math.round(value);
      }
    }catch(_e){}
    return MOBILE_WIDTH;
  }

  function isMobileMode(){
    try{
      return new URLSearchParams(window.location.search).get('mode')==='mobile';
    }catch(_e){
      return false;
    }
  }

  function ensureViewportTag(){
    var viewport=document.querySelector('meta[name="viewport"]');
    var width=getMobileWidth();
    if(!viewport){
      viewport=document.createElement('meta');
      viewport.setAttribute('name','viewport');
      document.head.appendChild(viewport);
    }
    viewport.setAttribute('content','width='+width+',initial-scale=1,maximum-scale=1,viewport-fit=cover');
  }

  function applyMobileModeLayout(){
    if(!isMobileMode()){return;}
    var width=getMobileWidth();
    if(document.documentElement){
      document.documentElement.style.background='#111';
    }
    if(document.body){
      document.body.style.width=width+'px';
      document.body.style.maxWidth=width+'px';
      document.body.style.minWidth=width+'px';
      document.body.style.margin='0 auto';
      document.body.style.position='relative';
      document.body.style.background=document.body.style.background||'#fff';
    }

    if(!document.getElementById('pocketview-mobile-frame')){
      var frame=document.createElement('div');
      frame.id='pocketview-mobile-frame';
      frame.setAttribute('aria-hidden','true');
      frame.style.position='fixed';
      frame.style.top='8px';
      frame.style.bottom='8px';
      frame.style.left='50%';
      frame.style.transform='translateX(-50%)';
      frame.style.width=(width+12)+'px';
      frame.style.border='6px solid #1f1f1f';
      frame.style.borderRadius='26px';
      frame.style.boxShadow='0 12px 34px rgba(0,0,0,0.35)';
      frame.style.pointerEvents='none';
      frame.style.zIndex='2147483647';
      document.body.appendChild(frame);
    }
  }

  function safeSend(event){
    if(!isOpen||!socket||socket.readyState!==WebSocket.OPEN||isApplyingRemoteEvent){return;}
    try{socket.send(JSON.stringify(event));}catch(_e){}
  }

  function handleRemoteMessage(raw){
    var event;
    try{event=JSON.parse(String(raw||''));}catch(_e){return;}
    if(!event||typeof event!=='object'||typeof event.type!=='string'){return;}

    isApplyingRemoteEvent=true;
    try{
      if(event.type==='scroll'){
        var x=Number(event.x);
        var y=Number(event.y);
        if(Number.isFinite(x)&&Number.isFinite(y)){
          window.scrollTo(x,y);
          lastSentScrollX=x;
          lastSentScrollY=y;
        }
      }else if(event.type==='click'){
        var cx=Number(event.x);
        var cy=Number(event.y);
        if(Number.isFinite(cx)&&Number.isFinite(cy)){
          var target=document.elementFromPoint(cx,cy);
          if(target){
            var clickEvt=new MouseEvent('click',{
              bubbles:true,
              cancelable:true,
              composed:true,
              clientX:cx,
              clientY:cy,
              view:window
            });
            target.dispatchEvent(clickEvt);
          }
        }
      }
    }finally{
      isApplyingRemoteEvent=false;
    }
  }

  function scheduleScrollSend(){
    if(isApplyingRemoteEvent||pendingScrollFrame){return;}
    pendingScrollFrame=requestAnimationFrame(function(){
      pendingScrollFrame=0;
      var x=Math.round(window.scrollX||window.pageXOffset||0);
      var y=Math.round(window.scrollY||window.pageYOffset||0);
      if(x===lastSentScrollX&&y===lastSentScrollY){return;}
      lastSentScrollX=x;
      lastSentScrollY=y;
      safeSend({type:'scroll',x:x,y:y});
    });
  }

  function onClick(e){
    if(isApplyingRemoteEvent){return;}
    safeSend({type:'click',x:Math.round(e.clientX),y:Math.round(e.clientY)});
  }

  function bindInputListeners(){
    if(listenersBound){return;}
    listenersBound=true;
    window.addEventListener('scroll',scheduleScrollSend,{passive:true});
    document.addEventListener('click',onClick,true);
    window.addEventListener('beforeunload',function(){
      isShuttingDown=true;
      if(reconnectTimer){clearTimeout(reconnectTimer);reconnectTimer=0;}
      try{if(socket){socket.close();}}catch(_e){}
    });
  }

  function scheduleReconnect(){
    if(isShuttingDown||reconnectTimer){return;}
    var exp=Math.min(reconnectAttempt,8);
    var baseDelay=Math.min(maxBackoffMs,initialBackoffMs*Math.pow(2,exp));
    var jitter=Math.floor(baseDelay*0.15*Math.random());
    var delay=baseDelay+jitter;
    reconnectAttempt+=1;
    reconnectTimer=setTimeout(function(){
      reconnectTimer=0;
      connect();
    },delay);
  }

  function connect(){
    if(isShuttingDown){return;}
    bindInputListeners();

    try{
      var scheme=location.protocol==='https:'?'wss':'ws';
      socket=new WebSocket(scheme+'://'+location.host+'/'+WS_PATH);
    }catch(_e){
      scheduleReconnect();
      return;
    }

    socket.addEventListener('open',function(){
      isOpen=true;
      reconnectAttempt=0;
      if(reconnectTimer){clearTimeout(reconnectTimer);reconnectTimer=0;}
    });
    socket.addEventListener('close',function(){
      isOpen=false;
      scheduleReconnect();
    });
    socket.addEventListener('error',function(){
      isOpen=false;
      try{if(socket&&socket.readyState===WebSocket.OPEN){socket.close();}}catch(_e){}
    });
    socket.addEventListener('message',function(ev){handleRemoteMessage(ev.data);});
  }

  if(isMobileMode()){
    if(document.readyState==='loading'){
      document.addEventListener('DOMContentLoaded',function(){
        ensureViewportTag();
        applyMobileModeLayout();
      },{once:true});
    }else{
      ensureViewportTag();
      applyMobileModeLayout();
    }
  }

  if('requestIdleCallback'in window){requestIdleCallback(connect,{timeout:1000});}
  else{setTimeout(connect,0);}
})();</script>`;

function injectBeforeBodyEnd(html) {
  if (html.includes("/__pocketview_ws")) {
    return html;
  }

  if (html.includes("</body>")) {
    return html.replace("</body>", `${injectedSnippet}</body>`);
  }

  return `${html}${injectedSnippet}`;
}

function shouldInjectHtml(proxyRes, req) {
  const contentType = String(proxyRes.headers["content-type"] || "").toLowerCase();
  if (!contentType.includes("text/html")) {
    return false;
  }

  const urlPath = String(req?.url || "").toLowerCase();
  if (urlPath.includes("/_next/") || urlPath.includes("webpack-hmr")) {
    return false;
  }

  return true;
}

function writeProxyHeaders(res, proxyRes, { stripLength = false } = {}) {
  const headers = { ...proxyRes.headers };
  if (stripLength) {
    delete headers["content-length"];
    delete headers["Content-Length"];
  }
  delete headers["content-encoding"];
  delete headers["Content-Encoding"];

  res.writeHead(proxyRes.statusCode || 200, headers);
}

function streamInjectedHtml(proxyRes, req, res) {
  let hasInjected = false;

  proxyRes.on("data", (chunk) => {
    let contentChunk = chunk.toString("utf8");

    if (!hasInjected && !contentChunk.includes("/__pocketview_ws")) {
      if (contentChunk.includes("</body>")) {
        contentChunk = contentChunk.replace("</body>", `${injectedSnippet}</body>`);
        hasInjected = true;
      } else if (contentChunk.includes("<head>")) {
        contentChunk = contentChunk.replace("<head>", `<head>${injectedSnippet}`);
        hasInjected = true;
      }
    }

    res.write(contentChunk);
  });

  proxyRes.on("end", () => {
    if (!hasInjected) {
      res.write(injectedSnippet);
    }
    res.end();
  });

  proxyRes.on("error", () => {
    if (!res.headersSent) {
      res.statusCode = 502;
    }
    res.end();
  });
}

function detectClientType(userAgent = "") {
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent) ? "mobile-preview" : "desktop";
}

function withModeQuery(url, mode) {
  const parsed = new URL(url);
  parsed.searchParams.set("mode", mode);
  return parsed.toString();
}

function withMobileParams(url, device) {
  const parsed = new URL(url);
  parsed.searchParams.set("mw", String(device.width));
  parsed.searchParams.set("mh", String(device.height));
  parsed.searchParams.set("device", device.name);
  return parsed.toString();
}

async function openMobileWindow(url, device) {
  const mobileArgs = ["--new-window", `--window-size=${device.width},${device.height}`];
  const preferredApps = ["msedge", "chrome", "google chrome"];

  for (const appName of preferredApps) {
    try {
      await open(url, {
        wait: false,
        app: {
          name: appName,
          arguments: mobileArgs
        }
      });
      return;
    } catch {
      // try next browser
    }
  }

  await open(url, { wait: false });
}

async function openSyncedViews(baseUrl, device) {
  const desktopUrl = withModeQuery(baseUrl, "desktop");
  const mobileUrl = withMobileParams(withModeQuery(baseUrl, "mobile"), device);

  try {
    await open(desktopUrl, {
      wait: false,
      newInstance: true
    });
  } catch {
    // ignore launch failures
  }

  try {
    await openMobileWindow(mobileUrl, device);
  } catch {
    // ignore launch failures
  }
}

export function startProxyServer({ target, port, device = { name: "iPhone SE", width: 375, height: 667 } }) {
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
      on: {
        proxyReq: (proxyReq) => {
          proxyReq.setHeader("accept-encoding", "identity");
        },
        proxyRes: (proxyRes, req, res) => {
          if (!shouldInjectHtml(proxyRes, req)) {
            writeProxyHeaders(res, proxyRes);
            proxyRes.pipe(res);
            return;
          }

          writeProxyHeaders(res, proxyRes, { stripLength: true });
          streamInjectedHtml(proxyRes, req, res);
        }
      }
    })
  );

  server.listen(port, () => {
    const proxyUrl = `http://localhost:${port}`;
    console.log(`Proxy server running on ${proxyUrl}`);
    console.log(`Forwarding to ${target}`);
    console.log(`Device preset: ${device.name} (${device.width}x${device.height})`);
    void openSyncedViews(proxyUrl, device);
  });
}

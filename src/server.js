import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import open from "open";

const injectedSnippet = `<script>(function(){
  var POCKETVIEW_ENABLED='pv';
  var POCKETVIEW_MODE='pv_mode';
  var POCKETVIEW_SYNC_NS='pocketview-sync';
  var MOBILE_WIDTH=375;
  var MOBILE_HEIGHT=667;
  var pendingScrollFrame=0;
  var applyingRemoteScroll=false;
  var applyingRemoteClick=false;
  var suppressNextRouteSend=false;
  var previewMountAttempts=0;
  var previewMountTimer=0;

  function getMobileWidth(){
    try{
      var value=Number(new URLSearchParams(window.location.search).get('mw'));
      if(Number.isFinite(value)&&value>=240&&value<=1024){
        return Math.round(value);
      }
    }catch(_e){}
    return MOBILE_WIDTH;
  }

  function getMobileHeight(){
    try{
      var value=Number(new URLSearchParams(window.location.search).get('mh'));
      if(Number.isFinite(value)&&value>=320&&value<=2048){
        return Math.round(value);
      }
    }catch(_e){}
    return MOBILE_HEIGHT;
  }

  function isMobileMode(){
    try{
      var params=new URLSearchParams(window.location.search);
      return params.get(POCKETVIEW_MODE)==='mobile'||params.get('mode')==='mobile';
    }catch(_e){
      return false;
    }
  }

  function isDevtoolEnabled(){
    try{
      var value=new URLSearchParams(window.location.search).get(POCKETVIEW_ENABLED);
      if(value==='0'||value==='false'||value==='off'){
        return false;
      }
      return true;
    }catch(_e){
      return true;
    }
  }

  function ensureDevtoolParams(rawUrl){
    try{
      var parsed=new URL(rawUrl,window.location.href);
      parsed.searchParams.set(POCKETVIEW_ENABLED,'1');
      parsed.searchParams.set('mw',String(getMobileWidth()));
      parsed.searchParams.set('mh',String(getMobileHeight()));
      return parsed.toString();
    }catch(_e){
      return String(rawUrl||window.location.href);
    }
  }

  function getPeerWindow(){
    if(isMobileMode()&&window.parent&&window.parent!==window){
      return window.parent;
    }
    var frame=window.__pocketviewMobileFrame;
    if(frame&&frame.contentWindow){
      return frame.contentWindow;
    }
    return null;
  }

  function postSync(type,payload){
    var peer=getPeerWindow();
    if(!peer){return;}
    try{
      peer.postMessage({
        ns:POCKETVIEW_SYNC_NS,
        type:type,
        payload:payload||{},
        source:isMobileMode()?'mobile':'desktop'
      },window.location.origin);
    }catch(_e){}
  }

  function toDesktopUrl(rawUrl){
    try{
      var parsed=new URL(rawUrl,window.location.href);
      parsed.searchParams.delete(POCKETVIEW_MODE);
      return ensureDevtoolParams(parsed.toString());
    }catch(_e){
      return String(rawUrl||window.location.href);
    }
  }

  function toMobileUrl(rawUrl){
    try{
      var parsed=new URL(rawUrl,window.location.href);
      parsed.searchParams.set(POCKETVIEW_ENABLED,'1');
      parsed.searchParams.set(POCKETVIEW_MODE,'mobile');
      parsed.searchParams.set('mw',String(getMobileWidth()));
      parsed.searchParams.set('mh',String(getMobileHeight()));
      return parsed.toString();
    }catch(_e){
      return String(rawUrl||window.location.href);
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
      document.body.style.minHeight='100vh';
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
      frame.style.height=(getMobileHeight()+12)+'px';
      frame.style.border='6px solid #1f1f1f';
      frame.style.borderRadius='26px';
      frame.style.boxShadow='0 12px 34px rgba(0,0,0,0.35)';
      frame.style.pointerEvents='none';
      frame.style.zIndex='2147483647';
      document.body.appendChild(frame);
    }
  }

  function applyRemoteScroll(payload){
    var x=Number(payload.x);
    var y=Number(payload.y);
    if(!Number.isFinite(x)||!Number.isFinite(y)){
      x=Math.round((Number(payload.xRatio)||0)*(window.innerWidth||1));
      y=Math.round((Number(payload.yRatio)||0)*(window.innerHeight||1));
    }
    applyingRemoteScroll=true;
    window.scrollTo(x,y);
    setTimeout(function(){applyingRemoteScroll=false;},30);
  }

  function applyRemoteClick(payload){
    if(!payload){return;}
    var xRatio=Number(payload.xRatio);
    var yRatio=Number(payload.yRatio);
    var x=Number(payload.x);
    var y=Number(payload.y);
    var localX=Number.isFinite(xRatio)?Math.round(xRatio*(window.innerWidth||1)):x;
    var localY=Number.isFinite(yRatio)?Math.round(yRatio*(window.innerHeight||1)):y;
    if(!Number.isFinite(localX)){localX=0;}
    if(!Number.isFinite(localY)){localY=0;}

    var target=null;
    if(payload.selector){
      try{
        target=document.querySelector(String(payload.selector));
      }catch(_e){}
    }
    if(!target&&payload.text&&payload.tag){
      var candidates=document.getElementsByTagName(String(payload.tag).toLowerCase());
      var desiredText=String(payload.text).trim();
      for(var index=0;index<candidates.length;index+=1){
        var candidateText=String(candidates[index].textContent||'').trim();
        if(candidateText&&candidateText===desiredText){
          target=candidates[index];
          break;
        }
      }
    }
    if(!target){
      target=document.elementFromPoint(localX,localY);
    }
    if(!target){return;}
    applyingRemoteClick=true;
    try{
      if(typeof target.click==='function'){
        target.click();
      }
      var clickEvt=new MouseEvent('click',{
        bubbles:true,
        cancelable:true,
        composed:true,
        clientX:localX,
        clientY:localY,
        view:window
      });
      target.dispatchEvent(clickEvt);
    }finally{
      setTimeout(function(){applyingRemoteClick=false;},30);
    }
  }

  function cssEscape(value){
    var text=String(value||'');
    if(typeof CSS!=='undefined'&&typeof CSS.escape==='function'){
      return CSS.escape(text);
    }
    var specials="\\\"' .#:[](),>+~*^$|=/";
    var output='';
    for(var index=0;index<text.length;index+=1){
      var ch=text.charAt(index);
      output+=specials.indexOf(ch)>=0?'\\\\'+ch:ch;
    }
    return output;
  }

  function elementForSyncFromTarget(target){
    var node=target&&target.nodeType===1?target:(target&&target.parentElement?target.parentElement:null);
    if(!node||!node.closest){
      return null;
    }
    return node.closest('button,a,[role="button"],input[type="button"],input[type="submit"],[data-testid],[aria-label]')||node;
  }

  function selectorForSync(el){
    if(!el||el.nodeType!==1){return '';}
    if(el.id){return '#'+cssEscape(el.id);}

    var testId=el.getAttribute('data-testid');
    if(testId){
      return '[data-testid="'+cssEscape(testId)+'"]';
    }

    var ariaLabel=el.getAttribute('aria-label');
    if(ariaLabel){
      return el.tagName.toLowerCase()+'[aria-label="'+cssEscape(ariaLabel)+'"]';
    }

    var segments=[];
    var cursor=el;
    var depth=0;
    while(cursor&&cursor.nodeType===1&&cursor!==document.body&&depth<4){
      var part=cursor.tagName.toLowerCase();
      var parent=cursor.parentElement;
      if(parent){
        var siblings=parent.children;
        var position=1;
        for(var i=0;i<siblings.length;i+=1){
          if(siblings[i]===cursor){
            position=i+1;
            break;
          }
        }
        part=part+':nth-child('+position+')';
      }
      segments.unshift(part);
      cursor=cursor.parentElement;
      depth+=1;
    }
    return segments.join(' > ');
  }

  function onSyncMessage(event){
    if(!event||event.origin!==window.location.origin){return;}
    var data=event.data;
    if(!data||data.ns!==POCKETVIEW_SYNC_NS||typeof data.type!=='string'){return;}

    if(data.type==='scroll'){
      applyRemoteScroll(data.payload||{});
      return;
    }

    if(data.type==='click'){
      applyRemoteClick(data.payload||{});
      return;
    }

    if(data.type==='route'){
      var nextHref=String((data.payload&&data.payload.href)||'');
      if(!nextHref){return;}
      var expectedHref=isMobileMode()?toMobileUrl(nextHref):toDesktopUrl(nextHref);
      if(expectedHref!==window.location.href){
        suppressNextRouteSend=true;
        window.location.replace(expectedHref);
      }
    }
  }

  function emitScrollSync(){
    if(applyingRemoteScroll||pendingScrollFrame){return;}
    pendingScrollFrame=requestAnimationFrame(function(){
      pendingScrollFrame=0;
      var x=Math.round(window.scrollX||window.pageXOffset||0);
      var y=Math.round(window.scrollY||window.pageYOffset||0);
      postSync('scroll',{
        x:x,
        y:y,
        xRatio:(window.innerWidth?x/window.innerWidth:0),
        yRatio:(window.innerHeight?y/window.innerHeight:0)
      });
    });
  }

  function emitClickSync(e){
    if(applyingRemoteClick){return;}
    var syncTarget=elementForSyncFromTarget(e.target);
    postSync('click',{
      x:Math.round(e.clientX||0),
      y:Math.round(e.clientY||0),
      xRatio:(window.innerWidth?(Number(e.clientX)||0)/window.innerWidth:0),
      yRatio:(window.innerHeight?(Number(e.clientY)||0)/window.innerHeight:0),
      selector:selectorForSync(syncTarget),
      tag:syncTarget?syncTarget.tagName.toLowerCase():'',
      text:syncTarget?String(syncTarget.textContent||'').trim().slice(0,120):''
    });
  }

  function emitRouteSync(){
    if(suppressNextRouteSend){
      suppressNextRouteSend=false;
      return;
    }
    postSync('route',{
      href:isMobileMode()?toDesktopUrl(window.location.href):window.location.href
    });
  }

  function patchHistoryForRouteSync(){
    var originalPushState=history.pushState;
    var originalReplaceState=history.replaceState;

    history.pushState=function(){
      if(!isMobileMode()&&isDevtoolEnabled()&&arguments.length>2&&arguments[2]){
        arguments[2]=ensureDevtoolParams(arguments[2]);
      }
      originalPushState.apply(history,arguments);
      emitRouteSync();
    };

    history.replaceState=function(){
      if(!isMobileMode()&&isDevtoolEnabled()&&arguments.length>2&&arguments[2]){
        arguments[2]=ensureDevtoolParams(arguments[2]);
      }
      originalReplaceState.apply(history,arguments);
      emitRouteSync();
    };
  }

  function preserveDevtoolQueryOnDesktop(){
    if(isMobileMode()||!isDevtoolEnabled()){
      return;
    }

    var expected=ensureDevtoolParams(window.location.href);
    if(expected!==window.location.href){
      suppressNextRouteSend=true;
      window.history.replaceState(window.history.state,'',expected);
    }
  }

  function bindSyncListeners(){
    if(window.__pocketviewSyncBound){return;}
    window.__pocketviewSyncBound=true;
    window.addEventListener('message',onSyncMessage);
    window.addEventListener('scroll',emitScrollSync,{passive:true});
    document.addEventListener('click',emitClickSync,true);
    window.addEventListener('popstate',emitRouteSync);
    window.addEventListener('hashchange',emitRouteSync);
    patchHistoryForRouteSync();
  }

  function enableDrag(root,handle){
    var dragging=false;
    var offsetX=0;
    var offsetY=0;

    function onMove(ev){
      if(!dragging){return;}
      var nextX=Math.round(ev.clientX-offsetX);
      var nextY=Math.round(ev.clientY-offsetY);
      var maxX=(window.innerWidth||0)-root.offsetWidth;
      var maxY=(window.innerHeight||0)-root.offsetHeight;
      var minX=Math.min(8,maxX);
      var minY=Math.min(0,maxY);
      var clampedX=Math.max(minX,Math.min(nextX,maxX));
      var clampedY=Math.max(minY,Math.min(nextY,Math.max(0,maxY)));
      root.style.left=clampedX+'px';
      root.style.top=clampedY+'px';
      root.style.right='auto';
    }

    function stopDrag(){
      dragging=false;
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',stopDrag);
      document.body.style.userSelect='';
    }

    handle.addEventListener('mousedown',function(ev){
      if(ev.button!==0){return;}
      var rect=root.getBoundingClientRect();
      dragging=true;
      offsetX=ev.clientX-rect.left;
      offsetY=ev.clientY-rect.top;
      root.style.left=rect.left+'px';
      root.style.top=rect.top+'px';
      root.style.right='auto';
      document.body.style.userSelect='none';
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',stopDrag);
      ev.preventDefault();
    });
  }

  function mountDevtoolPreview(){
    if(!isDevtoolEnabled()||isMobileMode()){return;}
    if(document.getElementById('pocketview-devtool-root')){return;}
    if(!document.body){return;}

    var width=getMobileWidth();
    var height=getMobileHeight();
    var frameMargin=12;
    var maxVisibleFrameHeight=Math.max(320,(window.innerHeight||0)-60);
    var frameHeight=Math.min(height,maxVisibleFrameHeight);

    var root=document.createElement('div');
    root.id='pocketview-devtool-root';
    root.style.position='fixed';
    root.style.top='16px';
    root.style.right='16px';
    root.style.width=(width+22)+'px';
    root.style.height=(frameHeight+frameMargin+34)+'px';
    root.style.maxHeight='calc(100vh - 16px)';
    root.style.background='#111';
    root.style.border='1px solid rgba(255,255,255,0.15)';
    root.style.borderRadius='14px';
    root.style.boxShadow='0 14px 32px rgba(0,0,0,0.35)';
    root.style.zIndex='2147483646';
    root.style.overflow='hidden';

    var header=document.createElement('div');
    header.style.display='flex';
    header.style.alignItems='center';
    header.style.justifyContent='space-between';
    header.style.padding='8px 10px';
    header.style.font='600 12px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif';
    header.style.color='#f3f3f3';
    header.style.background='rgba(255,255,255,0.06)';
    header.style.cursor='move';
    header.textContent='PocketView';

    var closeBtn=document.createElement('button');
    closeBtn.type='button';
    closeBtn.textContent='×';
    closeBtn.style.border='0';
    closeBtn.style.background='transparent';
    closeBtn.style.color='#f3f3f3';
    closeBtn.style.font='700 18px/1 sans-serif';
    closeBtn.style.cursor='pointer';
    closeBtn.setAttribute('aria-label','Close mobile preview');
    closeBtn.addEventListener('click',function(ev){
      ev.stopPropagation();
      if(root&&root.parentNode){root.parentNode.removeChild(root);}
    });
    header.appendChild(closeBtn);

    var frame=document.createElement('iframe');
    frame.setAttribute('title','PocketView mobile preview');
    frame.style.width=width+'px';
    frame.style.height=frameHeight+'px';
    frame.style.border='0';
    frame.style.display='block';
    frame.style.margin='8px auto';
    frame.style.borderRadius='20px';
    frame.style.background='#fff';

    try{
      frame.src=toMobileUrl(window.location.href);
    }catch(_e){}

    frame.addEventListener('load',function(){
      window.__pocketviewMobileFrame=frame;
      emitRouteSync();
      emitScrollSync();
    });

    root.appendChild(header);
    root.appendChild(frame);
    document.body.appendChild(root);

    enableDrag(root,header);
  }

  function scheduleMountDevtoolPreview(){
    if(isMobileMode()||!isDevtoolEnabled()){return;}
    if(document.getElementById('pocketview-devtool-root')){return;}

    mountDevtoolPreview();
    if(document.getElementById('pocketview-devtool-root')){return;}

    if(previewMountAttempts>=40){return;}
    previewMountAttempts+=1;
    if(previewMountTimer){
      clearTimeout(previewMountTimer);
      previewMountTimer=0;
    }
    previewMountTimer=setTimeout(scheduleMountDevtoolPreview,75);
  }

  bindSyncListeners();
  preserveDevtoolQueryOnDesktop();

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

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',scheduleMountDevtoolPreview,{once:true});
  }
  if('requestIdleCallback'in window){requestIdleCallback(scheduleMountDevtoolPreview,{timeout:1000});}
  else{setTimeout(scheduleMountDevtoolPreview,0);}
})();</script>`;

function injectBeforeBodyEnd(html) {
  if (html.includes("pocketview-devtool-root")) {
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

    if (!hasInjected && !contentChunk.includes("pocketview-devtool-root")) {
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

function withDevtoolQuery(url, device) {
  const parsed = new URL(url);
  parsed.searchParams.set("pv", "1");
  parsed.searchParams.set("mw", String(device.width));
  parsed.searchParams.set("mh", String(device.height));
  parsed.searchParams.set("device", device.name);
  return parsed.toString();
}

async function openDevtoolView(baseUrl, device) {
  const devtoolUrl = withDevtoolQuery(baseUrl, device);
  try {
    await open(devtoolUrl, {
      wait: false,
      newInstance: true
    });
  } catch {
    // ignore launch failures
  }
}

export function startProxyServer({ target, port, device = { name: "iPhone SE", width: 375, height: 667 } }) {
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

  const server = app.listen(port, () => {
    const proxyUrl = `http://localhost:${port}`;
    console.log(`Proxy server running on ${proxyUrl}`);
    console.log(`Forwarding to ${target}`);
    console.log(`PocketView URL: ${withDevtoolQuery(proxyUrl, device)}`);
    console.log(`Device preset: ${device.name} (${device.width}x${device.height})`);
    void openDevtoolView(proxyUrl, device);
  });

  return server;
}

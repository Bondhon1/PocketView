import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import open from "open";

const injectedSnippet = `<script>(function(){
  var POCKETVIEW_ENABLED='pv';
  var POCKETVIEW_MODE='pv_mode';
  var POCKETVIEW_SYNC_NS='pocketview-sync';
  var MOBILE_WIDTH=375;
  var MOBILE_HEIGHT=667;
  var DEVICE_PRESETS=[
    {name:'iPhone SE',type:'iOS',width:375,height:667},
    {name:'iPhone 14',type:'iOS',width:390,height:844},
    {name:'iPhone 14 Pro Max',type:'iOS',width:430,height:932},
    {name:'Pixel 7',type:'Android',width:412,height:915},
    {name:'Pixel 8 Pro',type:'Android',width:448,height:998},
    {name:'Galaxy S23',type:'Android',width:393,height:852},
    {name:'Galaxy Z Fold 5',type:'Android',width:636,height:904}
  ];
  var pendingScrollFrame=0;
  var applyingRemoteScroll=false;
  var applyingRemoteClick=false;
  var suppressNextRouteSend=false;
  var previewMountAttempts=0;
  var previewMountTimer=0;
  var queuedSyncEvents=[];

  function getSearchParams(){
    try{
      return new URLSearchParams(window.location.search);
    }catch(_e){
      return new URLSearchParams('');
    }
  }

  function isMobileMode(){
    var params=getSearchParams();
    return params.get(POCKETVIEW_MODE)==='mobile'||params.get('mode')==='mobile';
  }

  function isDevtoolEnabled(){
    var value=getSearchParams().get(POCKETVIEW_ENABLED);
    if(value==='0'||value==='false'||value==='off'){
      return false;
    }
    return true;
  }

  function getMobileWidth(){
    var value=Number(getSearchParams().get('mw'));
    if(Number.isFinite(value)&&value>=240&&value<=1024){
      return Math.round(value);
    }
    return MOBILE_WIDTH;
  }

  function getMobileHeight(){
    var value=Number(getSearchParams().get('mh'));
    if(Number.isFinite(value)&&value>=320&&value<=2048){
      return Math.round(value);
    }
    return MOBILE_HEIGHT;
  }

  function findPresetByName(name){
    var normalized=String(name||'').trim().toLowerCase();
    if(!normalized){
      return null;
    }
    for(var index=0;index<DEVICE_PRESETS.length;index+=1){
      if(DEVICE_PRESETS[index].name.toLowerCase()===normalized){
        return DEVICE_PRESETS[index];
      }
    }
    return null;
  }

  function findPresetBySize(width,height){
    for(var index=0;index<DEVICE_PRESETS.length;index+=1){
      var preset=DEVICE_PRESETS[index];
      if(preset.width===width&&preset.height===height){
        return preset;
      }
    }
    return null;
  }

  function getActivePreset(){
    var params=getSearchParams();
    var byName=findPresetByName(params.get('device'));
    if(byName){
      return byName;
    }
    var bySize=findPresetBySize(getMobileWidth(),getMobileHeight());
    if(bySize){
      return bySize;
    }
    return DEVICE_PRESETS[0];
  }

  function ensureDevtoolParams(rawUrl){
    try{
      var parsed=new URL(rawUrl,window.location.href);
      var preset=getActivePreset();
      parsed.searchParams.set(POCKETVIEW_ENABLED,'1');
      parsed.searchParams.set('mw',String(preset.width));
      parsed.searchParams.set('mh',String(preset.height));
      parsed.searchParams.set('device',preset.name);
      return parsed.toString();
    }catch(_e){
      return String(rawUrl||window.location.href);
    }
  }

  function withPreset(rawUrl,preset){
    try{
      var parsed=new URL(rawUrl,window.location.href);
      parsed.searchParams.set('mw',String(preset.width));
      parsed.searchParams.set('mh',String(preset.height));
      parsed.searchParams.set('device',preset.name);
      return parsed.toString();
    }catch(_e){
      return String(rawUrl||window.location.href);
    }
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
      return ensureDevtoolParams(parsed.toString());
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

  function flushQueuedSyncEvents(){
    var peer=getPeerWindow();
    if(!peer){
      return;
    }
    while(queuedSyncEvents.length>0){
      var next=queuedSyncEvents.shift();
      try{
        peer.postMessage(next,window.location.origin);
      }catch(_e){
        queuedSyncEvents.unshift(next);
        break;
      }
    }
  }

  function postSync(type,payload){
    var data={
      ns:POCKETVIEW_SYNC_NS,
      type:type,
      payload:payload||{},
      source:isMobileMode()?'mobile':'desktop'
    };
    var peer=getPeerWindow();
    if(!peer){
      if(queuedSyncEvents.length>=30){
        queuedSyncEvents.shift();
      }
      queuedSyncEvents.push(data);
      return;
    }
    try{
      peer.postMessage(data,window.location.origin);
      flushQueuedSyncEvents();
    }catch(_e){
      if(queuedSyncEvents.length>=30){
        queuedSyncEvents.shift();
      }
      queuedSyncEvents.push(data);
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
    var height=getMobileHeight();
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
      frame.style.left='50%';
      frame.style.top='8px';
      frame.style.transform='translateX(-50%)';
      frame.style.width=(width+12)+'px';
      frame.style.height=Math.min(height+12,(window.innerHeight||height+28)-16)+'px';
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

  function broadcastCurrentState(){
    postSync('state',{
      href:isMobileMode()?toDesktopUrl(window.location.href):window.location.href,
      x:Math.round(window.scrollX||window.pageXOffset||0),
      y:Math.round(window.scrollY||window.pageYOffset||0)
    });
  }

  function onSyncMessage(event){
    if(!event||event.origin!==window.location.origin){return;}
    var data=event.data;
    if(!data||data.ns!==POCKETVIEW_SYNC_NS||typeof data.type!=='string'){return;}

    if(data.type==='hello'){
      broadcastCurrentState();
      flushQueuedSyncEvents();
      return;
    }

    if(data.type==='state'){
      var statePayload=data.payload||{};
      var nextHref=String(statePayload.href||'');
      if(nextHref){
        var expectedHref=isMobileMode()?toMobileUrl(nextHref):toDesktopUrl(nextHref);
        if(expectedHref!==window.location.href){
          suppressNextRouteSend=true;
          window.location.replace(expectedHref);
          return;
        }
      }
      applyRemoteScroll(statePayload);
      return;
    }

    if(data.type==='scroll'){
      applyRemoteScroll(data.payload||{});
      return;
    }

    if(data.type==='click'){
      applyRemoteClick(data.payload||{});
      return;
    }

    if(data.type==='route'){
      var routeHref=String((data.payload&&data.payload.href)||'');
      if(!routeHref){return;}
      var expectedRouteHref=isMobileMode()?toMobileUrl(routeHref):toDesktopUrl(routeHref);
      if(expectedRouteHref!==window.location.href){
        suppressNextRouteSend=true;
        window.location.replace(expectedRouteHref);
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

  function enableDrag(root,handle,onDragStateChange){
    var dragging=false;
    var offsetX=0;
    var offsetY=0;
    var pendingFrame=0;
    var pendingClientX=0;
    var pendingClientY=0;

    function updatePosition(clientX,clientY){
      var nextX=Math.round(clientX-offsetX);
      var nextY=Math.round(clientY-offsetY);
      var headerHeight=Math.max(32,Math.round(handle.getBoundingClientRect().height||0));
      var maxX=(window.innerWidth||0)-root.offsetWidth-8;
      var maxYByHeader=(window.innerHeight||0)-headerHeight-8;
      var minX=8;
      var minY=8;
      var clampedX=Math.max(Math.min(minX,maxX),Math.min(nextX,Math.max(minX,maxX)));
      var clampedY=Math.max(minY,Math.min(nextY,Math.max(minY,maxYByHeader)));
      root.style.left=clampedX+'px';
      root.style.top=clampedY+'px';
      root.style.right='auto';
    }

    function scheduleMove(clientX,clientY){
      pendingClientX=clientX;
      pendingClientY=clientY;
      if(pendingFrame){return;}
      pendingFrame=requestAnimationFrame(function(){
        pendingFrame=0;
        if(!dragging){return;}
        updatePosition(pendingClientX,pendingClientY);
      });
    }

    function onMove(ev){
      if(!dragging){return;}
      scheduleMove(ev.clientX,ev.clientY);
    }

    function stopDrag(){
      if(!dragging){return;}
      dragging=false;
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',stopDrag);
      window.removeEventListener('blur',stopDrag);
      if(pendingFrame){
        cancelAnimationFrame(pendingFrame);
        pendingFrame=0;
      }
      document.body.style.userSelect='';
      if(typeof onDragStateChange==='function'){
        onDragStateChange(false);
      }
    }

    handle.addEventListener('mousedown',function(ev){
      if(ev.button!==0){return;}
      var interactionTarget=ev.target;
      if(interactionTarget&&interactionTarget.closest&&interactionTarget.closest('button,select,option')){
        return;
      }
      var rect=root.getBoundingClientRect();
      dragging=true;
      offsetX=ev.clientX-rect.left;
      offsetY=ev.clientY-rect.top;
      root.style.left=rect.left+'px';
      root.style.top=rect.top+'px';
      root.style.right='auto';
      document.body.style.userSelect='none';
      if(typeof onDragStateChange==='function'){
        onDragStateChange(true);
      }
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',stopDrag);
      window.addEventListener('blur',stopDrag);
      ev.preventDefault();
    });
  }

  function mountDevtoolPreview(){
    if(!isDevtoolEnabled()||isMobileMode()){return;}
    if(document.getElementById('pocketview-devtool-root')){return;}
    if(!document.body){return;}

    var activePreset=getActivePreset();
    var width=activePreset.width;
    var height=activePreset.height;
    var minimized=false;

    var root=document.createElement('div');
    root.id='pocketview-devtool-root';
    root.style.position='fixed';
    root.style.top='16px';
    root.style.right='16px';
    root.style.width='320px';
    root.style.display='flex';
    root.style.flexDirection='column';
    root.style.boxSizing='border-box';
    root.style.background='#111';
    root.style.border='1px solid rgba(255,255,255,0.15)';
    root.style.borderRadius='14px';
    root.style.boxShadow='0 14px 32px rgba(0,0,0,0.35)';
    root.style.zIndex='2147483646';
    root.style.overflow='hidden';

    var header=document.createElement('div');
    header.style.display='flex';
    header.style.flex='0 0 auto';
    header.style.alignItems='center';
    header.style.justifyContent='space-between';
    header.style.gap='8px';
    header.style.minHeight='40px';
    header.style.boxSizing='border-box';
    header.style.position='relative';
    header.style.zIndex='2';
    header.style.padding='8px 10px';
    header.style.font='600 12px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif';
    header.style.color='#f3f3f3';
    header.style.background='rgba(255,255,255,0.06)';
    header.style.cursor='move';

    var title=document.createElement('span');
    title.textContent='PocketView';
    title.style.flex='0 0 auto';

    var controls=document.createElement('div');
    controls.style.display='flex';
    controls.style.alignItems='center';
    controls.style.gap='6px';

    var deviceSelect=document.createElement('select');
    deviceSelect.setAttribute('aria-label','Select mobile device');
    deviceSelect.style.height='24px';
    deviceSelect.style.maxWidth='170px';
    deviceSelect.style.borderRadius='6px';
    deviceSelect.style.border='1px solid rgba(255,255,255,0.22)';
    deviceSelect.style.background='rgba(0,0,0,0.35)';
    deviceSelect.style.color='#f3f3f3';
    deviceSelect.style.font='500 11px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif';
    for(var presetIndex=0;presetIndex<DEVICE_PRESETS.length;presetIndex+=1){
      var option=document.createElement('option');
      var preset=DEVICE_PRESETS[presetIndex];
      option.value=preset.name;
      option.textContent=preset.type+' · '+preset.name;
      if(preset.name===activePreset.name){
        option.selected=true;
      }
      deviceSelect.appendChild(option);
    }

    var toggleBtn=document.createElement('button');
    toggleBtn.type='button';
    toggleBtn.textContent='–';
    toggleBtn.style.width='24px';
    toggleBtn.style.height='24px';
    toggleBtn.style.border='0';
    toggleBtn.style.borderRadius='6px';
    toggleBtn.style.background='rgba(255,255,255,0.16)';
    toggleBtn.style.color='#f3f3f3';
    toggleBtn.style.font='700 15px/1 sans-serif';
    toggleBtn.style.cursor='pointer';
    toggleBtn.setAttribute('aria-label','Minimize mobile preview');

    var closeBtn=document.createElement('button');
    closeBtn.type='button';
    closeBtn.textContent='×';
    closeBtn.style.width='24px';
    closeBtn.style.height='24px';
    closeBtn.style.border='0';
    closeBtn.style.borderRadius='6px';
    closeBtn.style.background='rgba(255,255,255,0.16)';
    closeBtn.style.color='#f3f3f3';
    closeBtn.style.font='700 18px/1 sans-serif';
    closeBtn.style.cursor='pointer';
    closeBtn.setAttribute('aria-label','Close mobile preview');
    closeBtn.addEventListener('click',function(ev){
      ev.stopPropagation();
      if(resizeFrame){
        cancelAnimationFrame(resizeFrame);
        resizeFrame=0;
      }
      window.removeEventListener('resize',scheduleResize);
      if(root&&root.parentNode){root.parentNode.removeChild(root);}
    });

    controls.appendChild(deviceSelect);
    controls.appendChild(toggleBtn);
    controls.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(controls);

    var previewShell=document.createElement('div');
    previewShell.style.flex='1 1 auto';
    previewShell.style.position='relative';
    previewShell.style.boxSizing='border-box';
    previewShell.style.padding='8px 8px 10px';
    previewShell.style.overflow='hidden';

    var frameWrap=document.createElement('div');
    frameWrap.style.width=width+'px';
    frameWrap.style.height=height+'px';
    frameWrap.style.margin='0 auto';
    frameWrap.style.transformOrigin='top center';
    frameWrap.style.borderRadius='20px';
    frameWrap.style.overflow='hidden';
    frameWrap.style.background='#fff';

    var frame=document.createElement('iframe');
    frame.setAttribute('title','PocketView mobile preview');
    frame.style.width=width+'px';
    frame.style.height=height+'px';
    frame.style.border='0';
    frame.style.display='block';
    frame.style.background='#fff';

    var isDraggingPreview=false;
    var resizeFrame=0;

    function keepPanelInViewport(){
      if(!document.body.contains(root)){return;}
      var rect=root.getBoundingClientRect();
      var headerHeight=Math.max(32,Math.round(header.getBoundingClientRect().height||0));
      var minLeft=8;
      var maxLeft=(window.innerWidth||0)-root.offsetWidth-8;
      var minTop=8;
      var maxTop=(window.innerHeight||0)-headerHeight-8;

      var nextLeft=Number.parseFloat(root.style.left);
      var nextTop=Number.parseFloat(root.style.top);
      if(!Number.isFinite(nextLeft)){nextLeft=Math.round(rect.left);}
      if(!Number.isFinite(nextTop)){nextTop=Math.round(rect.top);}

      if(!Number.isFinite(nextLeft)){nextLeft=minLeft;}
      if(!Number.isFinite(nextTop)){nextTop=minTop;}

      nextLeft=Math.max(Math.min(minLeft,maxLeft),Math.min(nextLeft,Math.max(minLeft,maxLeft)));
      nextTop=Math.max(minTop,Math.min(nextTop,Math.max(minTop,maxTop)));

      root.style.left=Math.round(nextLeft)+'px';
      root.style.top=Math.round(nextTop)+'px';
      root.style.right='auto';
    }

    function resizePreviewShell(force){
      if(isDraggingPreview&&!force){
        return;
      }
      var headerHeight=header.getBoundingClientRect().height||40;
      if(minimized){
        previewShell.style.display='none';
        root.style.width=Math.min(360,Math.max(240,(window.innerWidth||360)-16))+'px';
        root.style.height=Math.ceil(headerHeight+2)+'px';
        keepPanelInViewport();
        return;
      }

      previewShell.style.display='block';
      var availableHeight=Math.max(260,(window.innerHeight||760)-headerHeight-42);
      var availableWidth=Math.max(260,(window.innerWidth||1200)-44);
      var scale=Math.min(1,availableHeight/height,availableWidth/width);
      frameWrap.style.transform='scale('+scale+')';
      root.style.width=Math.ceil(width*scale+24)+'px';
      root.style.height=Math.ceil(headerHeight+(height*scale)+20)+'px';
      keepPanelInViewport();
    }

    function scheduleResize(){
      if(resizeFrame){return;}
      resizeFrame=requestAnimationFrame(function(){
        resizeFrame=0;
        resizePreviewShell(false);
      });
    }

    function applyPreset(preset){
      width=preset.width;
      height=preset.height;
      frameWrap.style.width=width+'px';
      frameWrap.style.height=height+'px';
      frame.style.width=width+'px';
      frame.style.height=height+'px';

      var nextDesktopUrl=withPreset(window.location.href,preset);
      if(nextDesktopUrl!==window.location.href){
        suppressNextRouteSend=true;
        window.history.replaceState(window.history.state,'',nextDesktopUrl);
      }
      frame.src=toMobileUrl(nextDesktopUrl);
      resizePreviewShell(true);
      broadcastCurrentState();
    }

    deviceSelect.addEventListener('change',function(ev){
      var selected=findPresetByName(ev.target&&ev.target.value);
      if(selected){
        applyPreset(selected);
      }
    });

    toggleBtn.addEventListener('click',function(ev){
      ev.stopPropagation();
      minimized=!minimized;
      toggleBtn.textContent=minimized?'▢':'–';
      toggleBtn.setAttribute('aria-label',minimized?'Maximize mobile preview':'Minimize mobile preview');
      resizePreviewShell(true);
    });

    try{
      frame.src=toMobileUrl(window.location.href);
    }catch(_e){}

    frame.addEventListener('load',function(){
      window.__pocketviewMobileFrame=frame;
      postSync('hello',{});
      emitRouteSync();
      emitScrollSync();
      flushQueuedSyncEvents();
    });

    frameWrap.appendChild(frame);
    previewShell.appendChild(frameWrap);
    root.appendChild(header);
    root.appendChild(previewShell);
    document.body.appendChild(root);

    enableDrag(root,header,function(isDragging){
      isDraggingPreview=Boolean(isDragging);
      frame.style.pointerEvents=isDraggingPreview?'none':'auto';
      if(!isDraggingPreview){
        keepPanelInViewport();
      }
    });
    resizePreviewShell(true);
    window.addEventListener('resize',scheduleResize,{passive:true});
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

function writeProxyHeaders(res, proxyRes, { stripLength = false } = {}, req = null) {
  const headers = { ...proxyRes.headers };

  const statusCode = proxyRes.statusCode || 200;
  if (statusCode >= 300 && statusCode < 400 && headers.location && req) {
    const pvParamNames = ["pv", "pv_mode", "mw", "mh", "device"];
    try {
      const reqParams = new URLSearchParams(new URL(req.url, "http://localhost").search);
      const hasPvParams = pvParamNames.some((p) => reqParams.has(p));
      if (hasPvParams) {
        const isAbsolute = /^https?:\/\//i.test(headers.location);
        const base = isAbsolute ? undefined : "http://localhost";
        const redirectUrl = new URL(headers.location, base);
        for (const param of pvParamNames) {
          if (reqParams.has(param)) {
            redirectUrl.searchParams.set(param, reqParams.get(param));
          }
        }
        headers.location = isAbsolute
          ? redirectUrl.toString()
          : redirectUrl.pathname + redirectUrl.search + redirectUrl.hash;
      }
    } catch (_e) {
      // leave Location header unchanged on parse failure
    }
  }

  if (stripLength) {
    delete headers["content-length"];
    delete headers["Content-Length"];
  }
  delete headers["content-encoding"];
  delete headers["Content-Encoding"];

  res.writeHead(statusCode, headers);
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
        error: (error, req, res) => {
          const message = error && error.message ? error.message : "Unknown proxy error";
          const body = JSON.stringify(
            {
              error: "POCKETVIEW_PROXY_TARGET_UNAVAILABLE",
              target,
              message,
              hint: "Start your target app first (for ASAD/web: npm run dev in ASAD/web), then reload this URL."
            },
            null,
            2
          );

          if (!res.headersSent) {
            res.writeHead(502, {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store"
            });
          }

          res.end(body);
        },
        proxyReq: (proxyReq) => {
          proxyReq.setHeader("accept-encoding", "identity");
        },
        proxyRes: (proxyRes, req, res) => {
          if (!shouldInjectHtml(proxyRes, req)) {
            writeProxyHeaders(res, proxyRes, {}, req);
            proxyRes.pipe(res);
            return;
          }

          writeProxyHeaders(res, proxyRes, { stripLength: true }, req);
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

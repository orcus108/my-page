import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const EMAIL = "thevedantmisra@gmail.com";
const X_URL = "https://x.com/orcus108";
const GH_URL = "https://github.com/orcus108";
const WORKPRINT_VIDEO = "../assets/workprint-demo.mp4";
const DEFAULT_DESCRIPTION = "Vedant Misra is an IIT Madras student and product builder working to make powerful AI useful in everyday life.";

const css = `
  @font-face{font-family:Geist;src:url("geist-latin.woff2") format("woff2");font-weight:100 900;font-style:normal;font-display:swap}
  :root{--ink:#000;--muted:rgba(0,0,0,.6);--soft:rgba(0,0,0,.75);--line:rgba(0,0,0,.14);--paper:#fff}
  *{box-sizing:border-box}
  html{font-family:Geist,Arial,sans-serif;color:var(--ink);background:var(--paper);scroll-behavior:smooth;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
  body{margin:0;background:var(--paper);font-size:16px;font-weight:400;line-height:1.45}
  a{color:inherit;text-decoration:none}
  a:hover,a:focus-visible{text-decoration:underline;text-underline-offset:3px}
  :where(.nav,.link-list,.collection-list,.socials,.contact-card) a,.back,.statement a{display:inline-block;transition:transform 140ms ease-out,opacity 140ms ease-out}
  a:focus-visible{transition-duration:0s}
  .mark{transition:transform 120ms ease-out}
  @media(hover:hover){
    :where(.nav,.link-list,.collection-list,.socials,.contact-card) a:hover,.back:hover,.statement a:hover{transform:translateX(2px)}
  }
  :where(.nav,.link-list,.collection-list,.socials,.contact-card) a:active,.back:active,.statement a:active{transform:translateX(2px) scale(.98)}
  .mark:active{transform:scale(.98)}
  img{display:block;max-width:100%}
  .mobile-only{display:none}
  .site{width:min(756px,calc(100% - 48px));margin:0 auto}
  .header{height:120px;padding-top:34px;display:flex;align-items:flex-start;justify-content:space-between}
  .mark{width:32px;height:32px;display:block}
  .mark img{width:32px;height:32px;object-fit:contain}
  .mark-motion{display:block;width:32px;height:32px;overflow:visible}
  .mark-motion path{fill:none;stroke:var(--ink);stroke-width:4.8;stroke-linecap:round;stroke-linejoin:round}
  .mark-static{display:none}
  .nav{display:flex;gap:45px;padding-top:0;font-size:14px;line-height:20px;color:var(--soft)}
  .nav a[aria-current="page"]{font-weight:450;color:var(--ink)}
  .home{height:100vh;height:100svh;position:relative;overflow:hidden}
  .home .header{position:absolute;inset:0 0 auto}
  .home-intro{position:absolute;top:19.25%;left:0;right:0;display:grid;grid-template-columns:196px 1fr;column-gap:96px}
  .identity h1{font-size:18px;line-height:23px;margin:0;font-weight:550}
  .identity p{font-size:14px;line-height:20px;margin:1px 0 0;color:var(--soft)}
  .statement{font-size:16px;line-height:21px;width:464px;max-width:100%}
  .statement p{margin:0 0 15px}
  .statement p:last-child{margin:0}
  .statement a,.statement a:hover,.statement a:focus-visible{text-decoration:none;font-weight:500}
  .statement a:hover,.statement a:focus-visible{opacity:.58}
  .socials{display:flex;align-items:center;gap:18px;margin-top:25px;height:20px}
  .socials a{display:grid;place-items:center;text-decoration:none}
  .socials img{object-fit:contain}
  .socials .contact-mark{width:20px;height:20px;font-size:17px;line-height:20px;font-weight:400}.socials .x{width:20px;height:20px}.socials .github{width:18px;height:18px}
  .home-section{position:absolute;left:0;right:0;display:grid;grid-template-columns:196px 1fr;column-gap:96px}
  .home-section.writing{top:48.47%}.home-section.projects{top:66.09%}
  .home-section h2{font-size:16px;line-height:21px;font-weight:450;margin:0}
  .section-note{font-size:16px;line-height:21px;color:var(--muted);margin:0 0 17px}
  .link-list{list-style:none;padding:0;margin:0}.link-list li+li{margin-top:13px}
  .link-list a{font-weight:450;font-size:16px;line-height:23px}
  .home-footer{position:absolute;left:0;right:0;bottom:36px;display:flex;justify-content:space-between;color:var(--soft);font-size:12px;line-height:17px;white-space:nowrap}
  .site.has-sub-footer{min-height:100svh;display:flex;flex-direction:column}
  .has-sub-footer>.page{flex:1}
  .sub-footer{min-height:56px;display:flex;align-items:flex-start;justify-content:space-between;color:var(--soft);font-size:12px;line-height:20px;white-space:nowrap}
  .sub-footer-socials{display:flex;align-items:center;gap:17px}
  .sub-footer-socials a{display:grid;place-items:center;width:20px;height:20px;text-decoration:none;transition:transform 140ms ease-out,opacity 140ms ease-out}
  .sub-footer-socials .contact-mark{font-size:16px;line-height:20px}.sub-footer-socials img{width:18px;height:18px;object-fit:contain}
  @media(hover:hover){.sub-footer-socials a:hover{transform:translateX(2px)}}
  .sub-footer-socials a:active{transform:translateX(2px) scale(.98)}
  .page{padding-bottom:90px}
  .collection{display:grid;grid-template-columns:196px 1fr;column-gap:96px;padding-top:70px}
  .collection h1{font-size:16px;line-height:21px;font-weight:450;margin:0;text-transform:capitalize}
  .collection-note{font-size:16px;line-height:21px;color:var(--muted);margin:0 0 34px}
  .collection-list{list-style:none;padding:0;margin:0}
  .collection-list li+li{margin-top:20px}
  .collection-list a{font-size:16px;line-height:22px;font-weight:450}
  .collection-group+.collection-group{margin-top:58px}
  .collection-group h2{font-size:14px;line-height:20px;font-weight:450;margin:0 0 22px;color:var(--soft)}
  .collection-group-note{max-width:450px;font-size:14px;line-height:1.55;color:var(--muted);margin:-8px 0 26px}
  .misc-disclosure summary{display:inline-flex;align-items:center;gap:8px;list-style:none;cursor:pointer;font-size:14px;line-height:20px;font-weight:450;color:var(--soft);transition:opacity 140ms ease-out}
  .misc-disclosure summary::-webkit-details-marker{display:none}
  .misc-disclosure summary::after{content:"+";font-size:14px;font-weight:400;color:var(--muted)}
  .misc-disclosure[open] summary::after{content:"−"}
  .misc-disclosure summary:hover{opacity:.58}.misc-disclosure summary:focus-visible{outline:1px solid currentColor;outline-offset:4px}
  .misc-disclosure-content{padding-top:28px}
  .misc-disclosure .collection-group-note{margin:0 0 26px}
  .article-layout{display:grid;grid-template-columns:196px 1fr;column-gap:96px;padding-top:70px}
  .article-meta{font-size:12px;color:var(--soft)}
  .detail-intro h1{font-size:18px;line-height:23px;font-weight:550;margin:0 0 4px}
  .detail-intro p{font-size:14px;line-height:20px;color:var(--soft);margin:0}
  .detail-intro time{display:block;font-size:12px;line-height:18px;color:var(--muted);margin-top:9px}
  .article h1{font-size:24px;line-height:1.2;margin:0 0 10px;font-weight:550}
  .article .summary{font-size:16px;color:var(--muted);margin:0 0 44px}
  .prose{font-size:16px;line-height:1.65}
  .prose h2,.prose h3{font-size:18px;line-height:1.35;margin:48px 0 14px;font-weight:550}
  .prose p{margin:0 0 20px}.prose ul,.prose ol{padding-left:21px;margin:0 0 20px}.prose li+li{margin-top:8px}
  .prose hr{border:0;border-top:1px solid rgba(0,0,0,.09)}
  .prose img{width:100%;height:auto;margin:32px 0}.prose a{text-decoration:underline;text-underline-offset:2px}
  .project-demo{margin:0 0 42px}.project-demo video{display:block;width:100%;height:auto;border-radius:3px;background:#f4f4f4}
  .prose table{border-collapse:collapse;width:100%;font-size:14px;margin:28px 0}.prose th,.prose td{text-align:left;vertical-align:top;border-top:1px solid var(--line);padding:10px 8px}
  .contact-card{font-size:18px;line-height:1.7}.contact-card a{text-decoration:underline;text-underline-offset:3px}
  .about-highlights{margin-top:48px}
  .about-highlights-only{margin-top:0}
  .about-intro{max-width:460px;margin:0 0 58px;font-size:16px;line-height:1.65}.about-intro p{margin:0 0 18px}.about-intro p:last-child{margin-bottom:0}
  .about-highlights-head{display:flex;align-items:baseline;justify-content:space-between;gap:20px;margin-bottom:28px}
  .about-highlights-head h2{font-size:14px;line-height:20px;font-weight:450;margin:0;color:var(--soft)}
  .about-highlights-hint{font-size:11px;line-height:16px;color:var(--muted)}
  .about-highlights-hint .desktop-only,.about-highlights-hint .mobile-only{animation:timeline-hint 8s ease-in-out infinite}
  .milestones{display:grid;gap:30px;position:relative}
  .milestones::before{content:"";position:absolute;top:26px;bottom:26px;left:25.5px;width:1px;background:rgba(0,0,0,.1);pointer-events:none}
  .milestone{display:grid;grid-template-columns:52px 1fr;gap:18px;align-items:start;position:relative}
  .milestone-logo{appearance:none;width:52px;height:52px;padding:0;border:0;background:var(--paper);cursor:default;overflow:hidden;border-radius:4px;position:relative;z-index:1}
  button.milestone-logo{cursor:pointer}
  .milestone-logo img{width:100%;height:100%;object-fit:contain;transition:transform 160ms ease-out}
  button.milestone-logo:focus-visible img,.milestone-logo[aria-expanded="true"] img,.milestone.is-open .milestone-logo img{transform:scale(1.04)}
  .milestone-logo:focus-visible{outline:1px solid currentColor;outline-offset:4px}
  .milestone-date{font-size:11px;line-height:16px;color:var(--muted);margin-bottom:2px}
  .milestone-title{font-size:14px;line-height:20px}
  .milestone-note{display:grid;grid-template-rows:0fr;font-size:12px;line-height:1.55;color:var(--muted);opacity:0;transform:translateY(-3px);margin-top:0;transition:grid-template-rows 300ms cubic-bezier(.22,1,.36,1),opacity 240ms ease-out 35ms,transform 260ms cubic-bezier(.22,1,.36,1),margin-top 300ms cubic-bezier(.22,1,.36,1)}
  .milestone-note>div{overflow:hidden}
  button.milestone-logo:focus-visible+.milestone-copy .milestone-note,.milestone-logo[aria-expanded="true"]+.milestone-copy .milestone-note,.milestone.is-open .milestone-note{grid-template-rows:1fr;opacity:1;transform:translateY(0);margin-top:8px}
  @media(hover:hover){button.milestone-logo:hover img{transform:scale(1.04)}}
  .back{display:inline-block;margin-top:55px;font-size:14px;color:var(--soft)}
  @media(max-width:720px){
    .site{width:min(100% - 40px,560px)}
    .desktop-only{display:none}.mobile-only{display:inline}
    .header{height:116px;min-height:116px;flex-direction:column;align-items:stretch;padding-top:20px}.mark,.mark img{width:28px;height:28px}.mark{align-self:flex-start}.mark-motion{display:none}.mark-static{display:block}
    .nav{width:100%;justify-content:space-between;gap:0;margin-top:16px;padding:0;font-size:14px}.nav a{min-height:32px;display:flex;align-items:center}
    .home{height:100svh;min-height:0;overflow:hidden;padding-bottom:0;display:flex;flex-direction:column}.home .header{position:relative}
    .home-intro{position:relative;inset:auto;top:auto;left:auto;right:auto;display:flex;flex:1;flex-direction:column;justify-content:center;margin:0;padding-bottom:24px}.home .identity p{color:var(--muted);font-weight:350}.statement{margin-top:34px}.statement p{margin-bottom:16px}.socials{margin-top:26px}
    .home-section{display:none}
    .home-footer{position:relative;inset:auto;display:flex;min-height:48px;margin:0;gap:12px;align-items:flex-start;white-space:normal}.home-footer span:first-child{flex:1}.home-footer span:last-child{flex-shrink:0;text-align:right;white-space:nowrap}
    .sub-footer{min-height:58px;margin-top:70px;align-items:flex-start;white-space:normal;gap:20px}
    .collection,.article-layout{grid-template-columns:1fr;padding-top:45px}.collection{gap:28px}.writing-collection,.projects-collection{gap:14px}
    .collection-note{margin-bottom:28px}.writing-collection .collection-note,.projects-collection .collection-note{margin-bottom:38px}.collection-list li+li{margin-top:18px}.collection-group+.collection-group{margin-top:48px}
    .article-layout{gap:30px}.article-meta{margin-bottom:4px}.article h1{font-size:22px}.prose{font-size:15px}
    .about-collection{padding-bottom:24px}.about-collection+.sub-footer{margin-top:24px}
    .about-highlights{margin-top:42px}.about-highlights-hint{display:inline}.about-highlights-hint .mobile-only{display:inline-block}.milestone{grid-template-columns:46px 1fr;gap:16px}.milestone-logo{width:46px;height:46px}.milestones::before{left:22.5px;top:23px;bottom:23px}
  }
  @media(max-width:430px){.site{width:calc(100% - 32px)}.nav{font-size:14px}.home-footer{font-size:11px}}
  @view-transition{navigation:auto}
  ::view-transition-old(root){animation:pers-out 180ms ease-in both}
  ::view-transition-new(root){animation:pers-in 210ms ease-out both}
  @keyframes pers-out{to{opacity:0;transform:translateY(-4px)}}
  @keyframes pers-in{from{opacity:0;transform:translateY(4px)}}
  @keyframes timeline-hint{0%,22%,100%{opacity:1}38%,70%{opacity:0}86%{opacity:1}}
  @media(prefers-reduced-motion:reduce){
    html{scroll-behavior:auto}
    *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
    .about-highlights-hint .desktop-only,.about-highlights-hint .mobile-only{animation:none!important;opacity:1}
    ::view-transition-old(root),::view-transition-new(root){animation:none!important}
  }
`;

const js = `
  var themeAudioContext=null;
  function getThemeAudioContext(){if(!themeAudioContext)themeAudioContext=new(window.AudioContext||window.webkitAudioContext)();return themeAudioContext}
  function shouldPlayThemeSound(){return !(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)}
  function connectThemeGain(ctx,amount){var gain=ctx.createGain();gain.gain.value=amount;gain.connect(ctx.destination);return gain}
  function playUiWikiClick(ctx,output,amount){var t=ctx.currentTime,noise=ctx.createBufferSource(),buf=ctx.createBuffer(1,ctx.sampleRate*.008,ctx.sampleRate),data=buf.getChannelData(0);for(var i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/50);noise.buffer=buf;var filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=4000+Math.random()*1000;filter.Q.value=3;var gain=ctx.createGain();gain.gain.value=amount*(.5+Math.random()*.15);noise.connect(filter);filter.connect(gain);gain.connect(output);noise.start(t);noise.onended=function(){noise.disconnect();filter.disconnect();gain.disconnect()}}
  function playThemeSound(){try{if(!shouldPlayThemeSound())return;var ctx=getThemeAudioContext();function play(){var output=connectThemeGain(ctx,.72);playUiWikiClick(ctx,output,.42);window.setTimeout(function(){output.disconnect()},180)}if(ctx.state==='suspended')ctx.resume().then(play).catch(function(){});else play()}catch(e){}}
  document.addEventListener('pointerdown',function(event){if(event.button&&event.button!==0)return;if(event.target.closest('a[href],button,summary,[role="button"]'))playThemeSound()},{passive:true});
  var milestoneHoverQuery=window.matchMedia&&window.matchMedia('(hover: hover) and (pointer: fine)');
  function setMilestoneOpen(row,open){row.classList.toggle('is-open',open);var control=row.querySelector('.milestone-logo[aria-expanded]');if(control)control.setAttribute('aria-expanded',open?'true':'false')}
  function closeOtherMilestones(except){document.querySelectorAll('.milestone.is-open').forEach(function(item){if(item===except)return;item.dataset.pinned='false';setMilestoneOpen(item,false)})}
  document.querySelectorAll('.milestone').forEach(function(row){
    row.addEventListener('pointerenter',function(){if(!milestoneHoverQuery||!milestoneHoverQuery.matches)return;closeOtherMilestones(row);setMilestoneOpen(row,true)});
    row.addEventListener('pointerleave',function(){if(!milestoneHoverQuery||!milestoneHoverQuery.matches)return;if(row.dataset.pinned!=='true')setMilestoneOpen(row,false)});
  });
  document.addEventListener('click',function(event){var button=event.target.closest('.milestone-logo[aria-controls]');if(!button)return;var row=button.closest('.milestone');var pinned=row.dataset.pinned==='true';closeOtherMilestones(row);if(pinned){row.dataset.pinned='false';setMilestoneOpen(row,false)}else{row.dataset.pinned='true';setMilestoneOpen(row,true)}});
  var markMotionQuery=window.matchMedia&&window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  var markStart=[[20.2,17.8],[19.6,40.7],[21.7,71.6],[31,84.7],[33.2,88.2],[35.5,87.6],[37.6,84.2],[49.6,62],[62,35],[73.7,10.3],[44.8,100.8],[50,88.6],[63,57.8],[69.2,47.9],[71.1,44.6],[73.7,45.2],[74.3,48.3],[75.6,53.7],[73.3,75.4],[75.6,79.1],[77,81.5],[79.5,79.3],[81.5,76.8],[87.5,65.5],[98.5,44.6],[105.3,47.3],[103,67],[91.5,104],[98.7,115.6]].flat();
  var markInfinity=[[64,64],[48,36],[20,36],[20,64],[20,92],[48,92],[64,64],[64,64],[64,64],[64,64],[64,64],[80,36],[108,36],[108,64],[108,92],[80,92],[64,64],[64,64],[64,64],[64,64],[64,64],[64,64],[64,64],[64,64],[64,64],[64,64],[64,64],[64,64],[64,64]].flat();
  function markPath(v){return 'M'+v[0]+' '+v[1]+' C'+v[2]+' '+v[3]+' '+v[4]+' '+v[5]+' '+v[6]+' '+v[7]+' C'+v[8]+' '+v[9]+' '+v[10]+' '+v[11]+' '+v[12]+' '+v[13]+' C'+v[14]+' '+v[15]+' '+v[16]+' '+v[17]+' '+v[18]+' '+v[19]+' M'+v[20]+' '+v[21]+' C'+v[22]+' '+v[23]+' '+v[24]+' '+v[25]+' '+v[26]+' '+v[27]+' C'+v[28]+' '+v[29]+' '+v[30]+' '+v[31]+' '+v[32]+' '+v[33]+' C'+v[34]+' '+v[35]+' '+v[36]+' '+v[37]+' '+v[38]+' '+v[39]+' C'+v[40]+' '+v[41]+' '+v[42]+' '+v[43]+' '+v[44]+' '+v[45]+' C'+v[46]+' '+v[47]+' '+v[48]+' '+v[49]+' '+v[50]+' '+v[51]+' C'+v[52]+' '+v[53]+' '+v[54]+' '+v[55]+' '+v[56]+' '+v[57]}
  document.querySelectorAll('.mark').forEach(function(mark){var line=mark.querySelector('.mark-motion-path');if(!line)return;var values=markStart.slice(),frame;line.setAttribute('d',markPath(values));function move(destination){window.cancelAnimationFrame(frame);var from=values.slice(),began=performance.now();function tick(now){var progress=Math.min((now-began)/260,1),eased=1-Math.pow(1-progress,4);values=from.map(function(n,index){return n+(destination[index]-n)*eased});line.setAttribute('d',markPath(values));if(progress<1)frame=window.requestAnimationFrame(tick)}frame=window.requestAnimationFrame(tick)}mark.addEventListener('pointerenter',function(){if(markMotionQuery&&markMotionQuery.matches)move(markInfinity)});mark.addEventListener('pointerleave',function(){if(markMotionQuery&&markMotionQuery.matches)move(markStart)})});
`;

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function normalCapitalization(value) {
  let text = String(value ?? "");
  text = text.replace(/(^\s*|[.!?]["'”’)]*\s+)([a-z])/g, (_match, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
  for (const [pattern, replacement] of [
    [/\bai\b/gi, "AI"],
    [/\bllms\b/gi, "LLMs"],
    [/\bllm\b/gi, "LLM"],
    [/\bindia\b/gi, "India"],
    [/\biit madras\b/gi, "IIT Madras"],
    [/\bmacos\b/gi, "macOS"],
    [/\bopenai\b/gi, "OpenAI"],
    [/\bgithub\b/gi, "GitHub"],
    [/\bvercel\b/gi, "Vercel"],
    [/\bnotion\b/gi, "Notion"],
    [/\bpytorch\b/gi, "PyTorch"],
    [/\bkaggle\b/gi, "Kaggle"],
    [/\bfastapi\b/gi, "FastAPI"],
    [/\bhugging face\b/gi, "Hugging Face"],
    [/\byoutube\b/gi, "YouTube"],
    [/\bsakhi\b/gi, "Sakhi"],
    [/\bi\b/g, "I"],
  ]) text = text.replace(pattern, replacement);
  text = text.replace(/\b(vs|e\.g|i\.e|etc)\. ([A-Z])/g, (_match, abbreviation, letter) => `${abbreviation}. ${letter.toLowerCase()}`);
  return text;
}

function absoluteUrl(siteUrl, pathname = "/") {
  const base = String(siteUrl || "https://vedantmisra.dev").replace(/\/+$/, "");
  if (/^https?:\/\//i.test(pathname)) return pathname;
  return `${base}/${String(pathname).replace(/^\/+/, "")}`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function jsonLd(data) {
  const items = (Array.isArray(data) ? data : [data]).filter(Boolean);
  if (!items.length) return "";
  return `<script type="application/ld+json">${JSON.stringify(items.length === 1 ? items[0] : { "@context": "https://schema.org", "@graph": items }).replaceAll("<", "\\u003c")}</script>`;
}

function breadcrumb(siteUrl, items) {
  return { "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absoluteUrl(siteUrl, item.path) })) };
}

function header(depth, active) {
  const root = "../".repeat(depth);
  return `<header class="header"><a class="mark" href="${root}index.html" aria-label="Vedant Misra home"><svg class="mark-motion" viewBox="0 0 128 128" aria-hidden="true"><path class="mark-motion-path"></path></svg><img class="mark-static" src="${root}assets/vm-mark.png" alt="" width="54" height="54"></a><nav class="nav" aria-label="Primary"><a href="${root}writing/index.html"${active === "writing" ? ' aria-current="page"' : ""}>writing</a><a href="${root}projects/index.html"${active === "projects" ? ' aria-current="page"' : ""}>projects</a><a href="${root}about/index.html"${active === "about" ? ' aria-current="page"' : ""}>about</a><a href="mailto:${EMAIL}"${active === "contact" ? ' aria-current="page"' : ""}>contact</a></nav></header>`;
}

function subFooter(depth) {
  const root = "../".repeat(depth);
  return `<footer class="sub-footer"><span><span class="desktop-only">Sophomore @ IIT Madras · Building across AI, product, and design</span><span class="mobile-only">Sophomore at IIT Madras</span></span><span class="sub-footer-socials"><a href="mailto:${EMAIL}" aria-label="Email"><span class="contact-mark" aria-hidden="true">@</span></a><a href="${X_URL}" aria-label="X" target="_blank" rel="noopener noreferrer"><img src="${root}assets/email.png" alt=""></a></span></footer>`;
}

function shell({ title, body, depth = 0, active = "", includeHeader = true, footer = false, description = DEFAULT_DESCRIPTION, pathName = "/", siteUrl, image = "/assets/social-card.png", ogType = "website", publishedTime = "", structuredData = [] }) {
  const root = "../".repeat(depth);
  const fullTitle = title === "Vedant Misra" ? "Vedant Misra | Product builder making AI useful" : `${title} | Vedant Misra`;
  const canonical = absoluteUrl(siteUrl, pathName);
  const socialImage = absoluteUrl(siteUrl, image);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(fullTitle)}</title><meta name="description" content="${esc(description)}"><meta name="author" content="Vedant Misra"><meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"><link rel="canonical" href="${esc(canonical)}"><link rel="icon" href="${root}favicon.svg" type="image/svg+xml"><meta property="og:site_name" content="Vedant Misra"><meta property="og:title" content="${esc(fullTitle)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="${esc(ogType)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(socialImage)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Vedant Misra, product builder"><meta property="og:locale" content="en_IN">${publishedTime ? `<meta property="article:published_time" content="${esc(publishedTime)}">` : ""}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:creator" content="@orcus108"><meta name="twitter:title" content="${esc(fullTitle)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(socialImage)}">${jsonLd(structuredData)}<link rel="stylesheet" href="${root}assets/pers.css?v=20260722-soft-dividers"></head><body><div class="site${footer ? " has-sub-footer" : ""}">${includeHeader ? header(depth, active) : ""}${body}${footer ? subFooter(depth) : ""}</div><script src="${root}assets/pers.js?v=20260722-soft-dividers"></script></body></html>`;
}

export async function buildPersSite({ rootDir, root, projects, posts, aboutHtml, renderMarkdown, siteUrl, basePath = "/", outputDir = "" }) {
  const normalizedBase = `/${String(basePath).replace(/^\/+|\/+$/g, "")}${basePath === "/" ? "" : "/"}`;
  const route = (suffix = "") => normalizedBase === "/" ? `/${String(suffix).replace(/^\/+/, "")}` : `${normalizedBase}${String(suffix).replace(/^\/+/, "")}`;
  const out = outputDir ? path.join(root, outputDir) : root;
  const assets = path.join(out, "assets");
  await fs.mkdir(assets, { recursive: true });
  for (const dir of ["writing", "projects", "about"]) await fs.mkdir(path.join(out, dir), { recursive: true });
  await fs.writeFile(path.join(assets, "pers.css"), css);
  await fs.writeFile(path.join(assets, "pers.js"), js);
  const sourceAssets = path.join(rootDir, "content", "preview", "pers-assets");
  for (const name of ["vm-mark.png", "email.png", "x.png", "github.png", "geist-latin.woff2", "workprint-demo.mp4", "workprint-demo-poster.jpg"]) await fs.copyFile(path.join(sourceAssets, name), path.join(assets, name));
  const socialSvg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#fff"/><text x="150" y="267" font-family="Arial,Helvetica,sans-serif" font-size="64" font-weight="600" fill="#000">Vedant Misra</text><text x="150" y="335" font-family="Arial,Helvetica,sans-serif" font-size="32" fill="#555">product builder making powerful AI useful</text><text x="150" y="484" font-family="Arial,Helvetica,sans-serif" font-size="24" fill="#777">IIT Madras · Hyderabad, India</text></svg>`;
  await sharp(Buffer.from(socialSvg)).png().toFile(path.join(assets, "social-card.png"));

  const personId = `${absoluteUrl(siteUrl, route())}#vedant-misra`;
  const websiteId = `${absoluteUrl(siteUrl, route())}#website`;
  const person = { "@type": "Person", "@id": personId, name: "Vedant Misra", url: absoluteUrl(siteUrl, route("about/")), email: `mailto:${EMAIL}`, jobTitle: "Product builder", description: DEFAULT_DESCRIPTION, affiliation: { "@type": "CollegeOrUniversity", name: "IIT Madras", sameAs: "https://www.iitm.ac.in/" }, homeLocation: { "@type": "Place", name: "Hyderabad, India" }, knowsAbout: ["product design", "consumer software", "applied artificial intelligence", "human-computer interaction"], sameAs: [GH_URL, X_URL] };
  const sitemapEntries = [];

  const home = `<main class="home">${header(0, "contact")}<div class="home-intro"><div class="identity"><h1>Vedant Misra</h1><p>Product builder</p></div><div class="statement"><p>There is a growing gap between what AI can do and what most people can actually get out of it.</p><p>I build in that gap, starting with what people need and working backwards to make powerful technology feel obvious to use.</p><p>If you’re working on the same problem, <a href="mailto:${EMAIL}">let’s talk!</a></p><div class="socials"><a href="mailto:${EMAIL}" aria-label="Email"><span class="contact-mark" aria-hidden="true">@</span></a><a href="${X_URL}" aria-label="X" target="_blank" rel="noopener noreferrer"><img class="x" src="assets/email.png" alt=""></a><a href="${GH_URL}" aria-label="GitHub" target="_blank" rel="noopener noreferrer"><img class="github" src="assets/github.png" alt=""></a></div></div></div><section class="home-section writing"><h2>Writing</h2><div><p class="section-note">Essays on intelligence, technology, and building from India.</p><ul class="link-list"><li><a href="writing/broke-countries-build-different.html">Broke Countries Build Different</a></li><li><a href="writing/ai-and-human-identity.html">AI and Human Identity</a></li></ul></div></section><section class="home-section projects"><h2>Projects</h2><div><p class="section-note">Things I’ve built, shipped, and learned from.</p><ul class="link-list"><li><a href="projects/workprint.html">Workprint</a></li><li><a href="projects/sakhi.html">Sakhi</a></li><li><a href="projects/friday.html">Friday</a></li></ul></div></section><footer class="home-footer"><span><span class="desktop-only">Sophomore @ IIT Madras · Building across AI, product, and design</span><span class="mobile-only">Sophomore at IIT Madras</span></span><span>Hyderabad, India</span></footer></main>`;
  const homeDescription = "Vedant Misra is an IIT Madras student and product builder creating consumer-facing AI products, including Workprint, Friday, and Sakhi.";
  await fs.writeFile(path.join(out, "index.html"), shell({ title: "Vedant Misra", body: home, includeHeader: false, description: homeDescription, pathName: route(), siteUrl, image: route("assets/social-card.png"), structuredData: [person, { "@type": "WebSite", "@id": websiteId, url: absoluteUrl(siteUrl, route()), name: "Vedant Misra", description: homeDescription, inLanguage: "en-IN", publisher: { "@id": personId } }, { "@type": "ProfilePage", url: absoluteUrl(siteUrl, route()), name: "Vedant Misra", mainEntity: { "@id": personId } }] }));
  sitemapEntries.push({ path: route() });

  const writingRows = posts.map((post) => `<li><a href="${esc(post.slug)}.html">${esc(normalCapitalization(post.title))}</a></li>`).join("");
  const writingDescription = "Essays by Vedant Misra on artificial intelligence, product building, technology, human identity, healthcare, and building from India.";
  await fs.writeFile(path.join(out, "writing", "index.html"), shell({ title: "Writing", depth: 1, active: "writing", footer: true, description: writingDescription, pathName: route("writing/"), siteUrl, image: route("assets/social-card.png"), structuredData: [{ "@type": "CollectionPage", url: absoluteUrl(siteUrl, route("writing/")), name: "Writing by Vedant Misra", description: writingDescription, author: { "@id": personId } }, breadcrumb(siteUrl, [{ name: "Home", path: route() }, { name: "Writing", path: route("writing/") }])], body: `<main class="page collection writing-collection"><h1>Writing</h1><div><p class="collection-note">Essays on intelligence, technology, and building from India.</p><ul class="collection-list">${writingRows}</ul></div></main>` }));
  sitemapEntries.push({ path: route("writing/") });
  const persMarkdown = (body) => renderMarkdown(body, outputDir ? 3 : 2);
  for (const post of posts) {
    const published = String(post.date || "").slice(0, 10);
    const postPath = route(`writing/${post.slug}.html`);
    const postDescription = `${normalCapitalization(post.summary)}. An essay by Vedant Misra on AI, technology, and society.`;
    const body = `<main class="page article-layout"><header class="detail-intro"><h1>${esc(normalCapitalization(post.title))}</h1><p>${esc(normalCapitalization(post.summary))}</p><time datetime="${esc(published)}">${esc(formatDate(published))}</time></header><article class="article"><div class="prose">${persMarkdown(post.body)}</div><a class="back" href="index.html">← All Writing</a></article></main>`;
    const blogPosting = { "@type": "BlogPosting", "@id": `${absoluteUrl(siteUrl, postPath)}#article`, url: absoluteUrl(siteUrl, postPath), headline: post.title, description: postDescription, image: absoluteUrl(siteUrl, route("assets/social-card.png")), datePublished: published, author: { "@id": personId }, publisher: { "@id": personId }, mainEntityOfPage: absoluteUrl(siteUrl, postPath), inLanguage: "en-IN", isAccessibleForFree: true, isPartOf: { "@id": websiteId }, keywords: ["artificial intelligence", "technology", "India", post.title] };
    await fs.writeFile(path.join(out, "writing", `${post.slug}.html`), shell({ title: post.title, body, depth: 1, active: "writing", footer: true, description: postDescription, pathName: postPath, siteUrl, image: route("assets/social-card.png"), ogType: "article", publishedTime: published, structuredData: [blogPosting, breadcrumb(siteUrl, [{ name: "Home", path: route() }, { name: "Writing", path: route("writing/") }, { name: post.title, path: postPath }])] }));
    sitemapEntries.push({ path: postPath, lastmod: published });
  }

  const workprintBody = await fs.readFile(path.join(rootDir, "content", "preview", "workprint.md"), "utf8");
  const persProjects = [{ title: "Workprint", slug: "workprint", summary: "a private story inbox for builders", date: "2026-07-18", body: workprintBody }, ...projects];
  const mainSlugs = ["workprint", "sakhi", "friday"];
  const mainProjects = mainSlugs.map((slug) => persProjects.find((project) => project.slug === slug)).filter(Boolean);
  const miscProjects = persProjects.filter((project) => !mainSlugs.includes(project.slug));
  const projectLinks = (items) => items.map((project) => `<li><a href="${esc(project.slug)}.html">${esc(normalCapitalization(project.title))}</a></li>`).join("");
  const miscNote = "From the early days of my building journey. Clippy was my first macOS app. Odds was my first app with real users. Image Cartoonification was my first time implementing a research paper. CatGPT was the first website I deployed on the internet. They might seem small, but each carried an important learning.";
  const projectsDescription = "Products and experiments built by Vedant Misra, including Workprint, Friday, Sakhi, Clippy, and other applied AI projects.";
  await fs.writeFile(path.join(out, "projects", "index.html"), shell({ title: "Projects", depth: 1, active: "projects", footer: true, description: projectsDescription, pathName: route("projects/"), siteUrl, image: route("assets/social-card.png"), structuredData: [{ "@type": "CollectionPage", url: absoluteUrl(siteUrl, route("projects/")), name: "Projects by Vedant Misra", description: projectsDescription, creator: { "@id": personId } }, breadcrumb(siteUrl, [{ name: "Home", path: route() }, { name: "Projects", path: route("projects/") }])], body: `<main class="page collection projects-collection"><h1>Projects</h1><div><p class="collection-note">Things I’ve built, shipped, and learned from.</p><section class="collection-group"><ul class="collection-list">${projectLinks(mainProjects)}</ul></section><details class="collection-group misc-disclosure"><summary>Misc</summary><div class="misc-disclosure-content"><p class="collection-group-note">${miscNote}</p><ul class="collection-list">${projectLinks(miscProjects)}</ul></div></details></div></main>` }));
  sitemapEntries.push({ path: route("projects/") });
  for (const project of persProjects) {
    const projectPath = route(`projects/${project.slug}.html`);
    const projectDescription = `${project.title} is ${project.summary}, built by Vedant Misra.`;
    const demo = project.slug === "workprint" ? `<figure class="project-demo"><video controls playsinline preload="metadata" poster="../assets/workprint-demo-poster.jpg" aria-label="Workprint Product Demo"><source src="${WORKPRINT_VIDEO}" type="video/mp4">Your browser cannot play the Workprint demo. <a href="${WORKPRINT_VIDEO}">Open the video</a>.</video></figure>` : "";
    const body = `<main class="page article-layout"><header class="detail-intro"><h1>${esc(normalCapitalization(project.title))}</h1><p>${esc(normalCapitalization(project.summary))}</p></header><article class="article">${demo}<div class="prose">${persMarkdown(project.body)}</div><a class="back" href="index.html">← All Projects</a></article></main>`;
    const projectDate = String(project.date || "").slice(0, 10);
    const projectSchema = { "@type": "SoftwareApplication", "@id": `${absoluteUrl(siteUrl, projectPath)}#project`, url: absoluteUrl(siteUrl, projectPath), name: project.title, description: projectDescription, image: absoluteUrl(siteUrl, project.slug === "workprint" ? route("assets/workprint-demo-poster.jpg") : route("assets/social-card.png")), applicationCategory: "ProductivityApplication", creator: { "@id": personId }, author: { "@id": personId }, mainEntityOfPage: absoluteUrl(siteUrl, projectPath), inLanguage: "en-IN", isAccessibleForFree: true, isPartOf: { "@id": websiteId } };
    if (/^\d{4}-\d{2}-\d{2}$/.test(projectDate)) projectSchema.dateCreated = projectDate;
    if (project.repo) projectSchema.codeRepository = project.repo;
    if (project.demo) projectSchema.sameAs = project.demo;
    if (project.slug === "workprint") projectSchema.codeRepository = "https://github.com/orcus108/openai-buildweek-hyd-workprint";
    const projectStructuredData = [projectSchema];
    if (project.slug === "workprint") projectStructuredData.push({ "@type": "VideoObject", name: "Workprint product demo", description: "A 51-second demonstration of Workprint reconstructing a builder's work and turning an evidence-backed moment into a story.", thumbnailUrl: absoluteUrl(siteUrl, route("assets/workprint-demo-poster.jpg")), uploadDate: "2026-07-18", duration: "PT51S", contentUrl: absoluteUrl(siteUrl, route("assets/workprint-demo.mp4")), embedUrl: absoluteUrl(siteUrl, projectPath) });
    projectStructuredData.push(breadcrumb(siteUrl, [{ name: "Home", path: route() }, { name: "Projects", path: route("projects/") }, { name: project.title, path: projectPath }]));
    await fs.writeFile(path.join(out, "projects", `${project.slug}.html`), shell({ title: project.title, body, depth: 1, active: "projects", footer: true, description: projectDescription, pathName: projectPath, siteUrl, image: project.slug === "workprint" ? route("assets/workprint-demo-poster.jpg") : route("assets/social-card.png"), structuredData: projectStructuredData }));
    sitemapEntries.push({ path: projectPath, lastmod: /^\d{4}-\d{2}-\d{2}$/.test(projectDate) ? projectDate : "" });
  }

  const highlights = JSON.parse(await fs.readFile(path.join(rootDir, "content", "preview", "highlights.json"), "utf8"));
  const milestoneRows = highlights.slice().reverse().map((item, index) => {
    const noteId = `milestone-note-${index}`;
    const logo = item.note
      ? `<button class="milestone-logo" type="button" aria-expanded="false" aria-controls="${noteId}" aria-label="Show note for ${esc(normalCapitalization(item.title))}"><img src="${outputDir ? "../../" : "../"}${esc(item.image).replace(/\.png$/i, ".webp")}" alt="" width="52" height="52"></button>`
      : `<div class="milestone-logo"><img src="${outputDir ? "../../" : "../"}${esc(item.image).replace(/\.png$/i, ".webp")}" alt="" width="52" height="52"></div>`;
    const note = item.note ? `<div class="milestone-note" id="${noteId}"><div>${esc(normalCapitalization(item.note))}</div></div>` : "";
    return `<div class="milestone">${logo}<div class="milestone-copy"><div class="milestone-date">${esc(item.date)}</div><div class="milestone-title">${esc(normalCapitalization(item.title))}</div>${note}</div></div>`;
  }).join("");
  const aboutIntro = `<section class="about-intro"><p>I’m a product-first builder and sophomore at IIT Madras. I care about the gap between what AI can do in labs and what most people can actually use in everyday life.</p><p>I start with people, then work backwards into technology. Right now, I’m building consumer-facing AI products from India, with a focus on making powerful systems feel obvious, useful, and trustworthy.</p></section>`;
  const aboutHighlights = `<section class="about-highlights about-highlights-only"><div class="about-highlights-head"><h2>Highlights</h2><span class="about-highlights-hint"><span class="desktop-only">hover to read more</span><span class="mobile-only">tap to read more</span></span></div><div class="milestones">${milestoneRows}</div></section>`;
  const aboutDescription = "About Vedant Misra, an IIT Madras student and product-first builder making consumer-facing AI products from India.";
  await fs.writeFile(path.join(out, "about", "index.html"), shell({ title: "About", depth: 1, active: "about", footer: true, description: aboutDescription, pathName: route("about/"), siteUrl, image: route("assets/social-card.png"), structuredData: [person, { "@type": "ProfilePage", url: absoluteUrl(siteUrl, route("about/")), name: "About Vedant Misra", description: aboutDescription, mainEntity: { "@id": personId } }, breadcrumb(siteUrl, [{ name: "Home", path: route() }, { name: "About", path: route("about/") }])], body: `<main class="page collection about-collection"><h1>About</h1><div>${aboutIntro}${aboutHighlights}</div></main>` }));
  sitemapEntries.push({ path: route("about/") });
  return sitemapEntries;
}

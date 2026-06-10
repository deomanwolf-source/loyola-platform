const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/vendor-grapesjs-C1WZPm3r.js","assets/vendor-lucide-DbJ5Vk6p.js","assets/vendor-grapesjs-kcEUIu4-.css"])))=>i.map(i=>d[i]);
import{A as be,c as Ee,g as Dt,j as e,_ as st,a as De,u as wt,s as $,b as V,d as ke,m as ve,B as Vt,e as Bt,r as Ht}from"./index-CoQW07w0.js";import{r as l,Z as Ot,_ as Ft,m as je,$ as jt,R as Ie,a0 as Gt,X as He,a1 as le,a2 as qt,a3 as Wt,a4 as Yt,H as Le,a5 as Jt,a6 as Kt,a7 as Qt,a8 as Ke,a9 as Nt,aa as Xt,ab as Zt,ac as ea,ad as ta,ae as aa,af as Re,ag as sa,q as pe,c as Oe,ah as oa,ai as ra,aj as ia,ak as na,al as ot,K as $e,am as Qe,an as kt,ao as la,ap as rt,i as Xe,J as da,N as ca,aq as Ze,ar as it,y as Fe,as as Ct,at as _e,W as pa,h as St,f as At,au as ma,n as ga,av as ha,o as Ce,aw as Ge,P as ua,G as xa,U as Ue,D as ba,F as fa,I as va,Y as ya,d as wa,e as ja}from"./vendor-lucide-DbJ5Vk6p.js";import{C as Na}from"./vendor-easy-crop-BDeHEMmm.js";import{_ as ka}from"./vendor-grapesjs-C1WZPm3r.js";import{a as Mt,S as ye,b as qe,D as Tt,B as We}from"./PortalShell-Jrc4nv7v.js";const Ca="Media upload requires an admin login and a running backend server.";class Pt extends Error{constructor(a=Ca){super(a),this.name="MediaUploadError"}}function ue(t){return t instanceof Pt}const Sa={"image/jpeg":"jpg","image/png":"png","video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov","application/pdf":"pdf"};function Aa(t){return t.trim().toLowerCase().replace(/[^a-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"")||"media"}function Ma(t){return t.trim().toLowerCase().replace(/^\/+|\/+$/g,"").replace(/[^a-z0-9/_-]+/g,"-").replace(/\/+/g,"/")||"uploads"}function Ta(t,a){const s=Sa[a]||"bin";return`${Aa(t).replace(/\.[a-z0-9]+$/i,"")||"image"}.${s}`}async function et(t,a,s,d){if(!localStorage.getItem("loyola_token"))throw new Pt("Please log in before uploading media.");const c=a instanceof File?a:new File([a],s,{type:d}),v=new FormData;v.append("file",c);const N=await fetch(`${be}/api/uploads?folder=${encodeURIComponent(Ma(t))}`,{method:"POST",headers:Ee(),body:v}),u=await N.json().catch(()=>null);if(!N.ok)throw new Error(u?.error||"Media upload failed.");return u}async function xe(t,a){return(await et(t,a,a.name,a.type)).url}async function Pa(t,a){return et(t,a,a.name,a.type)}async function za(t,a,s){const d=await fetch(a);if(!d.ok)throw new Error("Could not prepare media for upload.");const g=d.headers.get("content-type")||"application/octet-stream",c=await d.blob();return(await et(t,c,Ta(s,g),g)).url}async function nt(t){}function Ea(t){return t==="approved"||t==="rejected"||t==="published"?t:"pending"}function Ae(t){return{id:String(t.id),requestedBy:t.requested_by||"",requestedByEmail:t.requested_by_email||"",requestedByName:t.requested_by_name||"",status:Ea(t.status),reviewNote:t.review_note||"",reviewedBy:t.reviewed_by||"",reviewedByEmail:t.reviewed_by_email||"",reviewedByName:t.reviewed_by_name||"",reviewedAt:t.reviewed_at||null,publishedBy:t.published_by||"",publishedByEmail:t.published_by_email||"",publishedByName:t.published_by_name||"",publishedAt:t.published_at||null,createdAt:t.created_at||null,updatedAt:t.updated_at||null,data:t.data}}async function Me(t,a={}){const s=await fetch(`${be}${t}`,{...a,headers:Ee({"Content-Type":"application/json",...a.headers||{}}),cache:"no-store"}),d=await s.text(),g=d?JSON.parse(d):null;if(!s.ok)throw new Error(g?.error||`Request failed with status ${s.status}.`);return g}async function zt(t){const a=await Me("/api/publish-requests",{method:"POST",body:JSON.stringify({db:t})});return Ae(a.request)}async function La(t){return(await Me("/api/publish-requests")).requests.map(Ae)}async function $a(){return(await Me("/api/publish-requests/mine")).requests.map(Ae)}async function lt(t){const a=await Me(`/api/publish-requests/${t}`);return Ae(a.request)}async function Ia(t,a=""){const s=await Me(`/api/publish-requests/${t}/approve`,{method:"POST",body:JSON.stringify({reviewNote:a})});return Ae(s.request)}async function Ua(t,a){const s=await Me(`/api/publish-requests/${t}/reject`,{method:"POST",body:JSON.stringify({reviewNote:a})});return Ae(s.request)}async function Ra(t){const a=await Me(`/api/publish-requests/${t}/publish`,{method:"POST",body:JSON.stringify({})});return Ae(a.request)}const _a={checking:"border-sky-200 bg-sky-50 text-sky-900",ready:"border-emerald-200 bg-emerald-50 text-emerald-900","login-required":"border-amber-200 bg-amber-50 text-amber-900",offline:"border-red-200 bg-red-50 text-red-900"},Da={checking:jt,ready:je,"login-required":Ft,offline:Ot};function Et(){const[t,a]=l.useState({status:"checking",title:"Checking media uploads",detail:"Testing login and backend connection."}),s=l.useCallback(async()=>{if(!Dt()){a({status:"login-required",title:"Login required for media uploads",detail:"Sign in to an admin account before uploading images, videos, or documents."});return}a({status:"checking",title:"Checking media uploads",detail:"Testing the Node.js backend connection."});const c=new AbortController,v=window.setTimeout(()=>c.abort(),3500);try{const N=await fetch(`${be}/api/health`,{cache:"no-store",signal:c.signal}),u=await N.json().catch(()=>null);if(N.ok&&u?.status==="ok"){a({status:"ready",title:"Media uploads ready",detail:`Connected to ${be}.`});return}a({status:"offline",title:"Backend health check failed",detail:u?.message||`The backend at ${be} did not return a healthy response.`})}catch{a({status:"offline",title:"Backend is not reachable",detail:`Start the backend server and confirm VITE_API_URL points to ${be}.`})}finally{window.clearTimeout(v)}},[]);l.useEffect(()=>{s();const g=()=>{s()};return window.addEventListener("focus",g),()=>{window.removeEventListener("focus",g)}},[s]);const d=Da[t.status];return e.jsxs("div",{className:`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-xs leading-5 ${_a[t.status]}`,"aria-live":"polite",children:[e.jsx(d,{className:`mt-0.5 h-4 w-4 shrink-0 ${t.status==="checking"?"animate-spin":""}`}),e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("p",{className:"font-black",children:t.title}),e.jsx("p",{className:"mt-0.5 font-semibold opacity-85",children:t.detail})]}),t.status!=="ready"&&e.jsx("button",{type:"button",onClick:()=>{s()},className:"rounded-lg p-1.5 opacity-80 hover:bg-white/70 hover:opacity-100","aria-label":"Recheck media upload status",children:e.jsx(Ie,{className:"h-3.5 w-3.5"})})]})}const Va=5*1024*1024,Ba=500*1024*1024,Ha=["image/jpeg","image/png"],Oa=["video/mp4","video/quicktime","video/webm"];function Fa(t){if("dataTransfer"in t&&t.dataTransfer)return t.dataTransfer.files;const a=t.target;return a instanceof HTMLInputElement?a.files:null}function Ve(t){return Array.from(t.dataTransfer.types).includes("Files")}const Ga=`
  :root {
    --loyola-navy: #08286f;
    --loyola-gold: #d6ad19;
    --loyola-crimson: #b70f1b;
    --loyola-ink: #152033;
    --loyola-soft: #f4f7fb;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: #ffffff;
    color: var(--loyola-ink);
    font-family: Inter, Segoe UI, Arial, sans-serif;
    line-height: 1.65;
  }

  h1, h2, h3, h4 {
    margin: 0;
    color: var(--loyola-navy);
    font-family: Georgia, "Times New Roman", serif;
    line-height: 1.08;
  }

  h1 { font-size: clamp(2.4rem, 6vw, 4.8rem); }
  h2 { font-size: clamp(1.9rem, 4vw, 3rem); }
  h3 { font-size: 1.35rem; }

  p { margin: 0; color: #546179; }
  a { color: var(--loyola-crimson); text-decoration: none; font-weight: 700; }
  img { display: block; max-width: 100%; }

  section { padding: 72px 40px; }
  .container { width: min(1120px, calc(100% - 40px)); margin: 0 auto; }
  .eyebrow {
    color: var(--loyola-crimson);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    border: 0;
    border-radius: 8px;
    background: var(--loyola-navy);
    color: #fff;
    padding: 12px 22px;
    font-weight: 800;
    cursor: pointer;
  }
  .btn.gold { background: var(--loyola-gold); color: var(--loyola-navy); }
  .hero {
    position: relative;
    overflow: hidden;
    background: linear-gradient(120deg, rgba(8, 40, 111, 0.96), rgba(8, 40, 111, 0.78)),
      url("/loyola-crest.jpg") center/contain no-repeat;
    color: #fff;
  }
  .hero h1, .hero p { color: #fff; }
  .hero .eyebrow { color: #f7d96b; }
  .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
  .feature-card {
    border: 1px solid #dde4ed;
    border-radius: 8px;
    background: #fff;
    padding: 28px;
    box-shadow: 0 16px 38px -28px rgba(8, 40, 111, 0.45);
  }
  .stats-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }
  .stat-tile {
    border: 1px solid #dde4ed;
    border-radius: 8px;
    background: #fff;
    padding: 24px;
    text-align: center;
    box-shadow: 0 14px 34px -28px rgba(8, 40, 111, 0.42);
  }
  .stat-tile strong {
    display: block;
    color: var(--loyola-navy);
    font-family: Georgia, "Times New Roman", serif;
    font-size: 2.1rem;
    line-height: 1;
  }
  .stat-tile span {
    display: block;
    margin-top: 8px;
    color: #64748b;
    font-size: .8rem;
    font-weight: 800;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .home-about-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 390px;
    gap: 44px;
    align-items: start;
  }
  .home-stat-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .home-rector-section {
    background: #fff;
  }
  .home-rector-grid {
    display: grid;
    grid-template-columns: 360px minmax(0, 1fr);
    gap: 36px;
    align-items: center;
  }
  .home-rector-photo {
    margin: 0;
    overflow: hidden;
    border-radius: 8px;
    background: #eef2f6;
    box-shadow: 0 16px 38px -28px rgba(8, 40, 111, 0.45);
  }
  .home-rector-photo img {
    width: 100%;
    aspect-ratio: 4 / 5;
    object-fit: cover;
  }
  .home-rector-message {
    border-left: 8px solid var(--loyola-navy);
    background: #fff;
    padding: 30px;
    box-shadow: 0 16px 38px -28px rgba(8, 40, 111, 0.45);
  }
  .home-signature {
    margin-top: 24px;
    color: var(--loyola-navy);
    font-weight: 800;
  }
  .home-signature span {
    color: #64748b;
    font-size: .82rem;
  }
  .home-section-heading {
    max-width: 760px;
  }
  .leadership-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 18px;
  }
  .leadership-card {
    overflow: hidden;
    border: 1px solid #dde4ed;
    border-radius: 8px;
    background: #fff;
    text-align: center;
    box-shadow: 0 16px 38px -28px rgba(8, 40, 111, 0.45);
  }
  .leadership-card img {
    width: 100%;
    aspect-ratio: 4 / 5;
    object-fit: cover;
    background: #dfe5ef;
  }
  .leadership-card div {
    padding: 20px 16px 24px;
  }
  .leadership-card span {
    display: block;
    width: 40px;
    height: 2px;
    margin: 12px auto 0;
    background: var(--loyola-gold);
  }
  .leadership-card p {
    margin-top: 12px;
    font-weight: 700;
    color: #64748b;
  }
  .team-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
  }
  .team-card {
    overflow: hidden;
    border: 1px solid #dde4ed;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 16px 38px -28px rgba(8, 40, 111, 0.45);
  }
  .team-card img {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
  }
  .team-card div {
    padding: 20px;
  }
  .team-card p {
    margin-top: 6px;
  }
  .cta-banner {
    position: relative;
    overflow: hidden;
    border-radius: 8px;
    background: linear-gradient(135deg, var(--loyola-navy), #1e3560);
    color: #fff;
  }
  .cta-banner::after {
    position: absolute;
    inset: -30% -12% auto auto;
    width: 260px;
    aspect-ratio: 1;
    border-radius: 999px;
    background: rgba(214, 173, 25, .22);
    content: "";
  }
  .cta-banner h2,
  .cta-banner p {
    color: #fff;
  }
  .cta-banner .eyebrow {
    color: #f7d96b;
  }
  .band { background: var(--loyola-soft); }
  .quote {
    border-left: 4px solid var(--loyola-gold);
    padding-left: 24px;
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(1.5rem, 3vw, 2.25rem);
    color: var(--loyola-navy);
  }
  .anthem-media-section {
    background: #fff;
  }
  .anthem-media-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 420px;
    gap: 56px;
    align-items: center;
  }
  .anthem-media-card {
    display: block;
    overflow: hidden;
    border: 1px solid #dde4ed;
    border-radius: 8px;
    background: #0a1628;
    box-shadow: 0 28px 70px -42px rgba(10, 22, 40, 0.68);
  }
  .anthem-media-cover {
    position: relative;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: #101827;
  }
  .anthem-media-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.78;
    transition: transform 180ms ease;
  }
  .anthem-media-card:hover .anthem-media-cover img {
    transform: scale(1.04);
  }
  .anthem-play {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(10, 22, 40, 0.18);
  }
  .anthem-play span {
    display: grid;
    width: 78px;
    height: 78px;
    place-items: center;
    border: 2px solid rgba(255,255,255,.86);
    border-radius: 999px;
    background: var(--loyola-gold);
    color: var(--loyola-navy);
    font-size: 30px;
    font-weight: 900;
  }
  .anthem-media-caption {
    border-top: 1px solid rgba(255,255,255,.12);
    padding: 22px;
  }
  .anthem-media-caption .eyebrow {
    color: #f7d96b;
  }
  .anthem-media-caption h3 {
    margin-top: 10px;
    color: #fff;
  }

  @media (max-width: 760px) {
    section { padding: 52px 22px; }
    .container { width: 100%; }
    .grid-2, .grid-3, .stats-row, .team-grid, .anthem-media-layout, .home-about-grid, .home-stat-grid, .home-rector-grid, .leadership-grid { grid-template-columns: 1fr; }
  }
`,qa=`<section class="hero">
  <div class="container">
    <p class="eyebrow">Loyola College Negombo</p>
    <h1 style="max-width: 780px; margin-top: 18px;">Welcome to Loyola</h1>
    <p style="max-width: 640px; margin-top: 20px; font-size: 1.15rem;">Build a polished school page by dragging sections, cards, text, images, and buttons into this canvas.</p>
    <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px;">
      <a class="btn gold" href="#">Explore</a>
      <a class="btn" href="#">Contact Office</a>
    </div>
  </div>
</section>
<section>
  <div class="container grid-3">
    <article class="feature-card">
      <p class="eyebrow">Academics</p>
      <h3 style="margin-top: 12px;">Learning Pathways</h3>
      <p style="margin-top: 10px;">Add concise content for your school section.</p>
    </article>
    <article class="feature-card">
      <p class="eyebrow">Campus</p>
      <h3 style="margin-top: 12px;">Facilities</h3>
      <p style="margin-top: 10px;">Use drag and drop blocks to shape the layout.</p>
    </article>
    <article class="feature-card">
      <p class="eyebrow">Notices</p>
      <h3 style="margin-top: 12px;">Updates</h3>
      <p style="margin-top: 10px;">Keep important page information easy to scan.</p>
    </article>
  </div>
</section>`,Wa=[{id:"desktop",label:"Desktop",deviceName:"Desktop",icon:qt},{id:"tablet",label:"Tablet",deviceName:"Tablet",icon:Wt},{id:"mobile",label:"Mobile",deviceName:"Mobile",icon:Yt}];function Ya({initialHtml:t,initialCss:a,canvasCss:s,onSave:d,onClose:g}){const c=l.useRef(null),[v,N]=l.useState(!0),[u,w]=l.useState(null),[m,p]=l.useState("desktop"),[b,S]=l.useState(!1),[z,y]=l.useState(null),[L,T]=l.useState(""),[x,i]=l.useState(0),[f,A]=l.useState(!1),_=l.useRef(null),O=l.useRef(null),G=l.useRef(null),ae=l.useRef(null),ie=l.useRef(null),se=l.useCallback(async D=>{const q=c.current;if(!q)return;const ee=Array.from(D);for(const n of ee)try{let C="file";if(n.type.startsWith("image/")){if(C="image",!Ha.includes(n.type)){alert(`Image "${n.name}" must be a JPG or PNG file.`);continue}if(n.size>Va){alert(`Image "${n.name}" is larger than 5MB and cannot be uploaded.`);continue}}else if(n.type.startsWith("video/")){if(C="video",!Oa.includes(n.type)){alert(`Video "${n.name}" must be MP4, MOV, or WebM.`);continue}if(n.size>Ba){alert(`Video "${n.name}" is larger than 500MB and cannot be uploaded.`);continue}}const h=await xe("site-images",n);q.AssetManager.add({src:h,name:n.name}),y({name:n.name,url:h,kind:C}),i(P=>P+1),T("")}catch(C){console.error("Failed to upload asset",C),alert(`Upload failed: ${C instanceof Error?C.message:"Unknown error"}`)}},[]);l.useEffect(()=>{if(!_.current)return;let D=!1;return Promise.all([st(()=>import("./vendor-grapesjs-C1WZPm3r.js").then(q=>q.i),__vite__mapDeps([0,1,2])),st(()=>import("./vendor-grapesjs-C1WZPm3r.js").then(q=>q.a),__vite__mapDeps([0,1,2]))]).catch(q=>{D||(N(!1),w(q instanceof Error?q.message:"Failed to load Visual Builder plugins."))}).then(q=>{if(!q)return;const[{default:ee},{default:n}]=q;if(!_.current||D)return;N(!1);const C=ka.init({container:_.current,fromElement:!1,height:"100%",width:"100%",storageManager:!1,plugins:[ee,n],pluginsOpts:{"grapesjs-preset-webpage":{modalImportTitle:"Import HTML"},"grapesjs-blocks-basic":{flexGrid:!0,blocks:["column1","column2","column3","text","link","image","video","map"]}},canvas:{styles:["https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap"]},deviceManager:{devices:[{name:"Desktop",width:""},{name:"Tablet",width:"768px",widthMedia:"992px"},{name:"Mobile",width:"375px",widthMedia:"480px"}]},assetManager:{uploadFile:async P=>{const I=Fa(P);!I||I.length===0||await se(I)}},panels:{defaults:[]},blockManager:{appendTo:O.current},styleManager:{appendTo:G.current},layerManager:{appendTo:ae.current},traitManager:{appendTo:ie.current},selectorManager:{componentFirst:!0}});C.on("asset:remove",P=>{P.get("src")&&nt().catch(R=>console.error("Failed to delete asset from backend storage",R))}),C.on("component:update:src",P=>{const I=P.previous("src"),R=P.get("src");I&&I!==R&&(nt().catch(Q=>console.error("Failed to auto-delete old backend image",Q)),C.AssetManager.remove(I))}),C.on("change:changesCount",()=>{S(!0)}),C.on("load",()=>{const P=C.Canvas.getFrameEl();if(P?.contentDocument){const I=P.contentDocument.createElement("style");if(I.textContent=Ga,P.contentDocument.head.appendChild(I),s){const R=P.contentDocument.createElement("style");R.textContent=s,P.contentDocument.head.appendChild(R)}}}),C.DomComponents.addType("anthem-media-card",{isComponent:P=>P.classList?.contains("anthem-media-card")?{type:"anthem-media-card"}:!1,model:{defaults:{tagName:"a",attributes:{class:"anthem-media-card",href:"#","data-cover":"/loyola-crest.jpg","data-title":"College Anthem & Hymn"},traits:[{type:"text",name:"href",label:"Video link",placeholder:"YouTube or video URL"},{type:"text",name:"data-cover",label:"Cover photo URL",placeholder:"Paste image URL"},{type:"text",name:"data-title",label:"Media title",placeholder:"College Anthem & Hymn"},{type:"select",name:"target",label:"Open",options:[{id:"",label:"Same tab"},{id:"_blank",label:"New tab"}]}]},init(){this.on("change:attributes:data-cover",this.updateCover),this.on("change:attributes:data-title",this.updateTitle)},updateCover(){const P=this.getAttributes()["data-cover"]||"/loyola-crest.jpg",I=this.find("img")[0];I&&I.addAttributes({src:P})},updateTitle(){const P=this.getAttributes()["data-title"]||"College Anthem & Hymn",I=this.find(".anthem-media-title")[0];I&&I.components(P)}}});const h=C.BlockManager;h.add("loyola-hero",{label:"Hero",category:"Loyola Sections",media:'<svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z"/><path d="M7 10h8M7 14h5"/></svg>',content:'<section class="hero"><div class="container"><p class="eyebrow">Loyola College</p><h1 style="max-width:760px;margin-top:18px;">A Tradition of Excellence</h1><p style="max-width:620px;margin-top:20px;font-size:1.1rem;">Replace this text with a strong page introduction.</p><a class="btn gold" href="#" style="margin-top:28px;">Learn More</a></div></section>'}),h.add("loyola-feature-grid",{label:"Feature Grid",category:"Loyola Sections",media:'<svg viewBox="0 0 24 24"><path d="M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z"/></svg>',content:'<section><div class="container grid-3"><article class="feature-card"><p class="eyebrow">One</p><h3 style="margin-top:12px;">Feature title</h3><p style="margin-top:10px;">Short supporting text.</p></article><article class="feature-card"><p class="eyebrow">Two</p><h3 style="margin-top:12px;">Feature title</h3><p style="margin-top:10px;">Short supporting text.</p></article><article class="feature-card"><p class="eyebrow">Three</p><h3 style="margin-top:12px;">Feature title</h3><p style="margin-top:10px;">Short supporting text.</p></article></div></section>'}),h.add("loyola-split",{label:"Image + Text",category:"Loyola Sections",media:'<svg viewBox="0 0 24 24"><path d="M4 5h7v14H4zM14 7h6M14 11h6M14 15h4"/></svg>',content:'<section class="band"><div class="container grid-2" style="align-items:center;"><img src="/loyola-crest.jpg" alt="" style="width:100%;border-radius:8px;background:#fff;padding:30px;box-shadow:0 16px 38px -28px rgba(8,40,111,.45);"/><div><p class="eyebrow">Section</p><h2 style="margin-top:12px;">Build a clean content section</h2><p style="margin-top:18px;">Use this area for page copy, admissions details, school life, or programme descriptions.</p><a class="btn" href="#" style="margin-top:24px;">Call to Action</a></div></div></section>'}),h.add("loyola-quote",{label:"Quote",category:"Loyola Sections",media:'<svg viewBox="0 0 24 24"><path d="M7 7h6v6H9v4H5v-6c0-2.2.8-3.6 2-4zM17 7h4v6h-4v4h-4v-6c0-2.2.8-3.6 4-4z"/></svg>',content:'<section><div class="container"><blockquote class="quote">Veritate ad Lumen et Vitam</blockquote><p class="eyebrow" style="margin-top:18px;">Loyola College</p></div></section>'}),h.add("loyola-anthem-media",{label:"Anthem Media",category:"Loyola Sections",media:'<svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/><path d="m10 9 5 3-5 3z"/></svg>',content:`<section class="anthem-media-section">
  <div class="container anthem-media-layout">
    <div>
      <p class="eyebrow">Watch and Listen</p>
      <h2 style="margin-top:12px;">Anthem and hymn media.</h2>
      <p style="max-width:620px;margin-top:18px;"></p>
      <a class="btn" href="#" style="margin-top:26px;">Open video</a>
    </div>
    <a class="anthem-media-card" data-gjs-type="anthem-media-card" href="#" data-cover="/loyola-crest.jpg" data-title="College Anthem & Hymn">
      <div class="anthem-media-cover">
        <img src="/loyola-crest.jpg" alt="" />
        <div class="anthem-play"><span>&#9658;</span></div>
      </div>
      <div class="anthem-media-caption">
        <p class="eyebrow">Featured media</p>
        <h3 class="anthem-media-title">College Anthem & Hymn</h3>
      </div>
    </a>
  </div>
</section>`}),h.add("loyola-stats-row",{label:"Stats Row",category:"Loyola Sections",media:'<svg viewBox="0 0 24 24"><path d="M4 18V9M10 18V5M16 18v-7M22 18V8"/></svg>',content:'<section class="band"><div class="container"><p class="eyebrow">At a glance</p><h2 style="margin-top:12px;">Loyola by the numbers</h2><div class="stats-row" style="margin-top:28px;"><article class="stat-tile"><strong>100+</strong><span>Years of service</span></article><article class="stat-tile"><strong>2,000+</strong><span>Students</span></article><article class="stat-tile"><strong>90+</strong><span>Teachers</span></article><article class="stat-tile"><strong>25+</strong><span>Clubs and sports</span></article></div></div></section>'}),h.add("loyola-home-hero",{label:"Home Hero",category:"Home Sections",media:'<svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z"/><path d="M7 10h8M7 14h5"/></svg>',content:`<section class="home-hero-section" style="position:relative; background:#0a1628; color:#fff; overflow:hidden; padding:80px 40px; min-height:85vh; display:flex; align-items:center;">
  <div style="position:absolute; inset:0; opacity:0.3; background-image:radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px); background-size:24px 24px;"></div>
  <div class="container grid-2" style="position:relative; z-index:2; align-items:center; gap:40px;">
    <div>
      <span class="gold-divider" style="margin-bottom:20px;"></span>
      <p class="eyebrow" style="color:#f7d96b; font-size:12px; font-weight:800; letter-spacing:0.24em; text-transform:uppercase;">Loyola College Negombo</p>
      <h1 style="font-family:serif; font-size:clamp(2.5rem, 5vw, 4.5rem); line-height:1.1; font-weight:bold; margin-top:20px; color:#fff;">A Tradition of Excellence.<br/>A Future of Innovation.</h1>
      <p style="margin-top:20px; font-size:1.1rem; color:rgba(255,255,255,0.85); max-width:600px; line-height:1.6;">Veritate ad Lumen et Vitam. Providing premium education, character formation, and holistic development for generations.</p>
      <div style="margin-top:30px; display:flex; flex-wrap:wrap; gap:16px;">
        <a class="btn gold" href="/about" style="background:#d4a017; color:#0a1628; padding:12px 28px; border-radius:8px; font-weight:800; text-decoration:none; display:inline-flex; align-items:center; gap:8px;">Explore College &rarr;</a>
        <a class="btn" href="/news" style="background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.2); padding:12px 28px; border-radius:8px; font-weight:800; text-decoration:none;">View Notices</a>
      </div>
    </div>
    <aside style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:12px; padding:30px; backdrop-filter:blur(10px);">
      <h3 style="font-family:serif; font-size:1.35rem; font-weight:bold; color:#fff; margin-bottom:20px;">Loyola Quick Access</h3>
      <div style="display:grid; gap:12px;">
        <a href="/portal" style="display:flex; align-items:center; gap:16px; padding:14px; background:rgba(255,255,255,0.08); border-radius:8px; text-decoration:none; color:#fff; transition: background 0.2s;">
          <span style="font-size:24px; color:#f7d96b;">🔐</span>
          <div>
            <strong style="display:block; font-size:14px;">Portal Login</strong>
            <span style="font-size:11px; color:rgba(255,255,255,0.6);">Secure sign-in for school portals</span>
          </div>
        </a>
        <a href="/downloads" style="display:flex; align-items:center; gap:16px; padding:14px; background:rgba(255,255,255,0.08); border-radius:8px; text-decoration:none; color:#fff; transition: background 0.2s;">
          <span style="font-size:24px; color:#f7d96b;">📁</span>
          <div>
            <strong style="display:block; font-size:14px;">Downloads &amp; Forms</strong>
            <span style="font-size:11px; color:rgba(255,255,255,0.6);">Circulars, syllabuses, and files</span>
          </div>
        </a>
        <a href="/about/college-staff" style="display:flex; align-items:center; gap:16px; padding:14px; background:rgba(255,255,255,0.08); border-radius:8px; text-decoration:none; color:#fff; transition: background 0.2s;">
          <span style="font-size:24px; color:#f7d96b;">🎓</span>
          <div>
            <strong style="display:block; font-size:14px;">Academic Staff</strong>
            <span style="font-size:11px; color:rgba(255,255,255,0.6);">Our rector, administration, and faculty</span>
          </div>
        </a>
      </div>
    </aside>
  </div>
</section>`}),h.add("loyola-home-about",{label:"Home About",category:"Home Sections",media:'<svg viewBox="0 0 24 24"><path d="M4 5h9v14H4zM16 6h4M16 11h4M16 16h4"/></svg>',content:'<section class="home-about-section"><div class="container home-about-grid"><div><p class="eyebrow">About Our College</p><h2 style="margin-top:12px;">Loyola College Negombo.</h2><p style="margin-top:18px; line-height:1.6; color:#546179;">Founded with a rich legacy of spiritual, intellectual, and physical excellence, Loyola College has stood as a beacon of education, preparing students to serve with leadership, integrity, and truth.</p><a class="btn" href="/about" style="margin-top:24px; text-decoration:none;">More Details</a></div><div class="home-stat-grid"><article class="stat-tile"><strong>2,500+</strong><span>Active Students</span></article><article class="stat-tile"><strong>110+</strong><span>Academic Staff</span></article><article class="stat-tile"><strong>1993</strong><span>Established</span></article><article class="stat-tile"><strong>25+</strong><span>Clubs &amp; Sports</span></article></div></div></section>'}),h.add("loyola-home-pillars",{label:"Home Pillars",category:"Home Sections",media:'<svg viewBox="0 0 24 24"><path d="M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z"/></svg>',content:`<section class="home-pillars-section" style="background:#f8fafc; padding:80px 40px; border-y:1px solid #dde4ed;">
  <div class="container">
    <div style="text-align:center; max-width:800px; margin:0 auto 50px;">
      <p class="eyebrow" style="color:#b70f1b;">Our Core Approach</p>
      <h2 style="margin-top:12px; font-family:serif; font-size:2.5rem; color:#0a1628;">A Foundation of Excellence</h2>
      <p style="margin-top:16px; color:#64748b; line-height:1.6;">We nurture our students through balanced education systems designed to foster deep technical expertise, robust physical capabilities, and strong moral values.</p>
    </div>
    <div class="grid-3" style="gap:24px;">
      <article class="feature-card" style="background:#fff; border:1px solid #dde4ed; padding:30px; border-radius:8px;">
        <span style="font-size:32px;">🧠</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.35rem; color:#0a1628;">Academic Rigor</h3>
        <p style="margin-top:12px; font-size:0.9rem; color:#64748b; line-height:1.6;">Modern curricula focusing on science, technology, mathematics, commerce, and humanities to prepare students for international pathways.</p>
      </article>
      <article class="feature-card" style="background:#fff; border:1px solid #dde4ed; padding:30px; border-radius:8px;">
        <span style="font-size:32px;">⛪</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.35rem; color:#0a1628;">Character Formation</h3>
        <p style="margin-top:12px; font-size:0.9rem; color:#64748b; line-height:1.6;">Character guidance built upon Christian principles, respect, self-discipline, and compassion to raise upright citizens.</p>
      </article>
      <article class="feature-card" style="background:#fff; border:1px solid #dde4ed; padding:30px; border-radius:8px;">
        <span style="font-size:32px;">🏆</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.35rem; color:#0a1628;">Co-Curricular Growth</h3>
        <p style="margin-top:12px; font-size:0.9rem; color:#64748b; line-height:1.6;">Vibrant athletics, clubs, and societies, offering sports, music, drama, coding, and environmental exploration.</p>
      </article>
    </div>
  </div>
</section>`}),h.add("loyola-rector-message",{label:"Rector Message",category:"Home Sections",media:'<svg viewBox="0 0 24 24"><path d="M5 4h6v16H5zM14 6h6M14 10h6M14 14h4"/></svg>',content:`<section class="home-rector-section"><div class="container home-rector-grid"><figure class="home-rector-photo"><img src="/loyola-crest.jpg" alt="Rector portrait placeholder" /></figure><article class="home-rector-message"><p class="eyebrow">Rector's Message</p><h2 style="margin-top:12px;">Welcome to Our Digital Space.</h2><p style="margin-top:18px; line-height:1.6; color:#546179;">Dear teachers, students, parents, and alumni, I welcome you warmly to Loyola College Negombo. Our mission is to raise children of truth, who discover light and life through learning, compassion, and spiritual strength.</p><p style="margin-top:14px; line-height:1.6; color:#546179;">We aim to ensure that every student who leaves our gates is equipped with both academic excellence and a strong moral character to face the modern world's challenges.</p><p class="home-signature">Rev. Fr. D.M.J. Kennedy Perera<br /><span>Rector, Loyola College</span></p></article></div></section>`}),h.add("loyola-leadership-grid",{label:"Leadership Grid",category:"Home Sections",media:'<svg viewBox="0 0 24 24"><path d="M5 6h4v5H5zM10 6h4v5h-4zM15 6h4v5h-4zM5 13h4v5H5zM10 13h4v5h-4zM15 13h4v5h-4z"/></svg>',content:`<section class="home-leadership-section" style="background:#f8fafc; padding:80px 40px;"><div class="container"><div class="home-section-heading" style="text-align:center; max-width:800px; margin:0 auto 50px;"><p class="eyebrow">Administration Board</p><h2 style="margin-top:12px; font-family:serif; font-size:2.5rem; color:#0a1628;">College Leadership</h2><p style="margin-top:16px; color:#64748b; line-height:1.6;">The administration board steering Loyola College's legacy and future directions.</p></div><div class="leadership-grid" style="margin-top:32px;"><article class="leadership-card"><img src="/loyola-crest.jpg" alt="Rector" /><div style="padding:20px;"><h3 style="font-family:serif; font-size:1.25rem; font-weight:bold; color:#0a1628; margin:0;">Rev. Fr. Kennedy Perera</h3><span style="display:block; width:40px; height:2px; background:#d4a017; margin:10px auto;"></span><p style="margin:10px 0 0; font-size:0.85rem; color:#64748b; font-weight:bold; text-transform:uppercase;">Rector</p></div></article><article class="leadership-card"><img src="/loyola-crest.jpg" alt="Vice Principal" /><div style="padding:20px;"><h3 style="font-family:serif; font-size:1.25rem; font-weight:bold; color:#0a1628; margin:0;">Rev. Fr. Suranga Niroshan</h3><span style="display:block; width:40px; height:2px; background:#d4a017; margin:10px auto;"></span><p style="margin:10px 0 0; font-size:0.85rem; color:#64748b; font-weight:bold; text-transform:uppercase;">Vice Principal</p></div></article><article class="leadership-card"><img src="/loyola-crest.jpg" alt="Sectional Head" /><div style="padding:20px;"><h3 style="font-family:serif; font-size:1.25rem; font-weight:bold; color:#0a1628; margin:0;">Mrs. Nimali Fernando</h3><span style="display:block; width:40px; height:2px; background:#d4a017; margin:10px auto;"></span><p style="margin:10px 0 0; font-size:0.85rem; color:#64748b; font-weight:bold; text-transform:uppercase;">Primary Section Head</p></div></article><article class="leadership-card"><img src="/loyola-crest.jpg" alt="Senior Master" /><div style="padding:20px;"><h3 style="font-family:serif; font-size:1.25rem; font-weight:bold; color:#0a1628; margin:0;">Mr. Samantha Silva</h3><span style="display:block; width:40px; height:2px; background:#d4a017; margin:10px auto;"></span><p style="margin:10px 0 0; font-size:0.85rem; color:#64748b; font-weight:bold; text-transform:uppercase;">Senior Section Head</p></div></article></div></div></section>`}),h.add("loyola-home-vision",{label:"Home Vision",category:"Home Sections",media:'<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>',content:`<section class="home-vision-mission-section" style="background:#082766; color:#fff; padding:80px 40px; position:relative; overflow:hidden;">
  <div style="position:absolute; inset:0; opacity:0.08; background-image:linear-gradient(135deg,transparent 0,transparent 24px,#fff 25px,transparent 26px),linear-gradient(45deg,transparent 0,transparent 28px,#fff 29px,transparent 30px); background-size:120px_120px;"></div>
  <div class="container grid-2" style="position:relative; z-index:2; align-items:center; gap:48px;">
    <div>
      <p class="eyebrow" style="color:#fff1a8; font-size:12px; font-weight:800; letter-spacing:0.24em;">Loyola Identity</p>
      <h2 style="font-family:serif; font-size:2.8rem; font-weight:bold; margin-top:16px; color:#fff; line-height:1.2;">Welcome to Loyola College</h2>
      <div style="margin-top:40px; display:grid; gap:30px;">
        <div>
          <h3 style="font-size:1.5rem; font-weight:bold; color:#fff1a8;">Our Vision</h3>
          <p style="margin-top:10px; color:rgba(255,255,255,0.8); line-height:1.6; font-size:0.95rem;">To announce God's Kingdom through Christian values, offering integral education and human guidelines.</p>
        </div>
        <div>
          <h3 style="font-size:1.5rem; font-weight:bold; color:#fff1a8;">Mission Statement</h3>
          <div style="margin-top:16px; display:grid; gap:12px;">
            <p style="display:flex; gap:12px; align-items:start; margin:0; color:rgba(255,255,255,0.8); font-size:0.95rem;">
              <span style="color:#fff1a8; font-weight:bold;">&check;</span>
              <span>To aim at integral education of body, mind, and spirit through service and leadership.</span>
            </p>
            <p style="display:flex; gap:12px; align-items:start; margin:0; color:rgba(255,255,255,0.8); font-size:0.95rem;">
              <span style="color:#fff1a8; font-weight:bold;">&check;</span>
              <span>To strive to form citizens of upright character who pursue excellence in every sphere.</span>
            </p>
            <p style="display:flex; gap:12px; align-items:start; margin:0; color:rgba(255,255,255,0.8); font-size:0.95rem;">
              <span style="color:#fff1a8; font-weight:bold;">&check;</span>
              <span>To promote character formation based on human and religious values.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
    <aside style="background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); max-width:480px; margin:0 auto;">
      <div style="aspect-ratio:1.6; background:#000;">
        <img src="/flag1.png" alt="Loyola Flag" style="width:100%; height:100%; object-fit:contain; background:#fff;" />
      </div>
      <div style="padding:30px; text-align:center; background:#fff;">
        <p style="font-family:serif; font-size:1.5rem; font-weight:bold; color:#0a1628; margin:0;">Veritate Ad Lumen Et Vitam</p>
        <p style="margin:8px 0 0; font-size:0.85rem; color:#64748b; font-weight:bold;">In Truth to Light and Life</p>
      </div>
    </aside>
  </div>
</section>`}),h.add("loyola-home-academics",{label:"Home Academics",category:"Home Sections",media:'<svg viewBox="0 0 24 24"><path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/><path d="M17 12v5c0 1.66-2.24 3-5 3s-5-1.34-5-3v-5l5 3 5-3z"/></svg>',content:`<section class="home-academics-section" style="padding:80px 40px;">
  <div class="container">
    <div style="display:flex; justify-content:between; align-items:end; flex-wrap:wrap; gap:20px; margin-bottom:40px;">
      <div>
        <p class="eyebrow" style="color:#b70f1b;">Academics</p>
        <h2 style="margin-top:12px; font-family:serif; font-size:2.5rem; color:#0a1628; margin:0;">Academic pathways for every stage.</h2>
      </div>
      <a href="/academics" style="color:#b70f1b; font-weight:bold; text-decoration:none; font-size:0.95rem;">Academics Overview &rarr;</a>
    </div>
    <div class="grid-4" style="gap:20px;">
      <article class="feature-card" style="border:1px solid #dde4ed; padding:24px; border-radius:8px; background:#fff;">
        <span style="font-size:24px; color:#d4a017;">🎓</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.2rem; color:#0a1628;">Primary Section</h3>
        <p style="margin-top:10px; font-size:0.85rem; color:#64748b; line-height:1.6;">Foundational learning, basic language development, religious values, and classroom confidence.</p>
      </article>
      <article class="feature-card" style="border:1px solid #dde4ed; padding:24px; border-radius:8px; background:#fff;">
        <span style="font-size:24px; color:#d4a017;">🎓</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.2rem; color:#0a1628;">Middle School</h3>
        <p style="margin-top:10px; font-size:0.85rem; color:#64748b; line-height:1.6;">Structured study habits, co-curricular exploration, personal character formation, and initial subject grids.</p>
      </article>
      <article class="feature-card" style="border:1px solid #dde4ed; padding:24px; border-radius:8px; background:#fff;">
        <span style="font-size:24px; color:#d4a017;">🎓</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.2rem; color:#0a1628;">Upper School</h3>
        <p style="margin-top:10px; font-size:0.85rem; color:#64748b; line-height:1.6;">Exam preparation, leadership, advanced clubs, competitive sports, and highly disciplined academic focus.</p>
      </article>
      <article class="feature-card" style="border:1px solid #dde4ed; padding:24px; border-radius:8px; background:#fff;">
        <span style="font-size:24px; color:#d4a017;">🎓</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.2rem; color:#0a1628;">Advanced Level</h3>
        <p style="margin-top:10px; font-size:0.85rem; color:#64748b; line-height:1.6;">Dedicated learning pathways in Science, Technology, Commerce, and Arts for senior students preparing for university.</p>
      </article>
    </div>
  </div>
</section>`}),h.add("loyola-home-sports-gallery",{label:"Sports & Gallery",category:"Home Sections",media:'<svg viewBox="0 0 24 24"><path d="M22 16V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2zm-11-4l2.03 2.71L16 11l4 5H4l7-9zM2 20h20v2H2z"/></svg>',content:`<section class="home-sports-gallery-section" style="background:#fff; padding:80px 40px; border-t:1px solid #dde4ed;">
  <div class="container grid-2" style="gap:48px;">
    <div>
      <div style="display:flex; justify-content:between; align-items:center; margin-bottom:24px;">
        <h2 style="font-family:serif; font-size:2.2rem; color:#0a1628; margin:0;">Sports &amp; Clubs</h2>
        <a href="/sports-clubs" style="color:#b70f1b; font-weight:bold; text-decoration:none; font-size:0.9rem;">View All</a>
      </div>
      <div style="display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:12px;">
        <a href="/sports-clubs" style="padding:16px; border:1px solid #dde4ed; border-radius:8px; text-decoration:none; color:#0a1628; background:#f8fafc; font-weight:600; text-align:center; font-size:0.9rem; transition: transform 0.2s;">Media Unit</a>
        <a href="/sports-clubs" style="padding:16px; border:1px solid #dde4ed; border-radius:8px; text-decoration:none; color:#0a1628; background:#f8fafc; font-weight:600; text-align:center; font-size:0.9rem; transition: transform 0.2s;">Science Society</a>
        <a href="/sports-clubs" style="padding:16px; border:1px solid #dde4ed; border-radius:8px; text-decoration:none; color:#0a1628; background:#f8fafc; font-weight:600; text-align:center; font-size:0.9rem; transition: transform 0.2s;">ICT Society</a>
        <a href="/sports-clubs" style="padding:16px; border:1px solid #dde4ed; border-radius:8px; text-decoration:none; color:#0a1628; background:#f8fafc; font-weight:600; text-align:center; font-size:0.9rem; transition: transform 0.2s;">Prefects Board</a>
        <a href="/sports-clubs" style="padding:16px; border:1px solid #dde4ed; border-radius:8px; text-decoration:none; color:#0a1628; background:#f8fafc; font-weight:600; text-align:center; font-size:0.9rem; transition: transform 0.2s;">English Literary</a>
        <a href="/sports-clubs" style="padding:16px; border:1px solid #dde4ed; border-radius:8px; text-decoration:none; color:#0a1628; background:#f8fafc; font-weight:600; text-align:center; font-size:0.9rem; transition: transform 0.2s;">Religious Society</a>
      </div>
    </div>
    <div>
      <div style="display:flex; justify-content:between; align-items:center; margin-bottom:24px;">
        <h2 style="font-family:serif; font-size:2.2rem; color:#0a1628; margin:0;">Gallery Preview</h2>
        <a href="/gallery" style="color:#b70f1b; font-weight:bold; text-decoration:none; font-size:0.9rem;">Open Gallery</a>
      </div>
      <div style="display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:12px;">
        <img src="/loyola-crest.jpg" alt="Gallery photo" style="width:100%; aspect-ratio:1.33; object-fit:cover; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.08);" />
        <img src="/loyola-crest.jpg" alt="Gallery photo" style="width:100%; aspect-ratio:1.33; object-fit:cover; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.08);" />
        <img src="/loyola-crest.jpg" alt="Gallery photo" style="width:100%; aspect-ratio:1.33; object-fit:cover; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.08);" />
        <img src="/loyola-crest.jpg" alt="Gallery photo" style="width:100%; aspect-ratio:1.33; object-fit:cover; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.08);" />
      </div>
    </div>
  </div>
</section>`}),h.add("loyola-home-downloads-contact",{label:"Home Downloads",category:"Home Sections",media:'<svg viewBox="0 0 24 24"><path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>',content:`<section class="home-downloads-contact-section" style="padding:80px 40px; background:#f8fafc; border-t:1px solid #dde4ed;">
  <div class="container grid-[2fr_1fr]" style="gap:40px; display:grid; grid-template-columns: 2fr 1.2fr;">
    <div style="background:#0a1628; color:#fff; padding:40px; border-radius:12px; box-shadow:0 12px 30px rgba(10,22,40,0.15); display:flex; flex-direction:column; justify-content:center;">
      <p class="eyebrow" style="color:#f7d96b; font-size:12px; font-weight:800; letter-spacing:0.2em;">Downloads &amp; Notices</p>
      <h2 style="font-family:serif; font-size:2.5rem; font-weight:bold; margin-top:16px; color:#fff; line-height:1.2;">Important files in one place.</h2>
      <p style="margin-top:16px; color:rgba(255,255,255,0.75); font-size:0.95rem; line-height:1.6; max-width:600px;">Access official circulars, student timetables, application forms, academic calendars, notices, and essential school resources directly without navigating complex menus.</p>
      <a href="/downloads" style="align-self:start; margin-top:24px; background:#d4a017; color:#0a1628; font-weight:800; padding:12px 28px; border-radius:8px; text-decoration:none; display:inline-flex; align-items:center; gap:8px;">Open Downloads &rarr;</a>
    </div>
    <aside style="background:#fff; border:1px solid #dde4ed; padding:35px; border-radius:12px; box-shadow:0 4px 14px rgba(0,0,0,0.05); display:flex; flex-direction:column; justify-content:center;">
      <h2 style="font-family:serif; font-size:1.8rem; color:#0a1628; margin:0 0 20px;">Contact Office</h2>
      <div style="display:grid; gap:16px; font-size:0.9rem; color:#64748b;">
        <p style="margin:0; display:flex; gap:12px; align-items:start;"><span style="font-size:18px;">📍</span> <span>Loyola College, Negombo, Sri Lanka</span></p>
        <p style="margin:0; display:flex; gap:12px; align-items:start;"><span style="font-size:18px;">📞</span> <span>+94 31 222 2844</span></p>
        <p style="margin:0; display:flex; gap:12px; align-items:start;"><span style="font-size:18px;">✉️</span> <span>info@loyalacollegenegombo.com</span></p>
      </div>
      <a href="/contact" style="align-self:start; margin-top:28px; background:#0a1628; color:#fff; font-weight:800; padding:12px 24px; border-radius:8px; text-decoration:none; text-align:center;">Contact Office</a>
    </aside>
  </div>
</section>`}),h.add("loyola-team-cards",{label:"Team Cards",category:"Loyola Sections",media:'<svg viewBox="0 0 24 24"><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c.7-3.2 2.4-5 5-5s4.3 1.8 5 5M11 20c.7-3.2 2.4-5 5-5s4.3 1.8 5 5"/></svg>',content:'<section><div class="container"><p class="eyebrow">Leadership</p><h2 style="margin-top:12px;">Meet the team</h2><div class="team-grid" style="margin-top:28px;"><article class="team-card"><img src="/loyola-crest.jpg" alt="" /><div><h3>Staff name</h3><p>Role or department</p></div></article><article class="team-card"><img src="/loyola-crest.jpg" alt="" /><div><h3>Staff name</h3><p>Role or department</p></div></article><article class="team-card"><img src="/loyola-crest.jpg" alt="" /><div><h3>Staff name</h3><p>Role or department</p></div></article></div></div></section>'}),h.add("loyola-cta-banner",{label:"Call to Action",category:"Loyola Sections",media:'<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/><path d="M4 5h16v14H4z"/></svg>',content:'<section><div class="container cta-banner"><div style="position:relative;z-index:1;padding:42px;"><p class="eyebrow">Next step</p><h2 style="max-width:720px;margin-top:12px;">Invite families to connect with Loyola.</h2><p style="max-width:620px;margin-top:16px;">Use this banner for admissions, contact, events, or important announcements.</p><a class="btn gold" href="#" style="margin-top:24px;">Get started</a></div></div></section>'}),C.setComponents(t||qa),C.setStyle(a||""),c.current=C,setTimeout(()=>S(!1),200)}),()=>{D=!0,c.current&&(c.current.destroy(),c.current=null)}},[]);const K=()=>{c.current&&(d(c.current.getHtml(),c.current.getCss()??""),S(!1),T(x>0?"Saved page with uploaded media URLs.":"Saved page content."))},Z=()=>{b&&!window.confirm("You have unsaved changes. Close without saving?")||g()},U=(D,q)=>{c.current?.runCommand(D)},me=D=>{c.current?.setDevice(D.deviceName),p(D.id)},ge=()=>{c.current?.runCommand("open-assets")},M=D=>{Ve(D)&&(D.preventDefault(),A(!0))},J=D=>{Ve(D)&&(D.preventDefault(),D.dataTransfer.dropEffect="copy",A(!0))},oe=D=>{const q=D.relatedTarget;q&&D.currentTarget.contains(q)||A(!1)},ce=D=>{Ve(D)&&(D.preventDefault(),A(!1),se(D.dataTransfer.files))};return u?e.jsxs("div",{className:"visual-builder fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-[#0b1020] text-slate-100",children:[e.jsx(Gt,{className:"h-16 w-16 text-red-400"}),e.jsxs("div",{className:"text-center",children:[e.jsx("p",{className:"text-lg font-bold text-white",children:"Visual Builder failed to load"}),e.jsx("p",{className:"mt-2 max-w-md text-sm text-slate-400",children:u})]}),e.jsxs("button",{type:"button",onClick:g,className:"inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/20",children:[e.jsx(He,{className:"h-4 w-4"})," Close"]})]}):e.jsxs("div",{className:"visual-builder fixed inset-0 z-[200] flex flex-col bg-[#0b1020] text-slate-100",onDragEnter:M,onDragOver:J,onDragLeave:oe,onDrop:ce,children:[v&&e.jsxs("div",{className:"absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#0b1020]",children:[e.jsx(jt,{className:"h-10 w-10 animate-spin text-amber-300"}),e.jsxs("div",{className:"text-center",children:[e.jsx("p",{className:"text-sm font-bold text-white",children:"Loading Visual Builder"}),e.jsx("p",{className:"mt-1 text-xs text-slate-400",children:"Initializing GrapesJS editor..."})]})]}),e.jsxs("header",{className:"flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#10172a] px-4",children:[e.jsxs("div",{className:"flex min-w-0 items-center gap-3",children:[e.jsx("button",{type:"button",onClick:Z,className:"inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white",title:"Close builder",children:e.jsx(He,{className:"h-4 w-4"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300",children:"Loyola Digital Studio"}),e.jsxs("h2",{className:"truncate text-sm font-extrabold text-white",children:["Visual Website Builder",b&&e.jsxs("span",{className:"ml-2 inline-flex items-center gap-1 text-[10px] font-normal text-amber-400",children:[e.jsx("span",{className:"h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"}),"unsaved"]})]})]})]}),e.jsx("div",{className:"hidden min-w-0 flex-1 justify-center px-3 xl:flex",children:z?e.jsxs("div",{className:"flex min-w-0 max-w-md items-center gap-3 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-emerald-100",children:[z.kind==="image"?e.jsx("img",{src:z.url,alt:"",className:"h-8 w-10 rounded object-cover ring-1 ring-white/10"}):e.jsx("span",{className:"grid h-8 w-10 place-items-center rounded bg-white/10",children:e.jsx(le,{className:"h-4 w-4"})}),e.jsx(je,{className:"h-4 w-4 shrink-0 text-emerald-300"}),e.jsxs("div",{className:"min-w-0",children:[e.jsxs("p",{className:"truncate text-xs font-black",children:["Uploaded ",z.name]}),e.jsx("p",{className:"truncate text-[10px] text-emerald-100/70",children:L||"Save Page to keep this media in the page HTML."})]})]}):L?e.jsxs("div",{className:"inline-flex items-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-100",children:[e.jsx(je,{className:"h-4 w-4 text-amber-300"}),L]}):null}),e.jsx("div",{className:"hidden items-center gap-1 rounded-md border border-white/10 bg-white/5 p-1 md:flex",children:Wa.map(D=>{const q=D.icon,ee=m===D.id;return e.jsx("button",{type:"button",title:D.label,onClick:()=>me(D),className:`inline-flex h-8 w-9 items-center justify-center rounded text-slate-300 transition hover:bg-white/10 hover:text-white ${ee?"bg-amber-300/20 text-amber-300 ring-1 ring-amber-300/50":""}`,children:e.jsx(q,{className:"h-4 w-4"})},D.id)})}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("button",{type:"button",onClick:()=>U("preview"),title:"Preview",className:"inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white",children:e.jsx(Le,{className:"h-4 w-4"})}),e.jsx("button",{type:"button",onClick:()=>U("core:undo"),title:"Undo",className:"inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white",children:e.jsx(Jt,{className:"h-4 w-4"})}),e.jsx("button",{type:"button",onClick:()=>U("core:redo"),title:"Redo",className:"inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white",children:e.jsx(Kt,{className:"h-4 w-4"})}),e.jsx("button",{type:"button",onClick:ge,title:"Upload image or asset",className:"inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white",children:e.jsx(Qt,{className:"h-4 w-4"})}),e.jsxs("button",{type:"button",onClick:K,className:"inline-flex h-9 items-center justify-center gap-2 rounded-md bg-amber-300 px-4 text-xs font-black text-[#08286f] shadow-[0_12px_28px_-18px_rgba(252,211,77,.9)] transition hover:bg-amber-200",children:[e.jsx(Ke,{className:"h-4 w-4"}),"Save Page"]})]})]}),e.jsxs("div",{className:"grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)_300px]",children:[e.jsxs("aside",{className:"flex min-h-0 flex-col border-r border-white/10 bg-[#111827]",children:[e.jsx(Ja,{icon:Nt,title:"Elements"}),e.jsx("div",{ref:O,className:"visual-builder-blocks min-h-0 flex-1 overflow-y-auto"})]}),e.jsxs("main",{className:"relative min-h-0 bg-[#090d18]",children:[f&&e.jsx("div",{className:"pointer-events-none absolute inset-4 z-20 grid place-items-center rounded-xl border-2 border-dashed border-amber-300 bg-[#0b1020]/72 text-center shadow-[0_24px_70px_-40px_rgba(0,0,0,.9)] backdrop-blur-sm",children:e.jsxs("div",{children:[e.jsx(le,{className:"mx-auto h-9 w-9 text-amber-300"}),e.jsx("p",{className:"mt-3 text-sm font-black text-white",children:"Drop files to upload"}),e.jsx("p",{className:"mt-1 text-xs text-slate-300",children:"JPG, PNG, MP4, MOV, and WebM are added to the Asset Manager."})]})}),e.jsx("div",{ref:_,className:"h-full w-full"})]}),e.jsx(Ka,{stylesRef:G,traitsRef:ie,layersRef:ae})]}),e.jsx(Qa,{})]})}function Ja({icon:t,title:a}){return e.jsxs("div",{className:"flex h-12 shrink-0 items-center gap-2 border-b border-white/10 px-4",children:[e.jsx(t,{className:"h-4 w-4 text-amber-300"}),e.jsx("span",{className:"text-[11px] font-black uppercase tracking-[0.18em] text-slate-300",children:a})]})}function Ka({stylesRef:t,traitsRef:a,layersRef:s}){const[d,g]=Xt.useState("style"),c=[{id:"style",label:"Style",icon:Zt},{id:"traits",label:"Settings",icon:ea},{id:"layers",label:"Layers",icon:ta}];return e.jsxs("aside",{className:"flex min-h-0 flex-col border-l border-white/10 bg-[#111827]",children:[e.jsx("div",{className:"grid h-12 shrink-0 grid-cols-3 border-b border-white/10 p-1",children:c.map(v=>{const N=v.icon,u=d===v.id;return e.jsxs("button",{type:"button",onClick:()=>g(v.id),className:`inline-flex items-center justify-center gap-1.5 rounded text-[11px] font-bold transition ${u?"bg-white/10 text-white":"text-slate-400 hover:bg-white/5 hover:text-white"}`,children:[e.jsx(N,{className:"h-3.5 w-3.5"}),v.label]},v.id)})}),e.jsxs("div",{className:"min-h-0 flex-1 overflow-y-auto",children:[e.jsx("div",{ref:t,style:{display:d==="style"?"block":"none"}}),e.jsx("div",{ref:a,style:{display:d==="traits"?"block":"none"}}),e.jsx("div",{ref:s,style:{display:d==="layers"?"block":"none"}})]})]})}function Qa(){return e.jsx("style",{children:`
      .visual-builder .gjs-one-bg,
      .visual-builder .gjs-two-color,
      .visual-builder .gjs-three-bg,
      .visual-builder .gjs-four-color {
        color: inherit;
      }

      .visual-builder .gjs-editor {
        background: #090d18;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }

      .visual-builder .gjs-cv-canvas {
        inset: 0;
        width: 100%;
        height: 100%;
        background:
          linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px),
          #090d18 !important;
        background-size: 28px 28px;
        overflow: auto;
      }

      .visual-builder .gjs-frame-wrapper {
        margin: 34px auto;
        border-radius: 10px;
        box-shadow: 0 30px 80px -42px rgba(0,0,0,.95);
      }

      .visual-builder .gjs-frame {
        border-radius: 10px;
        background: #fff;
      }

      .visual-builder .gjs-cv-canvas__frames {
        padding: 0 34px 34px;
      }

      .visual-builder .gjs-block-categories {
        padding: 10px;
      }

      .visual-builder .gjs-blocks-c {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        padding: 8px 0 12px;
      }

      .visual-builder .gjs-block {
        min-height: 78px;
        width: auto;
        margin: 0;
        padding: 10px 8px;
        border: 1px solid rgba(148,163,184,.2);
        border-radius: 8px;
        background: rgba(255,255,255,.045);
        color: rgba(226,232,240,.86);
        box-shadow: none;
        cursor: grab;
        font-size: 11px;
        font-weight: 800;
        transition: background-color .16s ease, border-color .16s ease, transform .16s ease;
      }

      .visual-builder .gjs-block:hover {
        border-color: rgba(252,211,77,.72);
        background: rgba(252,211,77,.13);
        color: #fff;
        transform: translateY(-1px);
      }

      .visual-builder .gjs-block:active {
        cursor: grabbing;
      }

      .visual-builder .gjs-block__media {
        display: flex;
        height: 28px;
        align-items: center;
        justify-content: center;
        margin: 0 0 6px;
        color: #fcd34d;
        overflow: hidden;
      }

      .visual-builder .gjs-block__media svg,
      .visual-builder .gjs-block svg {
        width: 24px !important;
        height: 24px !important;
        max-width: 24px !important;
        max-height: 24px !important;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
      }

      .visual-builder .gjs-block-label {
        padding: 0;
        line-height: 1.25;
      }

      .visual-builder .gjs-block-category {
        border: 0;
      }

      .visual-builder .gjs-block-category .gjs-title,
      .visual-builder .gjs-sm-sector-title {
        display: flex;
        align-items: center;
        min-height: 34px;
        border: 0;
        background: transparent;
        color: rgba(203,213,225,.58);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .18em;
        text-transform: uppercase;
      }

      .visual-builder .gjs-block-category .gjs-title:hover,
      .visual-builder .gjs-sm-sector-title:hover {
        color: #fff;
        background: rgba(255,255,255,.04);
      }

      .visual-builder .gjs-sm-sector {
        border: 0;
        border-bottom: 1px solid rgba(255,255,255,.08);
        background: transparent;
      }

      .visual-builder .gjs-sm-properties,
      .visual-builder .gjs-trt-traits {
        padding: 10px 12px 14px;
      }

      .visual-builder .gjs-sm-property {
        margin-bottom: 8px;
      }

      .visual-builder .gjs-sm-label,
      .visual-builder .gjs-label,
      .visual-builder .gjs-clm-tags #gjs-clm-label {
        color: rgba(203,213,225,.7);
        font-size: 11px;
        font-weight: 700;
      }

      .visual-builder .gjs-field,
      .visual-builder .gjs-sm-field,
      .visual-builder .gjs-clm-tags,
      .visual-builder .gjs-trt-trait input,
      .visual-builder .gjs-trt-trait select,
      .visual-builder .gjs-sm-field input,
      .visual-builder .gjs-sm-field select {
        border: 1px solid rgba(148,163,184,.22) !important;
        border-radius: 7px;
        background: rgba(15,23,42,.72) !important;
        color: #f8fafc !important;
        box-shadow: none;
      }

      .visual-builder .gjs-field input,
      .visual-builder .gjs-field select,
      .visual-builder .gjs-sm-field input,
      .visual-builder .gjs-sm-field select {
        min-height: 30px;
        color: #f8fafc !important;
        font-size: 12px;
      }

      .visual-builder .gjs-field:focus-within,
      .visual-builder .gjs-sm-field:focus-within {
        border-color: rgba(252,211,77,.75) !important;
      }

      .visual-builder .gjs-layer {
        border-bottom: 1px solid rgba(255,255,255,.06);
        background: transparent;
      }

      .visual-builder .gjs-layer__item {
        padding: 8px 12px;
        color: rgba(226,232,240,.8);
      }

      .visual-builder .gjs-layer__item:hover {
        background: rgba(255,255,255,.06);
      }

      .visual-builder .gjs-layer.gjs-selected > .gjs-layer__item {
        background: rgba(252,211,77,.14);
        color: #fff;
      }

      .visual-builder .gjs-selected {
        outline: 2px solid #f59e0b !important;
        outline-offset: -2px;
      }

      .visual-builder .gjs-hovered {
        outline: 1px dashed rgba(245,158,11,.7) !important;
        outline-offset: -1px;
      }

      .visual-builder .gjs-toolbar {
        gap: 2px;
        border-radius: 7px;
        background: #08286f;
        padding: 3px;
        box-shadow: 0 14px 28px -18px rgba(8,40,111,.9);
      }

      .visual-builder .gjs-toolbar-item {
        display: inline-flex;
        width: 26px;
        height: 26px;
        align-items: center;
        justify-content: center;
        border-radius: 5px;
        color: #fff !important;
        font-size: 14px;
        line-height: 1;
      }

      .visual-builder .gjs-toolbar-item:hover {
        background: rgba(255,255,255,.14);
      }

      .visual-builder .gjs-rte-toolbar {
        border-radius: 8px;
        background: #111827;
        box-shadow: 0 20px 44px -26px rgba(0,0,0,.9);
      }

      .visual-builder .gjs-rte-action {
        color: #e2e8f0;
      }

      .visual-builder .gjs-mdl-dialog {
        overflow: hidden;
        border: 1px solid rgba(148,163,184,.2);
        border-radius: 10px;
        background: #111827;
        color: #e2e8f0;
        box-shadow: 0 34px 90px -42px rgba(0,0,0,.95);
      }

      .visual-builder .gjs-mdl-header {
        border-bottom: 1px solid rgba(255,255,255,.08);
        background: rgba(15,23,42,.82);
        color: #fff;
        font-weight: 900;
      }

      .visual-builder .gjs-mdl-content {
        background: #111827;
      }

      .visual-builder .gjs-am-file-uploader {
        border: 1px dashed rgba(252,211,77,.48);
        border-radius: 10px;
        background: rgba(252,211,77,.08);
        color: #e2e8f0;
      }

      .visual-builder .gjs-am-assets {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
        gap: 10px;
      }

      .visual-builder .gjs-am-asset {
        width: auto;
        margin: 0;
        overflow: hidden;
        border: 1px solid rgba(148,163,184,.18);
        border-radius: 8px;
        background: rgba(255,255,255,.045);
        box-shadow: none;
        transition: transform .16s ease, border-color .16s ease, background-color .16s ease;
      }

      .visual-builder .gjs-am-asset:hover {
        border-color: rgba(252,211,77,.72);
        background: rgba(252,211,77,.11);
        transform: translateY(-2px);
      }

      .visual-builder .gjs-am-preview-cont {
        background: rgba(15,23,42,.8);
      }

      .visual-builder .gjs-am-name {
        color: rgba(226,232,240,.82);
        font-size: 11px;
        font-weight: 800;
      }

      .visual-builder .gjs-btn-prim,
      .visual-builder .gjs-am-add-asset button {
        border: 0 !important;
        border-radius: 7px;
        background: #fcd34d !important;
        color: #08286f !important;
        font-weight: 900;
      }

      .visual-builder .gjs-badge,
      .visual-builder .gjs-placeholder,
      .visual-builder .gjs-com-badge {
        background: #f59e0b;
        color: #08286f;
      }

      .visual-builder ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      .visual-builder ::-webkit-scrollbar-track {
        background: transparent;
      }

      .visual-builder ::-webkit-scrollbar-thumb {
        border-radius: 8px;
        background: rgba(148,163,184,.26);
      }

      .visual-builder ::-webkit-scrollbar-thumb:hover {
        background: rgba(148,163,184,.42);
      }

      @media (max-width: 980px) {
        .visual-builder {
          min-width: 980px;
        }
      }
    `})}const Lt=["image/jpeg","image/png"],Xa=["video/mp4","video/quicktime","video/webm"],Za=5*1024*1024,es=500*1024*1024;function Ye(t){return t<1024?`${t} B`:t<1024*1024?`${(t/1024).toFixed(1)} KB`:`${(t/1024/1024).toFixed(1)} MB`}function dt(t){const a=t.filter(c=>!c.parentId).sort((c,v)=>c.order-v.order),s=[];for(const c of a){s.push(c);const v=t.filter(N=>N.parentId===c.id).sort((N,u)=>N.order-u.order);s.push(...v)}const d=new Set(s.map(c=>c.id)),g=t.filter(c=>!d.has(c.id)).sort((c,v)=>c.order-v.order);return s.push(...g),s}function ct(t,a){const s=new Set([a]),d=[a];for(;d.length;){const g=d.shift();t.filter(c=>c.parentId===g).forEach(c=>{s.has(c.id)||(s.add(c.id),d.push(c.id))})}return s}async function $t(t){if(!Lt.includes(t.type))throw new Error("Only JPG and PNG images are allowed.");if(t.size>Za)throw new Error("Image is too large. Maximum size is 5 MB.");const a=URL.createObjectURL(t),s=new Image;s.src=a,await new Promise((u,w)=>{s.onload=()=>u(),s.onerror=()=>w(new Error("Could not read image."))});const g=Math.min(1,1600/s.width),c=document.createElement("canvas");c.width=Math.max(1,Math.round(s.width*g)),c.height=Math.max(1,Math.round(s.height*g));const v=c.getContext("2d");if(!v)throw new Error("Image optimizer is not available in this browser.");v.drawImage(s,0,0,c.width,c.height),URL.revokeObjectURL(a);const N=c.toDataURL("image/png");return{url:N,original:Ye(t.size),optimized:Ye(Math.round(N.length*3/4))}}async function ts(t){if(Lt.includes(t.type)){const a=await $t(t);try{return{url:await xe("site-background",t),type:"image",message:`Background image optimized and uploaded: ${a.original} to ${a.optimized}`}}catch(s){if(ue(s))throw s}return{url:a.url,type:"image",message:`Background image optimized for local preview: ${a.original} to ${a.optimized}`}}if(!Xa.includes(t.type))throw new Error("Only JPG, PNG, MP4, MOV, and WebM files are allowed.");if(t.size>es)throw new Error("Video is too large. Maximum video upload is 500 MB.");try{return{url:await xe("site-background",t),type:"video",message:`Background video uploaded: ${Ye(t.size)}`}}catch(a){throw ue(a)?a:new Error(a instanceof Error?a.message:"Video upload needs the Node.js backend. Keep the backend running, or use a YouTube link for large videos.")}}function he({label:t,children:a,hint:s}){return e.jsxs("label",{className:"block",children:[e.jsx("span",{className:"text-xs font-black uppercase tracking-[0.18em] text-slate-500",children:t}),e.jsx("div",{className:"mt-2",children:a}),s&&e.jsx("span",{className:"mt-1 block text-xs leading-5 text-slate-500",children:s})]})}function de({children:t,onClick:a,tone:s="light",disabled:d=!1}){const g=s==="gold"?"relative overflow-hidden bg-gradient-to-r from-[#d4a017] to-[#f7c948] text-[#0a1628] shadow-[0_4px_20px_-4px_rgba(212,160,23,0.55)] hover:shadow-[0_6px_28px_-4px_rgba(212,160,23,0.7)] hover:scale-[1.03] active:scale-[0.97]":s==="dark"?"bg-gradient-to-r from-[#0a1628] to-[#1e3560] text-white shadow-[0_4px_16px_-4px_rgba(10,22,40,0.4)] hover:shadow-[0_6px_22px_-4px_rgba(10,22,40,0.55)] hover:scale-[1.03] active:scale-[0.97]":"border border-slate-200 bg-white/90 text-navy shadow-sm backdrop-blur-sm hover:bg-slate-50 hover:border-slate-300 hover:scale-[1.02] active:scale-[0.98]";return e.jsx("button",{type:"button",onClick:a,disabled:d,className:`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-50 disabled:scale-100 ${g}`,children:t})}function Pe(t){return t.split("/").pop().replaceAll("-"," ")}function as(t){return t==="home"?"/":`/${t}`}function ne(t){return String(t||"").replace(/[&<>"']/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[a]||a)}function It(){return`<section class="home-hero-section" style="position:relative; background:#0a1628; color:#fff; overflow:hidden; padding:80px 40px; min-height:85vh; display:flex; align-items:center;">
  <div style="position:absolute; inset:0; opacity:0.3; background-image:radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px); background-size:24px 24px;"></div>
  <div class="container grid-2" style="position:relative; z-index:2; align-items:center; gap:40px;">
    <div>
      <span class="gold-divider" style="margin-bottom:20px;"></span>
      <p class="eyebrow" style="color:#f7d96b; font-size:12px; font-weight:800; letter-spacing:0.24em; text-transform:uppercase;">Loyola College Negombo</p>
      <h1 style="font-family:serif; font-size:clamp(2.5rem, 5vw, 4.5rem); line-height:1.1; font-weight:bold; margin-top:20px; color:#fff;">A Tradition of Excellence.<br/>A Future of Innovation.</h1>
      <p style="margin-top:20px; font-size:1.1rem; color:rgba(255,255,255,0.85); max-width:600px; line-height:1.6;">Veritate ad Lumen et Vitam. Providing premium education, character formation, and holistic development for generations.</p>
      <div style="margin-top:30px; display:flex; flex-wrap:wrap; gap:16px;">
        <a class="btn gold" href="/about" style="background:#d4a017; color:#0a1628; padding:12px 28px; border-radius:8px; font-weight:800; text-decoration:none; display:inline-flex; align-items:center; gap:8px;">Explore College &rarr;</a>
        <a class="btn" href="/news" style="background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.2); padding:12px 28px; border-radius:8px; font-weight:800; text-decoration:none;">View Notices</a>
      </div>
    </div>
    <aside style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:12px; padding:30px; backdrop-filter:blur(10px);">
      <h3 style="font-family:serif; font-size:1.35rem; font-weight:bold; color:#fff; margin-bottom:20px;">Loyola Quick Access</h3>
      <div style="display:grid; gap:12px;">
        <a href="/portal" style="display:flex; align-items:center; gap:16px; padding:14px; background:rgba(255,255,255,0.08); border-radius:8px; text-decoration:none; color:#fff; transition: background 0.2s;">
          <span style="font-size:24px; color:#f7d96b;">🔐</span>
          <div>
            <strong style="display:block; font-size:14px;">Portal Login</strong>
            <span style="font-size:11px; color:rgba(255,255,255,0.6);">Secure sign-in for school portals</span>
          </div>
        </a>
        <a href="/downloads" style="display:flex; align-items:center; gap:16px; padding:14px; background:rgba(255,255,255,0.08); border-radius:8px; text-decoration:none; color:#fff; transition: background 0.2s;">
          <span style="font-size:24px; color:#f7d96b;">📁</span>
          <div>
            <strong style="display:block; font-size:14px;">Downloads &amp; Forms</strong>
            <span style="font-size:11px; color:rgba(255,255,255,0.6);">Circulars, syllabuses, and files</span>
          </div>
        </a>
        <a href="/about/college-staff" style="display:flex; align-items:center; gap:16px; padding:14px; background:rgba(255,255,255,0.08); border-radius:8px; text-decoration:none; color:#fff; transition: background 0.2s;">
          <span style="font-size:24px; color:#f7d96b;">🎓</span>
          <div>
            <strong style="display:block; font-size:14px;">Academic Staff</strong>
            <span style="font-size:11px; color:rgba(255,255,255,0.6);">Our rector, administration, and faculty</span>
          </div>
        </a>
      </div>
    </aside>
  </div>
</section>

<section class="home-about-section">
  <div class="container home-about-grid">
    <div>
      <p class="eyebrow">About Our College</p>
      <h2 style="margin-top:12px;">Loyola College Negombo.</h2>
      <p style="margin-top:18px; line-height:1.6; color:#546179;">Founded with a rich legacy of spiritual, intellectual, and physical excellence, Loyola College has stood as a beacon of education, preparing students to serve with leadership, integrity, and truth.</p>
      <a class="btn" href="/about" style="margin-top:24px; text-decoration:none;">More Details</a>
    </div>
    <div class="home-stat-grid">
      <article class="stat-tile"><strong>2,500+</strong><span>Active Students</span></article>
      <article class="stat-tile"><strong>110+</strong><span>Academic Staff</span></article>
      <article class="stat-tile"><strong>1993</strong><span>Established</span></article>
      <article class="stat-tile"><strong>25+</strong><span>Clubs &amp; Sports</span></article>
    </div>
  </div>
</section>

<section class="home-pillars-section" style="background:#f8fafc; padding:80px 40px; border-y:1px solid #dde4ed;">
  <div class="container">
    <div style="text-align:center; max-width:800px; margin:0 auto 50px;">
      <p class="eyebrow" style="color:#b70f1b;">Our Core Approach</p>
      <h2 style="margin-top:12px; font-family:serif; font-size:2.5rem; color:#0a1628;">A Foundation of Excellence</h2>
      <p style="margin-top:16px; color:#64748b; line-height:1.6;">We nurture our students through balanced education systems designed to foster deep technical expertise, robust physical capabilities, and strong moral values.</p>
    </div>
    <div class="grid-3" style="gap:24px;">
      <article class="feature-card" style="background:#fff; border:1px solid #dde4ed; padding:30px; border-radius:8px;">
        <span style="font-size:32px;">🧠</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.35rem; color:#0a1628;">Academic Rigor</h3>
        <p style="margin-top:12px; font-size:0.9rem; color:#64748b; line-height:1.6;">Modern curricula focusing on science, technology, mathematics, commerce, and humanities to prepare students for international pathways.</p>
      </article>
      <article class="feature-card" style="background:#fff; border:1px solid #dde4ed; padding:30px; border-radius:8px;">
        <span style="font-size:32px;">⛪</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.35rem; color:#0a1628;">Character Formation</h3>
        <p style="margin-top:12px; font-size:0.9rem; color:#64748b; line-height:1.6;">Character guidance built upon Christian principles, respect, self-discipline, and compassion to raise upright citizens.</p>
      </article>
      <article class="feature-card" style="background:#fff; border:1px solid #dde4ed; padding:30px; border-radius:8px;">
        <span style="font-size:32px;">🏆</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.35rem; color:#0a1628;">Co-Curricular Growth</h3>
        <p style="margin-top:12px; font-size:0.9rem; color:#64748b; line-height:1.6;">Vibrant athletics, clubs, and societies, offering sports, music, drama, coding, and environmental exploration.</p>
      </article>
    </div>
  </div>
</section>

<section class="home-rector-section">
  <div class="container home-rector-grid">
    <figure class="home-rector-photo">
      <img src="/loyola-crest.jpg" alt="Rector portrait placeholder" />
    </figure>
    <article class="home-rector-message">
      <p class="eyebrow">Rector's Message</p>
      <h2 style="margin-top:12px;">Welcome to Our Digital Space.</h2>
      <p style="margin-top:18px; line-height:1.6; color:#546179;">Dear teachers, students, parents, and alumni, I welcome you warmly to Loyola College Negombo. Our mission is to raise children of truth, who discover light and life through learning, compassion, and spiritual strength.</p>
      <p style="margin-top:14px; line-height:1.6; color:#546179;">We aim to ensure that every student who leaves our gates is equipped with both academic excellence and a strong moral character to face the modern world's challenges.</p>
      <p class="home-signature">Rev. Fr. D.M.J. Kennedy Perera<br /><span>Rector, Loyola College</span></p>
    </article>
  </div>
</section>

<section class="home-leadership-section" style="background:#f8fafc; padding:80px 40px;">
  <div class="container">
    <div class="home-section-heading" style="text-align:center; max-width:800px; margin:0 auto 50px;">
      <p class="eyebrow">Administration Board</p>
      <h2 style="margin-top:12px; font-family:serif; font-size:2.5rem; color:#0a1628;">College Leadership</h2>
      <p style="margin-top:16px; color:#64748b; line-height:1.6;">The administration board steering Loyola College's legacy and future directions.</p>
    </div>
    <div class="leadership-grid" style="margin-top:32px;">
      <article class="leadership-card">
        <img src="/loyola-crest.jpg" alt="Rector" />
        <div style="padding:20px;">
          <h3 style="font-family:serif; font-size:1.25rem; font-weight:bold; color:#0a1628; margin:0;">Rev. Fr. Kennedy Perera</h3>
          <span style="display:block; width:40px; height:2px; background:#d4a017; margin:10px auto;"></span>
          <p style="margin:10px 0 0; font-size:0.85rem; color:#64748b; font-weight:bold; text-transform:uppercase;">Rector</p>
        </div>
      </article>
      <article class="leadership-card">
        <img src="/loyola-crest.jpg" alt="Vice Principal" />
        <div style="padding:20px;">
          <h3 style="font-family:serif; font-size:1.25rem; font-weight:bold; color:#0a1628; margin:0;">Rev. Fr. Suranga Niroshan</h3>
          <span style="display:block; width:40px; height:2px; background:#d4a017; margin:10px auto;"></span>
          <p style="margin:10px 0 0; font-size:0.85rem; color:#64748b; font-weight:bold; text-transform:uppercase;">Vice Principal</p>
        </div>
      </article>
      <article class="leadership-card">
        <img src="/loyola-crest.jpg" alt="Sectional Head" />
        <div style="padding:20px;">
          <h3 style="font-family:serif; font-size:1.25rem; font-weight:bold; color:#0a1628; margin:0;">Mrs. Nimali Fernando</h3>
          <span style="display:block; width:40px; height:2px; background:#d4a017; margin:10px auto;"></span>
          <p style="margin:10px 0 0; font-size:0.85rem; color:#64748b; font-weight:bold; text-transform:uppercase;">Primary Section Head</p>
        </div>
      </article>
      <article class="leadership-card">
        <img src="/loyola-crest.jpg" alt="Senior Master" />
        <div style="padding:20px;">
          <h3 style="font-family:serif; font-size:1.25rem; font-weight:bold; color:#0a1628; margin:0;">Mr. Samantha Silva</h3>
          <span style="display:block; width:40px; height:2px; background:#d4a017; margin:10px auto;"></span>
          <p style="margin:10px 0 0; font-size:0.85rem; color:#64748b; font-weight:bold; text-transform:uppercase;">Senior Section Head</p>
        </div>
      </article>
    </div>
  </div>
</section>

<section class="home-vision-mission-section" style="background:#082766; color:#fff; padding:80px 40px; position:relative; overflow:hidden;">
  <div style="position:absolute; inset:0; opacity:0.08; background-image:linear-gradient(135deg,transparent 0,transparent 24px,#fff 25px,transparent 26px),linear-gradient(45deg,transparent 0,transparent 28px,#fff 29px,transparent 30px); background-size:120px_120px;"></div>
  <div class="container grid-2" style="position:relative; z-index:2; align-items:center; gap:48px;">
    <div>
      <p class="eyebrow" style="color:#fff1a8; font-size:12px; font-weight:800; letter-spacing:0.24em;">Loyola Identity</p>
      <h2 style="font-family:serif; font-size:2.8rem; font-weight:bold; margin-top:16px; color:#fff; line-height:1.2;">Welcome to Loyola College</h2>
      <div style="margin-top:40px; display:grid; gap:30px;">
        <div>
          <h3 style="font-size:1.5rem; font-weight:bold; color:#fff1a8;">Our Vision</h3>
          <p style="margin-top:10px; color:rgba(255,255,255,0.8); line-height:1.6; font-size:0.95rem;">To announce God's Kingdom through Christian values, offering integral education and human guidelines.</p>
        </div>
        <div>
          <h3 style="font-size:1.5rem; font-weight:bold; color:#fff1a8;">Mission Statement</h3>
          <div style="margin-top:16px; display:grid; gap:12px;">
            <p style="display:flex; gap:12px; align-items:start; margin:0; color:rgba(255,255,255,0.8); font-size:0.95rem;">
              <span style="color:#fff1a8; font-weight:bold;">&check;</span>
              <span>To aim at integral education of body, mind, and spirit through service and leadership.</span>
            </p>
            <p style="display:flex; gap:12px; align-items:start; margin:0; color:rgba(255,255,255,0.8); font-size:0.95rem;">
              <span style="color:#fff1a8; font-weight:bold;">&check;</span>
              <span>To strive to form citizens of upright character who pursue excellence in every sphere.</span>
            </p>
            <p style="display:flex; gap:12px; align-items:start; margin:0; color:rgba(255,255,255,0.8); font-size:0.95rem;">
              <span style="color:#fff1a8; font-weight:bold;">&check;</span>
              <span>To promote character formation based on human and religious values.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
    <aside style="background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); max-width:480px; margin:0 auto;">
      <div style="aspect-ratio:1.6; background:#000;">
        <img src="/flag1.png" alt="Loyola Flag" style="width:100%; height:100%; object-fit:contain; background:#fff;" />
      </div>
      <div style="padding:30px; text-align:center; background:#fff;">
        <p style="font-family:serif; font-size:1.5rem; font-weight:bold; color:#0a1628; margin:0;">Veritate Ad Lumen Et Vitam</p>
        <p style="margin:8px 0 0; font-size:0.85rem; color:#64748b; font-weight:bold;">In Truth to Light and Life</p>
      </div>
    </aside>
  </div>
</section>

<section class="home-academics-section" style="padding:80px 40px;">
  <div class="container">
    <div style="display:flex; justify-content:between; align-items:end; flex-wrap:wrap; gap:20px; margin-bottom:40px;">
      <div>
        <p class="eyebrow" style="color:#b70f1b;">Academics</p>
        <h2 style="margin-top:12px; font-family:serif; font-size:2.5rem; color:#0a1628; margin:0;">Academic pathways for every stage.</h2>
      </div>
      <a href="/academics" style="color:#b70f1b; font-weight:bold; text-decoration:none; font-size:0.95rem;">Academics Overview &rarr;</a>
    </div>
    <div class="grid-4" style="gap:20px;">
      <article class="feature-card" style="border:1px solid #dde4ed; padding:24px; border-radius:8px; background:#fff;">
        <span style="font-size:24px; color:#d4a017;">🎓</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.2rem; color:#0a1628;">Primary Section</h3>
        <p style="margin-top:10px; font-size:0.85rem; color:#64748b; line-height:1.6;">Foundational learning, basic language development, religious values, and classroom confidence.</p>
      </article>
      <article class="feature-card" style="border:1px solid #dde4ed; padding:24px; border-radius:8px; background:#fff;">
        <span style="font-size:24px; color:#d4a017;">🎓</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.2rem; color:#0a1628;">Middle School</h3>
        <p style="margin-top:10px; font-size:0.85rem; color:#64748b; line-height:1.6;">Structured study habits, co-curricular exploration, personal character formation, and initial subject grids.</p>
      </article>
      <article class="feature-card" style="border:1px solid #dde4ed; padding:24px; border-radius:8px; background:#fff;">
        <span style="font-size:24px; color:#d4a017;">🎓</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.2rem; color:#0a1628;">Upper School</h3>
        <p style="margin-top:10px; font-size:0.85rem; color:#64748b; line-height:1.6;">Exam preparation, leadership, advanced clubs, competitive sports, and highly disciplined academic focus.</p>
      </article>
      <article class="feature-card" style="border:1px solid #dde4ed; padding:24px; border-radius:8px; background:#fff;">
        <span style="font-size:24px; color:#d4a017;">🎓</span>
        <h3 style="margin-top:16px; font-family:serif; font-size:1.2rem; color:#0a1628;">Advanced Level</h3>
        <p style="margin-top:10px; font-size:0.85rem; color:#64748b; line-height:1.6;">Dedicated learning pathways in Science, Technology, Commerce, and Arts for senior students preparing for university.</p>
      </article>
    </div>
  </div>
</section>

<section class="home-sports-gallery-section" style="background:#fff; padding:80px 40px; border-t:1px solid #dde4ed;">
  <div class="container grid-2" style="gap:48px;">
    <div>
      <div style="display:flex; justify-content:between; align-items:center; margin-bottom:24px;">
        <h2 style="font-family:serif; font-size:2.2rem; color:#0a1628; margin:0;">Sports &amp; Clubs</h2>
        <a href="/sports-clubs" style="color:#b70f1b; font-weight:bold; text-decoration:none; font-size:0.9rem;">View All</a>
      </div>
      <div style="display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:12px;">
        <a href="/sports-clubs" style="padding:16px; border:1px solid #dde4ed; border-radius:8px; text-decoration:none; color:#0a1628; background:#f8fafc; font-weight:600; text-align:center; font-size:0.9rem; transition: transform 0.2s;">Media Unit</a>
        <a href="/sports-clubs" style="padding:16px; border:1px solid #dde4ed; border-radius:8px; text-decoration:none; color:#0a1628; background:#f8fafc; font-weight:600; text-align:center; font-size:0.9rem; transition: transform 0.2s;">Science Society</a>
        <a href="/sports-clubs" style="padding:16px; border:1px solid #dde4ed; border-radius:8px; text-decoration:none; color:#0a1628; background:#f8fafc; font-weight:600; text-align:center; font-size:0.9rem; transition: transform 0.2s;">ICT Society</a>
        <a href="/sports-clubs" style="padding:16px; border:1px solid #dde4ed; border-radius:8px; text-decoration:none; color:#0a1628; background:#f8fafc; font-weight:600; text-align:center; font-size:0.9rem; transition: transform 0.2s;">Prefects Board</a>
        <a href="/sports-clubs" style="padding:16px; border:1px solid #dde4ed; border-radius:8px; text-decoration:none; color:#0a1628; background:#f8fafc; font-weight:600; text-align:center; font-size:0.9rem; transition: transform 0.2s;">English Literary</a>
        <a href="/sports-clubs" style="padding:16px; border:1px solid #dde4ed; border-radius:8px; text-decoration:none; color:#0a1628; background:#f8fafc; font-weight:600; text-align:center; font-size:0.9rem; transition: transform 0.2s;">Religious Society</a>
      </div>
    </div>
    <div>
      <div style="display:flex; justify-content:between; align-items:center; margin-bottom:24px;">
        <h2 style="font-family:serif; font-size:2.2rem; color:#0a1628; margin:0;">Gallery Preview</h2>
        <a href="/gallery" style="color:#b70f1b; font-weight:bold; text-decoration:none; font-size:0.9rem;">Open Gallery</a>
      </div>
      <div style="display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:12px;">
        <img src="/loyola-crest.jpg" alt="Gallery photo" style="width:100%; aspect-ratio:1.33; object-fit:cover; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.08);" />
        <img src="/loyola-crest.jpg" alt="Gallery photo" style="width:100%; aspect-ratio:1.33; object-fit:cover; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.08);" />
        <img src="/loyola-crest.jpg" alt="Gallery photo" style="width:100%; aspect-ratio:1.33; object-fit:cover; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.08);" />
        <img src="/loyola-crest.jpg" alt="Gallery photo" style="width:100%; aspect-ratio:1.33; object-fit:cover; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.08);" />
      </div>
    </div>
  </div>
</section>

<section class="home-downloads-contact-section" style="padding:80px 40px; background:#f8fafc; border-t:1px solid #dde4ed;">
  <div class="container grid-[2fr_1fr]" style="gap:40px; display:grid; grid-template-columns: 2fr 1.2fr;">
    <div style="background:#0a1628; color:#fff; padding:40px; border-radius:12px; box-shadow:0 12px 30px rgba(10,22,40,0.15); display:flex; flex-direction:column; justify-content:center;">
      <p class="eyebrow" style="color:#f7d96b; font-size:12px; font-weight:800; letter-spacing:0.2em;">Downloads &amp; Notices</p>
      <h2 style="font-family:serif; font-size:2.5rem; font-weight:bold; margin-top:16px; color:#fff; line-height:1.2;">Important files in one place.</h2>
      <p style="margin-top:16px; color:rgba(255,255,255,0.75); font-size:0.95rem; line-height:1.6; max-width:600px;">Access official circulars, student timetables, application forms, academic calendars, notices, and essential school resources directly without navigating complex menus.</p>
      <a href="/downloads" style="align-self:start; margin-top:24px; background:#d4a017; color:#0a1628; font-weight:800; padding:12px 28px; border-radius:8px; text-decoration:none; display:inline-flex; align-items:center; gap:8px;">Open Downloads &rarr;</a>
    </div>
    <aside style="background:#fff; border:1px solid #dde4ed; padding:35px; border-radius:12px; box-shadow:0 4px 14px rgba(0,0,0,0.05); display:flex; flex-direction:column; justify-content:center;">
      <h2 style="font-family:serif; font-size:1.8rem; color:#0a1628; margin:0 0 20px;">Contact Office</h2>
      <div style="display:grid; gap:16px; font-size:0.9rem; color:#64748b;">
        <p style="margin:0; display:flex; gap:12px; align-items:start;"><span style="font-size:18px;">📍</span> <span>Loyola College, Negombo, Sri Lanka</span></p>
        <p style="margin:0; display:flex; gap:12px; align-items:start;"><span style="font-size:18px;">📞</span> <span>+94 31 222 2844</span></p>
        <p style="margin:0; display:flex; gap:12px; align-items:start;"><span style="font-size:18px;">✉️</span> <span>info@loyalacollegenegombo.com</span></p>
      </div>
      <a href="/contact" style="align-self:start; margin-top:28px; background:#0a1628; color:#fff; font-weight:800; padding:12px 24px; border-radius:8px; text-decoration:none; text-align:center;">Contact Office</a>
    </aside>
  </div>
</section>`}function ss(t,a){const s=t.pages[a]||t.pages.home||{};if(a==="home")return It();const g=t.navigation.find(y=>y.id===a)?.label||s.title||Pe(a),c=a==="home"?t.websiteContent.heroTitle||s.title||g:s.title||g,v=a==="home"?t.websiteContent.heroText||s.body||"Add a strong page introduction.":s.body||"Add page content here.",N=s.image||(a==="home"?t.websiteContent.heroImage:t.media.campusImage)||t.websiteContent.heroImage||"/loyola-crest.jpg",u=!!s.backgroundMediaUrl,w=u?s.backgroundMediaUrl||"":N,m=u&&s.backgroundMediaType||"image",p=u?Math.min(.75,Math.max(.08,s.backgroundMediaOpacity||.34)):.28,b=m==="video"?`<video src="${ne(w)}" autoplay muted loop playsinline style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:${p};"></video>`:`<img src="${ne(w)}" alt="" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:${p};" />`,S=s.blocks||[],z=S.length?S.slice(0,3).map(y=>({title:y.content.title||y.type,body:y.content.body||y.content.quote||"Edit this block."})):a==="home"?t.homeSections.pillars.slice(0,3):[{title:`${g} overview`,body:v},{title:"Key information",body:"Drag text, images, and sections into this page."},{title:"Next steps",body:"Save this page to publish your visual design."}];if(a==="about/college-administration"||a==="college-administration"){const L=t.teachers.filter(T=>T.category==="Top Administration").slice(0,4).map(T=>`
      <article class="admin-card" style="text-align:center;">
        <div style="aspect-ratio:4/5; overflow:hidden; background:#f1f5f9; border-radius:8px;">
          ${T.image?`<img src="${ne(T.image)}" style="width:100%; height:100%; object-fit:cover;" />`:'<div style="height:100%; display:grid; place-items:center; color:#cbd5e1;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>'}
        </div>
        <h3 style="margin-top:1.5rem; font-family:serif; font-size:1.25rem; font-weight:bold; color:#0a1628;">${ne(T.name)}</h3>
        <p style="margin-top:0.5rem; font-size:0.875rem; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">${ne(T.position||"")}</p>
      </article>
    `).join("");return`<section class="hero" style="position:relative; overflow:hidden; background:#0a1628;">
  ${b}
  <div style="position:absolute; inset:0; background:linear-gradient(105deg, rgba(10, 22, 40, 0.98), rgba(10, 22, 40, 0.86), rgba(183, 15, 27, 0.42));"></div>
  <div class="container" style="position:relative; z-index:1;">
    <p class="eyebrow">Governance</p>
    <h1 style="max-width: 860px; margin-top: 18px;">${ne(c)}</h1>
    <p style="max-width: 680px; margin-top: 20px; font-size: 1.15rem;">The leadership team guiding Loyola College towards excellence in education and character formation.</p>
  </div>
</section>

<section style="padding:80px 0; background:#ffffff;">
  <div class="container">
    <div style="text-align:center; margin-bottom:60px;">
      <p class="eyebrow">Management</p>
      <h2 style="margin-top:12px; font-family:serif; font-size:2.5rem; font-weight:bold; color:#0a1628;">Top Administration</h2>
      <div style="width:80px; height:4px; background:#d4a017; margin:24px auto 0;"></div>
    </div>
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:40px;">
      ${L||'<p style="grid-column:1/-1; text-align:center; color:#64748b;">Add staff with "Top Administration" category in the Staff Management section to see them here.</p>'}
    </div>
    <div style="margin-top:60px; text-align:center; padding:30px; border-radius:16px; background:#f8fafc; border:1px dashed #cbd5e1;">
      <p style="font-weight:bold; color:#0a1628;">Dynamic Administration List</p>
      <p style="margin-top:8px; font-size:0.875rem; color:#64748b;">This page is automatically linked to the Staff Management system. Any staff member categorized under "Top Administration", "Vice Principals", or "Sectional Heads" will automatically appear on the live website with a professional layout.</p>
    </div>
  </div>
</section>`}if(a==="about/college-anthem-hymn"){const y=s.anthemVideoTitle||"College Anthem & Hymn",L=t.websiteContent.anthemVideoUrl||s.anthemVideoUrl||"#",T=t.websiteContent.anthemVideoCoverImage||s.anthemVideoCoverImage||N;return`<section class="hero" style="position:relative; overflow:hidden; background:#0a1628;">
  ${b}
  <div style="position:absolute; inset:0; background:linear-gradient(105deg, rgba(10, 22, 40, 0.98), rgba(10, 22, 40, 0.86), rgba(183, 15, 27, 0.42));"></div>
  <div class="container" style="position:relative; z-index:1;">
    <p class="eyebrow">Faith, learning, discipline, and service</p>
    <h1 style="max-width: 860px; margin-top: 18px;">${ne(c)}</h1>
    <p style="max-width: 680px; margin-top: 20px; font-size: 1.15rem;">A dignified home for Loyola College Negombo's ceremonial songs, school values, and shared identity.</p>
  </div>
</section>

<section class="anthem-media-section">
  <div class="container anthem-media-layout">
    <div>
      <p class="eyebrow">Watch and Listen</p>
      <h2 style="margin-top:12px;">Anthem and hymn media.</h2>
      <p style="max-width:620px;margin-top:18px;"></p>
      <a class="btn" href="${ne(L)}" style="margin-top:26px;">Open video</a>
    </div>
    <a class="anthem-media-card" data-gjs-type="anthem-media-card" href="${ne(L)}" data-cover="${ne(T)}" data-title="${ne(y)}">
      <div class="anthem-media-cover">
        <img src="${ne(T)}" alt="" />
        <div class="anthem-play"><span>&#9658;</span></div>
      </div>
      <div class="anthem-media-caption">
        <p class="eyebrow">Featured media</p>
        <h3 class="anthem-media-title">${ne(y)}</h3>
      </div>
    </a>
  </div>
</section>`}return`<section class="hero" style="position:relative; overflow:hidden; background:#0a1628;">
  ${b}
  <div style="position:absolute; inset:0; background:linear-gradient(105deg, rgba(10, 22, 40, 0.98), rgba(10, 22, 40, 0.86), rgba(183, 15, 27, 0.42));"></div>
  <div class="container" style="position:relative; z-index:1;">
    <p class="eyebrow">${ne(s.kicker||s.eyebrow||g)}</p>
    <h1 style="max-width: 780px; margin-top: 18px;">${ne(c)}</h1>
    <p style="max-width: 680px; margin-top: 20px; font-size: 1.15rem;">${ne(v)}</p>
  </div>
</section>
<section>
  <div class="container grid-3">
    ${z.map(y=>`<article class="feature-card">
      <h3>${ne(y.title)}</h3>
      <p style="margin-top: 10px;">${ne(y.body)}</p>
    </article>`).join("")}
  </div>
</section>`}function os(t){return Array.from(t.styleSheets).map(a=>{try{return Array.from(a.cssRules).map(s=>s.cssText).join(`
`)}catch{return""}}).filter(Boolean).join(`
`)}function rs(t){const a=t?.contentDocument;if(!a)return null;const d=a.querySelector("main")?.innerHTML.trim();return d?{html:d,css:os(a)}:null}function is({db:t,selectedPage:a,selectedSection:s,frameRef:d}){const[g,c]=l.useState(0),v=as(a),N=`${v}?websiteEditorPreview=1&refresh=${g}`,u=l.useCallback(()=>{d.current?.contentWindow?.postMessage({type:"loyola.website-preview.db",db:t},window.location.origin)},[t,d]);return l.useEffect(()=>{const w=window.requestAnimationFrame(u);return()=>window.cancelAnimationFrame(w)},[u,N]),e.jsxs("div",{className:"flex h-[78vh] min-h-[640px] flex-col overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-elegant",children:[e.jsx("div",{className:"shrink-0 border-b border-slate-200 bg-slate-50 px-5 py-3",children:e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-4",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"h-3 w-3 rounded-full bg-red-400"}),e.jsx("span",{className:"h-3 w-3 rounded-full bg-amber-400"}),e.jsx("span",{className:"h-3 w-3 rounded-full bg-emerald-400"})]}),e.jsxs("a",{href:v,target:"_blank",rel:"noreferrer",className:"inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-navy shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50",children:[e.jsxs("span",{className:"inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700",children:[e.jsx("span",{className:"h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-badge"}),"Live"]}),e.jsx(Le,{className:"h-3.5 w-3.5"}),"Preview ",v," | ",s]})]})}),e.jsx("iframe",{ref:d,src:N,title:"Full website live preview",onLoad:u,className:"min-h-0 flex-1 border-0 bg-white"},N),e.jsxs("div",{className:"flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500",children:[e.jsx("span",{children:Pe(a)}),e.jsxs("button",{type:"button",onClick:()=>c(w=>w+1),className:"inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-navy",children:[e.jsx(Ie,{className:"h-3 w-3"}),"Refresh"]})]})]})}const ns=["Header","Hero","Welcome","Vision & Mission","News & Notices","Events","Gallery","Footer"];function ls({pageId:t}){const d=(De().pages[t]||{}).blocks||[],[g,c]=l.useState(null),v=p=>{$(b=>({...b,pages:{...b.pages,[t]:{...b.pages[t]||{},blocks:p}}}))},N=(p,b)=>{const S=[...d];S[p]={...S[p],content:{...S[p].content,...b}},v(S)},u=p=>{v(d.filter((b,S)=>S!==p))},w=(p,b)=>{c(b),p.dataTransfer.effectAllowed="move"},m=(p,b)=>{if(p.preventDefault(),g===null||g===b)return;const S=[...d],z=S.splice(g,1)[0];S.splice(b,0,z),c(b),v(S)};return e.jsxs("div",{className:"space-y-4",children:[e.jsx("div",{className:"flex flex-wrap gap-2 mb-4",children:["text","hero","quote","gallery"].map(p=>e.jsxs("button",{type:"button",onClick:()=>{const b=ve("BLK");v([...d,{id:b,type:p,content:{title:`New ${p}`,body:"Edit this content."}}])},className:"rounded-lg bg-secondary px-3 py-1 text-xs font-bold text-navy hover:bg-gold/20 hover:text-gold-dark",children:["+ Add ",p]},p))}),d.length===0&&e.jsx("div",{className:"rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500",children:"No blocks on this page. Add a block above to start building."}),d.map((p,b)=>e.jsxs("div",{draggable:!0,onDragStart:S=>w(S,b),onDragOver:S=>m(S,b),onDragEnd:()=>c(null),className:`overflow-hidden rounded-xl border border-slate-200 bg-white transition-opacity ${g===b?"opacity-50":""}`,children:[e.jsxs("div",{className:"flex cursor-grab items-center justify-between bg-slate-50 px-3 py-2 border-b border-slate-200 active:cursor-grabbing",children:[e.jsxs("div",{className:"flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500",children:[e.jsx(la,{className:"h-4 w-4"})," ",p.type," Block"]}),e.jsx("button",{type:"button",onClick:()=>u(b),className:"text-slate-400 hover:text-destructive",children:e.jsx(pe,{className:"h-4 w-4"})})]}),e.jsxs("div",{className:"p-4 space-y-3",children:[e.jsx("input",{value:p.content.title||"",onChange:S=>N(b,{title:S.target.value}),placeholder:"Block Title",className:"w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-gold"}),p.type!=="gallery"&&e.jsx("textarea",{value:p.content.body||p.content.quote||"",onChange:S=>N(b,p.type==="quote"?{quote:S.target.value}:{body:S.target.value}),placeholder:p.type==="quote"?"Quote text":"Block content",rows:3,className:"w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold"}),p.type==="quote"&&e.jsx("input",{value:p.content.author||"",onChange:S=>N(b,{author:S.target.value}),placeholder:"Author name",className:"w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold"})]})]},p.id))]})}function tt(){const t=De(),a=wt(),s=l.useRef(null),d=l.useRef(null),g=l.useRef(null),c=l.useRef(null),v=l.useRef(null),N=l.useRef(null),u=l.useRef(null),w=l.useRef(null),[m,p]=l.useState("home"),[b,S]=l.useState("Hero"),[z,y]=l.useState("Ready to edit."),[L,T]=l.useState("info"),[x,i]=l.useState("idle"),[f,A]=l.useState(!1),[_,O]=l.useState(null),G=t.pages[m]||t.pages.home,ae=a.user?.role==="website_admin",ie=l.useMemo(()=>{const j=dt(t.navigation).filter(k=>k.id!=="student-portal").map(k=>k.id).filter(k=>t.pages[k]);return[...j,...Object.keys(t.pages).filter(k=>!j.includes(k)&&k!=="student-portal")]},[t.navigation,t.pages]),se=l.useMemo(()=>dt(t.navigation),[t.navigation]);l.useEffect(()=>{t.pages[m]||p("home")},[t.pages,m]);const K=o=>{$(j=>({...j,websiteContent:{...j.websiteContent,...o}}))},Z=(o,j)=>{$(k=>({...k,pages:{...k.pages,[m]:{...k.pages[m]||{},[o]:j}}}))},U=async(o,j)=>{if(j)try{y("Optimizing image...");const k=await $t(j);let E=k.url,H=!1;try{y("Uploading optimized image..."),E=await xe(`site-images/${o}`,j),H=!0}catch(r){if(ue(r))throw r}$(r=>o==="hero"?{...r,websiteContent:{...r.websiteContent,heroImage:E}}:o==="logo"?{...r,websiteContent:{...r.websiteContent,logoImage:E}}:o==="principal"?{...r,media:{...r.media,principalImage:E}}:o==="page"?{...r,pages:{...r.pages,[m]:{...r.pages[m]||{},image:E}}}:o==="anthemVideoCover"?{...r,pages:{...r.pages,[m]:{...r.pages[m]||{},anthemVideoCoverImage:E}}}:{...r,media:{...r.media,campusImage:E}}),V(`Image uploaded to ${o}`,"Website editor"),y(H?`Image optimized and uploaded: ${k.original} to ${k.optimized}`:`Image optimized for local storage: ${k.original} to ${k.optimized}`)}catch(k){y(k instanceof Error?k.message:"Image upload failed.")}},me=async o=>{if(o)try{y(o.type.startsWith("video/")?`Uploading background video for ${Pe(m)}...`:`Optimizing background image for ${Pe(m)}...`);const j=await ts(o);$(k=>({...k,pages:{...k.pages,[m]:{...k.pages[m]||{},backgroundMediaUrl:j.url,backgroundMediaType:j.type,backgroundMediaOpacity:k.pages[m]?.backgroundMediaOpacity||.34}}})),V(`Page background ${j.type} uploaded: ${m}`,"Website editor"),y(`${j.message}. It now appears behind the ${Pe(m)} page hero.`)}catch(j){y(j instanceof Error?j.message:"Page background upload failed.")}},ge=()=>{$(o=>({...o,pages:{...o.pages,[m]:{...o.pages[m]||{},backgroundMediaUrl:"",backgroundMediaType:"",backgroundMediaOpacity:.34}}})),V(`Page background media removed: ${m}`,"Website editor"),y(`${Pe(m)} background media removed.`)},M=o=>{$(j=>({...j,navigation:j.navigation.map(k=>k.id===o?{...k,visible:!(k.visible??!0)}:k)}))},J=(o,j)=>{$(k=>({...k,navigation:k.navigation.map(E=>E.id===o?{...E,label:j}:E)}))},oe=(o,j)=>{$(k=>{const E=k.navigation.find(W=>W.id===o);if(!E)return k;const H=k.navigation.filter(W=>W.parentId===E.parentId).sort((W,re)=>W.order-re.order),r=H.findIndex(W=>W.id===o),F=r+j;if(r<0||F<0||F>=H.length)return k;const Y=H[r],te=H[F];return{...k,navigation:k.navigation.map(W=>W.id===Y.id?{...W,order:te.order}:W.id===te.id?{...W,order:Y.order}:W)}})},ce=()=>{$(o=>({...o,navigation:o.navigation.map(j=>j.id==="student-portal"?{...j,visible:!1}:j),websiteContent:{...o.websiteContent,headerSignInLabel:"Portal Login",headerApplyLabel:"Admissions"}})),V("Duplicate portal menu item hidden","Website editor"),y("Duplicate portal menu item removed. One Portal Login button remains in the header.")},D=()=>{$(o=>({...o,gallery:[{id:ve("GALLERY"),label:"New Gallery Album",image:o.media.campusImage||o.websiteContent.heroImage||"/loyola-crest.jpg",images:[o.media.campusImage||o.websiteContent.heroImage||"/loyola-crest.jpg"],description:"Album description",link:"",visible:!0},...o.gallery]})),y("New gallery album created.")},q=o=>{const j=window.prompt(o?"Enter subpage name (e.g. 'Primary Section'):":"Enter new page name (e.g. 'Facilities'):");if(!j)return;const k=j.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""),E=o?`${o}/${k}`:k;if(!k||!E){alert("Invalid or duplicate page name.");return}let H="";$(r=>{const F=new Set([...Object.keys(r.pages),...r.navigation.map(re=>re.id)]);let Y=E,te=2;for(;F.has(Y);)Y=`${E}-${te}`,te+=1;H=Y;const W=o?Math.max(0,...r.navigation.filter(re=>re.parentId===o).map(re=>re.order))+1:Math.max(0,...r.navigation.map(re=>re.order))+1;return{...r,pages:{...r.pages,[Y]:{title:j,body:"New page content goes here.",kicker:o?r.pages[o]?.title:j}},navigation:[...r.navigation,{id:Y,label:j,order:W,visible:!0,parentId:o}]}}),H&&p(H),y(`${o?"Subpage":"Page"} '${j}' created.`),V(`Created ${o?"subpage":"page"} ${H||E}`,"Website editor")},ee=o=>{if(o==="home"){alert("Home page cannot be deleted.");return}if(confirm(`Are you sure you want to delete '${t.pages[o]?.title||o}' and any subpages under it? This cannot be undone.`)){const j=ct(t.navigation,o).has(m);$(k=>{const E=ct(k.navigation,o),H={...k.pages};return E.forEach(r=>{delete H[r]}),{...k,pages:H,navigation:k.navigation.filter(r=>!E.has(r.id))}}),j&&p("home"),y("Page deleted."),V(`Deleted page ${o}`,"Website editor")}},n=o=>{const j=t.navigation.find(E=>E.id===o)?.label||t.pages[o]?.title||o,k=window.prompt("Enter new page name:",j);!k||k===j||($(E=>({...E,pages:{...E.pages,[o]:{...E.pages[o]||{},title:k}},navigation:E.navigation.map(H=>H.id===o?{...H,label:k}:H)})),y(`Page renamed to '${k}'.`))},C=()=>{const o=t.pages[m],j=m==="home"?null:rs(w.current),E=m==="home"&&o?.visualHtml&&!o.visualHtml.includes("home-academics-section")?It():j?.html||o?.visualHtml||ss(t,m);O({html:E,css:o?.visualCss||"",canvasCss:m==="home"?"":j?.css||""}),A(!0),y(`Visual Builder opened for '${o?.title||m}'.`)},h=(o,j,k)=>{if(j.remote){T("info"),y(`${o} to cloud${j.contentVersion?` as version ${j.contentVersion}`:""}. Refresh other devices to see the same site.`);return}if(j.localOnly){T("info"),y("Draft saved locally. Submit for approval when the website changes are ready.");return}T("error");const E=j.error?`: ${j.error}`:".";y(k==="publish"?`Server publish failed${E} Local draft was kept on this device; the public website was not updated.`:`Cloud save failed${E} Local draft was kept on this device.`)},P=async()=>{i("saving"),V(`Saved ${m} / ${b}`,"Website editor");const o=await ke();h("Draft saved",o,"save"),i("idle")},I=async()=>{if(ae){i("submitting"),V(`Submitted website changes for approval: ${m}`,"Website editor"),await ke();try{const j=await zt(t);T("info"),y(`Submitted for approval as request #${j.id}.`)}catch(j){T("error"),y(`Approval submit failed: ${j instanceof Error?j.message:"Request could not be created."}`)}i("idle");return}i("publishing"),V(`Published website changes for ${m}`,"Website editor");const o=await ke();h("Website changes published",o,"publish"),i("idle")},R=async(o,j)=>{const k=t.pages[m]?.title||m;i("saving"),T("info"),y("Saving visual content and uploaded media..."),$(H=>({...H,pages:{...H.pages,[m]:{...H.pages[m]||{},visualHtml:o,visualCss:j}}})),A(!1),O(null),V(`Visual builder saved ${m}`,"Website editor");const E=await ke();E.remote?(T("info"),y(`Changes live on website for '${k}'${E.contentVersion?` as version ${E.contentVersion}`:""}. Uploaded photos are saved with this page.`)):h(`Visual content saved for '${k}'`,E,"save"),i("idle")},Q=L==="error"&&z.includes("Local draft");return e.jsxs("div",{className:"space-y-5 animate-fade-in-up",children:[f&&_&&e.jsx(Ya,{initialHtml:_.html,initialCss:_.css,canvasCss:_.canvasCss,onSave:(o,j)=>{R(o,j)},onClose:()=>{A(!1),O(null)}}),e.jsxs("div",{className:"relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_32px_-8px_rgba(10,22,40,0.15)]",children:[e.jsx("div",{className:"absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0a1628] via-[#b70f1b] to-[#d4a017]"}),e.jsx("div",{className:"px-6 pt-5 pb-4",children:e.jsxs("div",{className:"flex flex-col justify-between gap-4 lg:flex-row lg:items-start",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-[10px] font-black uppercase tracking-[0.28em] text-crimson",children:"Loyola Digital Studio"}),e.jsx("h2",{className:"mt-1 font-serif text-3xl font-bold text-navy",children:"Professional Website Editor"}),e.jsx("p",{className:"mt-1 max-w-md text-sm text-slate-500",children:"Live preview, page content, menu control, theme and server publishing."})]}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2 shrink-0",children:[e.jsxs(de,{onClick:()=>{P()},disabled:x!=="idle",children:[e.jsx(Ke,{className:"h-4 w-4"}),x==="saving"?"Saving…":"Save Draft"]}),e.jsxs(de,{onClick:()=>window.open("/","_blank","noopener,noreferrer"),children:[e.jsx(Le,{className:"h-4 w-4"})," Preview"]}),e.jsxs(de,{onClick:()=>{const j={home:"src/App.tsx","about/college-administration":"src/components/site/CollegeAdministrationPage.tsx","about/college-staff":"src/components/site/CollegeStaffPage.tsx"}[m]||"src/App.tsx";fetch(`/__-loyola-open-editor?file=${encodeURIComponent(j)}`).catch(()=>{window.alert("VS Code integration only works in local dev mode.")})},children:[e.jsx(aa,{className:"h-4 w-4"})," Open in VS Code"]}),e.jsx(de,{tone:"gold",onClick:()=>{I()},disabled:x!=="idle",children:x==="publishing"||x==="submitting"?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"inline-block h-4 w-4 animate-spin rounded-full border-2 border-navy/30 border-t-navy"})," ",x==="submitting"?"Submitting…":"Publishing…"]}):e.jsx(e.Fragment,{children:ae?e.jsxs(e.Fragment,{children:[e.jsx(Re,{className:"h-4 w-4"})," Submit for Approval"]}):e.jsxs(e.Fragment,{children:[e.jsx(je,{className:"h-4 w-4"})," Publish"]})})})]})]})}),e.jsxs("div",{className:`flex items-start gap-3 border-t px-6 py-3 text-sm font-medium transition-all duration-300 ${L==="error"&&!Q?"border-red-100 bg-red-50 text-red-800":Q?"border-amber-100 bg-amber-50 text-amber-800":"border-emerald-100 bg-emerald-50 text-emerald-800"}`,children:[e.jsx("span",{className:"mt-0.5 shrink-0 text-base",children:L==="error"&&!Q?"⚠️":Q?"💾":"✅"}),e.jsx("span",{className:"leading-5",children:z})]})]}),e.jsxs("div",{className:"grid gap-5 xl:grid-cols-[268px_minmax(0,1fr)_352px]",children:[e.jsxs("aside",{className:"space-y-4",children:[e.jsxs("div",{className:"overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_16px_-4px_rgba(10,22,40,0.10)]",children:[e.jsxs("div",{className:"flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3",children:[e.jsx(Nt,{className:"h-4 w-4 text-[#d4a017]"}),e.jsx("span",{className:"text-xs font-black uppercase tracking-[0.18em] text-navy",children:"Pages"})]}),e.jsxs("div",{className:"p-3 space-y-1",children:[ie.map(o=>{const j=t.navigation.find(r=>r.id===o),k=!!j?.parentId,E=o!=="home",H=m===o;return e.jsxs("div",{className:`flex items-center gap-1 ${k?"ml-3":""}`,children:[e.jsxs("button",{type:"button",onClick:()=>p(o),className:`group flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all duration-200 ${H?"bg-gradient-to-r from-[#0a1628] to-[#1e3560] text-white shadow-[0_2px_12px_-2px_rgba(10,22,40,0.35)]":"text-slate-600 hover:bg-slate-50 hover:text-navy"}`,children:[H&&e.jsx("span",{className:"h-1.5 w-1.5 rounded-full bg-[#d4a017] shrink-0"}),e.jsx("span",{className:"truncate",children:j?.label||t.pages[o]?.title||o.replace("-"," ")})]}),e.jsxs("div",{className:"flex shrink-0",children:[e.jsx("button",{type:"button",onClick:()=>n(o),title:"Rename",className:"rounded-lg p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600 transition-colors",children:e.jsx(sa,{className:"h-3.5 w-3.5"})}),E&&e.jsx("button",{type:"button",onClick:()=>ee(o),title:"Delete",className:"rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors",children:e.jsx(pe,{className:"h-3.5 w-3.5"})}),!k&&e.jsx("button",{type:"button",onClick:()=>q(o),title:"Add subpage",className:"rounded-lg p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600 transition-colors",children:e.jsx("span",{className:"text-sm font-black leading-none",children:"+"})})]})]},o)}),e.jsx("button",{type:"button",onClick:()=>q(),className:"mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-bold text-slate-400 transition-all duration-200 hover:border-[#d4a017] hover:bg-[#d4a017]/5 hover:text-navy",children:"+ Add new page"})]})]}),e.jsxs("div",{className:"overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_16px_-4px_rgba(10,22,40,0.10)]",children:[e.jsxs("div",{className:"flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3",children:[e.jsx(Oe,{className:"h-4 w-4 text-[#d4a017]"}),e.jsx("span",{className:"text-xs font-black uppercase tracking-[0.18em] text-navy",children:"Sections"})]}),e.jsx("div",{className:"p-3 space-y-1",children:ns.map(o=>{const j=b===o;return e.jsxs("button",{type:"button",onClick:()=>S(o),className:`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all duration-200 ${j?"bg-[#d4a017]/12 text-navy shadow-[0_0_0_1.5px_#d4a017] font-bold":"text-slate-600 hover:bg-slate-50 hover:text-navy"}`,children:[e.jsx("span",{children:o}),j&&e.jsx("span",{className:"h-2 w-2 rounded-full bg-[#d4a017] animate-pulse-badge"})]},o)})})]})]}),e.jsxs("main",{className:"space-y-4",children:[e.jsx(is,{db:t,selectedPage:m,selectedSection:b,frameRef:w}),e.jsxs("div",{className:"overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_16px_-4px_rgba(10,22,40,0.10)]",children:[e.jsxs("div",{className:"flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-3.5",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(Oe,{className:"h-4 w-4 text-[#d4a017]"}),e.jsx("h3",{className:"text-xs font-black uppercase tracking-[0.18em] text-navy",children:"Header & Navigation"})]}),e.jsxs(de,{tone:"dark",onClick:ce,children:[e.jsx(Ie,{className:"h-3.5 w-3.5"})," Fix duplicates"]})]}),e.jsx("div",{className:"p-4 space-y-2",children:se.map(o=>{const j=!!o.parentId;return e.jsxs("div",{className:`grid gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 md:grid-cols-[1fr_auto_auto_auto] md:items-center transition-all duration-200 hover:border-slate-200 hover:bg-white hover:shadow-sm ${j?"ml-6":""}`,children:[e.jsx("input",{value:o.label,onChange:k=>J(o.id,k.target.value),className:"rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none transition-colors focus:border-[#d4a017] focus:shadow-[0_0_0_3px_rgba(212,160,23,0.15)]"}),e.jsxs("button",{type:"button",onClick:()=>M(o.id),className:`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all duration-200 ${o.visible?"bg-emerald-100 text-emerald-700 hover:bg-emerald-200":"bg-slate-100 text-slate-500 hover:bg-slate-200"}`,children:[o.visible?e.jsx(Le,{className:"h-3.5 w-3.5"}):e.jsx(oa,{className:"h-3.5 w-3.5"}),o.visible?"Visible":"Hidden"]}),e.jsxs("div",{className:"flex gap-1",children:[e.jsx("button",{type:"button",onClick:()=>oe(o.id,-1),className:"rounded-lg border border-slate-200 bg-white p-1.5 hover:border-slate-300 hover:bg-slate-50 transition-colors",children:e.jsx(ra,{className:"h-3.5 w-3.5"})}),e.jsx("button",{type:"button",onClick:()=>oe(o.id,1),className:"rounded-lg border border-slate-200 bg-white p-1.5 hover:border-slate-300 hover:bg-slate-50 transition-colors",children:e.jsx(ia,{className:"h-3.5 w-3.5"})})]}),e.jsxs("span",{className:"text-[11px] font-mono text-slate-400",children:["/",o.id==="home"?"":o.id]})]},o.id)})})]})]}),e.jsxs("aside",{className:"space-y-4",children:[e.jsxs("div",{className:"overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_16px_-4px_rgba(10,22,40,0.10)]",children:[e.jsxs("div",{className:"flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3",children:[e.jsx(na,{className:"h-4 w-4 text-[#d4a017]"}),e.jsx("span",{className:"text-xs font-black uppercase tracking-[0.18em] text-navy",children:"Content Inspector"})]}),e.jsxs("div",{className:"p-4 space-y-4",children:[m==="home"?e.jsxs(e.Fragment,{children:[e.jsx(he,{label:"School name",children:e.jsx("input",{value:t.websiteContent.schoolName,onChange:o=>K({schoolName:o.target.value}),className:"input-line"})}),e.jsx(he,{label:"Motto / tagline",children:e.jsx("input",{value:t.websiteContent.tagline,onChange:o=>K({tagline:o.target.value}),className:"input-line"})}),e.jsx(he,{label:"Hero title",children:e.jsx("textarea",{value:t.websiteContent.heroTitle,onChange:o=>K({heroTitle:o.target.value}),rows:3,className:"input-line resize-none"})}),e.jsx(he,{label:"Hero text",children:e.jsx("textarea",{value:t.websiteContent.heroText,onChange:o=>K({heroText:o.target.value}),rows:4,className:"input-line resize-none"})})]}):e.jsxs(e.Fragment,{children:[e.jsx(ls,{pageId:m}),m==="about/college-anthem-hymn"&&e.jsxs("div",{className:"rounded-xl border border-[#d4a017]/30 bg-[#d4a017]/5 p-4",children:[e.jsx("p",{className:"mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-crimson",children:"Anthem media"}),e.jsx(he,{label:"Media title",children:e.jsx("input",{value:G.anthemVideoTitle||"",onChange:o=>Z("anthemVideoTitle",o.target.value),placeholder:"College Anthem & Hymn",className:"input-line"})}),e.jsx(he,{label:"Video link",children:e.jsx("input",{value:G.anthemVideoUrl||"",onChange:o=>Z("anthemVideoUrl",o.target.value),placeholder:"YouTube or MP4 URL",className:"input-line"})}),e.jsx(he,{label:"Cover photo link",children:e.jsx("input",{value:G.anthemVideoCoverImage||"",onChange:o=>Z("anthemVideoCoverImage",o.target.value),placeholder:"Paste image URL",className:"input-line"})}),G.anthemVideoCoverImage&&e.jsx("img",{src:G.anthemVideoCoverImage,alt:"",className:"mt-3 aspect-video w-full rounded-xl object-cover"}),e.jsxs("div",{className:"mt-3 grid gap-2",children:[e.jsxs(de,{tone:"gold",onClick:()=>N.current?.click(),children:[e.jsx(le,{className:"h-4 w-4"})," Upload video cover"]}),G.anthemVideoCoverImage&&e.jsxs(de,{onClick:()=>Z("anthemVideoCoverImage",""),children:[e.jsx(pe,{className:"h-4 w-4"})," Remove cover"]})]})]})]}),e.jsxs("button",{type:"button",onClick:C,className:"group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d4a017] to-[#f7d96b] px-4 py-4 text-sm font-black text-[#0a1628] shadow-[0_8px_28px_-8px_rgba(212,160,23,0.62)] transition-all duration-200 hover:shadow-[0_12px_34px_-8px_rgba(212,160,23,0.75)] hover:scale-[1.02] active:scale-[0.98]",children:[e.jsx(ot,{className:"h-4 w-4 transition-transform duration-300 group-hover:rotate-12"})," ","Open Visual Builder"]})]})]}),e.jsxs("div",{className:"overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_16px_-4px_rgba(10,22,40,0.10)]",children:[e.jsxs("div",{className:"flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3",children:[e.jsx($e,{className:"h-4 w-4 text-[#d4a017]"}),e.jsx("span",{className:"text-xs font-black uppercase tracking-[0.18em] text-navy",children:"Media Tools"})]}),e.jsxs("div",{className:"p-4 space-y-3",children:[e.jsx(Et,{}),e.jsx("input",{ref:s,type:"file",accept:"image/jpeg,image/png",className:"hidden",onChange:o=>{U("hero",o.target.files?.[0])}}),e.jsx("input",{ref:d,type:"file",accept:"image/jpeg,image/png",className:"hidden",onChange:o=>{U("logo",o.target.files?.[0])}}),e.jsx("input",{ref:g,type:"file",accept:"image/jpeg,image/png",className:"hidden",onChange:o=>{U("campus",o.target.files?.[0])}}),e.jsx("input",{ref:c,type:"file",accept:"image/jpeg,image/png",className:"hidden",onChange:o=>{U("principal",o.target.files?.[0])}}),e.jsx("input",{ref:v,type:"file",accept:"image/jpeg,image/png",className:"hidden",onChange:o=>{U("page",o.target.files?.[0])}}),e.jsx("input",{ref:N,type:"file",accept:"image/jpeg,image/png",className:"hidden",onChange:o=>{U("anthemVideoCover",o.target.files?.[0])}}),e.jsx("input",{ref:u,type:"file",accept:"image/jpeg,image/png,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm",className:"hidden",onChange:o=>{me(o.target.files?.[0])}}),e.jsxs("div",{className:"grid gap-2",children:[e.jsxs(de,{onClick:()=>u.current?.click(),tone:"gold",children:[e.jsx(le,{className:"h-4 w-4"})," Upload page background"]}),G.backgroundMediaUrl&&e.jsxs(de,{onClick:ge,children:[e.jsx(pe,{className:"h-4 w-4"})," Remove background"]}),m==="home"?e.jsxs(de,{onClick:()=>s.current?.click(),children:[e.jsx(le,{className:"h-4 w-4"})," Upload hero image"]}):e.jsxs(de,{onClick:()=>v.current?.click(),children:[e.jsx(le,{className:"h-4 w-4"})," Upload page image"]}),e.jsxs(de,{onClick:()=>d.current?.click(),children:[e.jsx(le,{className:"h-4 w-4"})," Upload logo"]}),e.jsxs(de,{onClick:()=>g.current?.click(),children:[e.jsx(le,{className:"h-4 w-4"})," Upload campus image"]}),e.jsxs(de,{onClick:()=>c.current?.click(),children:[e.jsx(le,{className:"h-4 w-4"})," Upload principal image"]}),e.jsx(he,{label:"Page background opacity",hint:`${Math.round((G.backgroundMediaOpacity||.34)*100)}% — behind the hero gradient.`,children:e.jsx("input",{type:"range",min:"0.08",max:"0.75",step:"0.01",value:G.backgroundMediaOpacity||.34,onChange:o=>Z("backgroundMediaOpacity",Number(o.target.value)),className:"w-full accent-[#d4a017]"})})]})]})]}),e.jsxs("div",{className:"overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_16px_-4px_rgba(10,22,40,0.10)]",children:[e.jsxs("div",{className:"flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3",children:[e.jsx(Qe,{className:"h-4 w-4 text-[#d4a017]"}),e.jsx("span",{className:"text-xs font-black uppercase tracking-[0.18em] text-navy",children:"Design & Animation"})]}),e.jsxs("div",{className:"p-4 space-y-4",children:[e.jsx(he,{label:"Primary color",children:e.jsx("input",{type:"color",value:t.websiteContent.primaryColor,onChange:o=>K({primaryColor:o.target.value}),className:"h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-1 transition-all hover:border-[#d4a017]"})}),e.jsx(he,{label:"Accent color",children:e.jsx("input",{type:"color",value:t.websiteContent.accentColor,onChange:o=>K({accentColor:o.target.value}),className:"h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-1 transition-all hover:border-[#d4a017]"})}),e.jsx(he,{label:"Custom CSS",hint:"Advanced: add extra CSS overrides.",children:e.jsx("textarea",{value:t.websiteContent.customCss,onChange:o=>K({customCss:o.target.value}),rows:4,className:"input-line resize-none font-mono text-xs"})}),e.jsxs("div",{className:"grid gap-2 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 p-3 text-xs leading-5 text-slate-500",children:[e.jsxs("div",{className:"flex items-center gap-2 font-bold text-navy text-[11px] uppercase tracking-wider",children:[e.jsx(ot,{className:"h-3.5 w-3.5 text-[#d4a017]"})," Animation system active"]}),e.jsx("p",{children:"Fade-in, card lift, button glow, and smooth section transitions are enabled globally."})]}),e.jsxs("div",{className:"grid gap-2 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 p-3 text-xs leading-5 text-slate-500",children:[e.jsxs("div",{className:"flex items-center gap-2 font-bold text-navy text-[11px] uppercase tracking-wider",children:[e.jsx(kt,{className:"h-3.5 w-3.5 text-[#d4a017]"})," Responsive layout"]}),e.jsx("p",{children:"Mobile menu, responsive grids, and flexible cards built into every page."})]}),e.jsxs(de,{tone:"gold",onClick:D,children:[e.jsx($e,{className:"h-4 w-4"})," Add gallery album"]})]})]})]})]})]})}function pt(t){return t==="approved"?"success":t==="rejected"?"danger":t==="published"?"gold":"warning"}function mt(t){return t.charAt(0).toUpperCase()+t.slice(1)}function gt(t){return t.requestedByName||t.requestedByEmail||t.requestedBy||"Unknown"}function ht(t){if(!t)return"-";const a=new Date(t);return Number.isNaN(a.getTime())?t:a.toLocaleString()}function ds(t){return{pages:t?.pages?Object.keys(t.pages).length:0,navigation:Array.isArray(t?.navigation)?t.navigation.length:0,news:Array.isArray(t?.news)?t.news.length:0,events:Array.isArray(t?.events)?t.events.length:0,teachers:Array.isArray(t?.teachers)?t.teachers.length:0,students:Array.isArray(t?.students)?t.students.length:0,parents:Array.isArray(t?.parents)?t.parents.length:0,media:Array.isArray(t?.media)?t.media.length:0}}function cs(){const[t,a]=l.useState([]),[s,d]=l.useState(null),[g,c]=l.useState(""),[v,N]=l.useState(!0),[u,w]=l.useState(null),[m,p]=l.useState({tone:"info",text:"Ready"}),b=l.useMemo(()=>({pending:t.filter(i=>i.status==="pending").length,approved:t.filter(i=>i.status==="approved").length,rejected:t.filter(i=>i.status==="rejected").length,published:t.filter(i=>i.status==="published").length}),[t]),S=async()=>{N(!0);try{const i=await La();a(i),d(f=>f?i.find(A=>A.id===f.id)||f:null),p({tone:"info",text:"Publish approvals refreshed."})}catch(i){p({tone:"error",text:i instanceof Error?i.message:"Could not load publish approvals."})}finally{N(!1)}};l.useEffect(()=>{S()},[]);const z=i=>{a(f=>f.map(A=>A.id===i.id?i:A)),d(i),c(i.reviewNote||"")},y=async i=>{w(i.id);try{const f=i.data?i:await lt(i.id);z(f),p({tone:"info",text:`Preview loaded for request #${f.id}.`})}catch(f){p({tone:"error",text:f instanceof Error?f.message:"Could not load request preview."})}finally{w(null)}},L=async i=>{const f=i.data?i:await lt(i.id);z(f);const A=window.open("/","_blank");if(!A||!f.data){p({tone:"error",text:"Preview window could not be opened."});return}const _={type:"loyola.website-preview.db",db:f.data},O=()=>A.postMessage(_,window.location.origin);window.setTimeout(O,600),window.setTimeout(O,1300),window.setTimeout(O,2200),p({tone:"info",text:`Opened preview for request #${f.id}.`})},T=async(i,f)=>{if(f==="reject"&&!g.trim()){p({tone:"error",text:"Add a review note before rejecting."});return}w(i.id);try{const A=f==="approve"?await Ia(i.id,g):f==="reject"?await Ua(i.id,g):await Ra(i.id);z(A);const _=f==="approve"?"approved":f==="reject"?"rejected":"published";p({tone:"info",text:`Request #${A.id} ${_}.`})}catch(A){p({tone:"error",text:A instanceof Error?A.message:`Could not ${f} request.`})}finally{w(null)}},x=ds(s?.data);return e.jsxs(e.Fragment,{children:[e.jsx(Mt,{kicker:"Website governance",title:"Publish Approvals",children:e.jsxs("button",{type:"button",onClick:()=>{S()},className:"inline-flex items-center gap-2 rounded-lg border border-[#c8d5f4] bg-white px-4 py-2 text-sm font-bold text-navy",children:[e.jsx(Ie,{className:`h-4 w-4 ${v?"animate-spin":""}`})," Refresh"]})}),e.jsxs("div",{className:"grid gap-4 md:grid-cols-4",children:[e.jsx(ye,{label:"Pending",value:b.pending,accent:!0}),e.jsx(ye,{label:"Approved",value:b.approved}),e.jsx(ye,{label:"Rejected",value:b.rejected}),e.jsx(ye,{label:"Published",value:b.published})]}),e.jsx("div",{className:`mt-5 rounded-lg border px-4 py-3 text-sm font-semibold ${m.tone==="error"?"border-red-200 bg-red-50 text-red-800":"border-emerald-200 bg-emerald-50 text-emerald-800"}`,children:m.text}),e.jsxs("div",{className:"mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.7fr)]",children:[e.jsx(qe,{title:"Requests",children:e.jsx(Tt,{rows:t,empty:v?"Loading publish requests...":"No publish requests yet.",columns:[{key:"id",label:"Request",render:i=>e.jsxs("span",{className:"font-bold text-navy",children:["#",i.id]})},{key:"status",label:"Status",render:i=>e.jsx(We,{tone:pt(i.status),children:mt(i.status)})},{key:"requestedBy",label:"Submitted by",render:i=>e.jsxs("div",{children:[e.jsx("p",{className:"font-semibold text-navy",children:gt(i)}),e.jsx("p",{className:"text-xs text-muted-foreground",children:i.requestedByEmail})]})},{key:"createdAt",label:"Created",render:i=>ht(i.createdAt)},{key:"actions",label:"Actions",render:i=>e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsxs("button",{type:"button",onClick:()=>{y(i)},className:"inline-flex items-center gap-1 rounded-lg border border-[#c8d5f4] px-3 py-1.5 text-xs font-bold text-navy",children:[e.jsx(Le,{className:"h-3.5 w-3.5"})," Preview"]}),e.jsxs("button",{type:"button",onClick:()=>{T(i,"approve")},disabled:i.status!=="pending"||u===i.id,className:"inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-45",children:[e.jsx(je,{className:"h-3.5 w-3.5"})," Approve"]}),e.jsxs("button",{type:"button",onClick:()=>{T(i,"reject")},disabled:i.status==="published"||u===i.id,className:"inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 disabled:opacity-45",children:[e.jsx(rt,{className:"h-3.5 w-3.5"})," Reject"]}),e.jsxs("button",{type:"button",onClick:()=>{T(i,"publish")},disabled:i.status!=="approved"||u===i.id,className:"inline-flex items-center gap-1 rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-navy disabled:opacity-45",children:[e.jsx(Re,{className:"h-3.5 w-3.5"})," Publish"]})]})}]})}),e.jsx(qe,{title:s?`Request #${s.id}`:"Preview",action:s?e.jsx(We,{tone:pt(s.status),children:mt(s.status)}):null,children:s?e.jsxs("div",{className:"space-y-5",children:[e.jsxs("div",{className:"space-y-1 text-sm",children:[e.jsx("p",{className:"font-bold text-navy",children:gt(s)}),e.jsxs("p",{className:"text-muted-foreground",children:["Submitted ",ht(s.createdAt)]}),s.reviewNote&&e.jsx("p",{className:"rounded-lg bg-[#f3f7ff] p-3 text-slate-700",children:s.reviewNote})]}),e.jsx("div",{className:"grid grid-cols-2 gap-3 text-sm",children:Object.entries(x).map(([i,f])=>e.jsxs("div",{className:"border border-[#e1e9fb] px-3 py-2",children:[e.jsx("p",{className:"text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground",children:i}),e.jsx("p",{className:"mt-1 text-lg font-bold text-navy",children:f})]},i))}),e.jsx("textarea",{value:g,onChange:i=>c(i.target.value),placeholder:"Review note for approval or rejection",className:"min-h-24 w-full rounded-lg border border-[#c8d5f4] bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-gold"}),e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsxs("button",{type:"button",onClick:()=>{L(s)},className:"inline-flex items-center gap-2 rounded-lg border border-[#c8d5f4] bg-white px-4 py-2 text-sm font-bold text-navy",children:[e.jsx(Le,{className:"h-4 w-4"})," Open Preview"]}),e.jsxs("button",{type:"button",onClick:()=>{T(s,"approve")},disabled:s.status!=="pending"||u===s.id,className:"inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-45",children:[e.jsx(je,{className:"h-4 w-4"})," Approve"]}),e.jsxs("button",{type:"button",onClick:()=>{T(s,"reject")},disabled:s.status==="published"||u===s.id,className:"inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-45",children:[e.jsx(rt,{className:"h-4 w-4"})," Reject"]}),e.jsxs("button",{type:"button",onClick:()=>{T(s,"publish")},disabled:s.status!=="approved"||u===s.id,className:"inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-bold text-navy disabled:opacity-45",children:[e.jsx(Re,{className:"h-4 w-4"})," Publish"]})]})]}):e.jsx("p",{className:"text-sm text-muted-foreground",children:"Select a publish request to inspect the site snapshot before approval."})})]})]})}function ps(t){return t==="approved"?"success":t==="rejected"?"danger":t==="published"?"gold":"warning"}function ms(t){return t.charAt(0).toUpperCase()+t.slice(1)}function Be(t){if(!t)return"-";const a=new Date(t);return Number.isNaN(a.getTime())?t:a.toLocaleString()}function gs(){const[t,a]=l.useState([]),[s,d]=l.useState(!0),[g,c]=l.useState("Ready"),v=l.useMemo(()=>({pending:t.filter(u=>u.status==="pending").length,approved:t.filter(u=>u.status==="approved").length,rejected:t.filter(u=>u.status==="rejected").length,published:t.filter(u=>u.status==="published").length}),[t]),N=async()=>{d(!0);try{const u=await $a();a(u),c("Approval status refreshed.")}catch(u){c(u instanceof Error?u.message:"Could not load your approval requests.")}finally{d(!1)}};return l.useEffect(()=>{N()},[]),e.jsxs(e.Fragment,{children:[e.jsx(Mt,{kicker:"Website publishing",title:"Approval Status",children:e.jsxs("button",{type:"button",onClick:()=>{N()},className:"inline-flex items-center gap-2 rounded-lg border border-[#c8d5f4] bg-white px-4 py-2 text-sm font-bold text-navy",children:[e.jsx(Ie,{className:`h-4 w-4 ${s?"animate-spin":""}`})," Refresh"]})}),e.jsxs("div",{className:"grid gap-4 md:grid-cols-4",children:[e.jsx(ye,{label:"Pending",value:v.pending,accent:!0}),e.jsx(ye,{label:"Approved",value:v.approved}),e.jsx(ye,{label:"Rejected",value:v.rejected}),e.jsx(ye,{label:"Published",value:v.published})]}),e.jsx("div",{className:"mt-5 rounded-lg border border-[#d6e0f8] bg-white px-4 py-3 text-sm font-semibold text-[#536690]",children:g}),e.jsx("div",{className:"mt-6",children:e.jsx(qe,{title:"Submitted requests",children:e.jsx(Tt,{rows:t,empty:s?"Loading approval requests...":"No approval requests submitted yet.",columns:[{key:"id",label:"Request",render:u=>e.jsxs("span",{className:"font-bold text-navy",children:["#",u.id]})},{key:"status",label:"Status",render:u=>e.jsx(We,{tone:ps(u.status),children:ms(u.status)})},{key:"createdAt",label:"Submitted",render:u=>Be(u.createdAt)},{key:"reviewedAt",label:"Reviewed",render:u=>Be(u.reviewedAt)},{key:"publishedAt",label:"Published",render:u=>Be(u.publishedAt)},{key:"reviewNote",label:"Review note",render:u=>u.reviewNote||"-"}]})})})]})}const ut=["website_admin","superadmin","masteradmin"],hs=["image/jpeg","image/png"],us=["video/mp4","video/quicktime","video/webm"],xs=5*1024*1024,bs=500*1024*1024,fs=120,Je=[{label:"Website",items:[{id:"dashboard",label:"Dashboard",icon:ca},{id:"studio",label:"Website Studio",icon:Ze},{id:"approvals",label:"Publish Approvals",icon:it},{id:"pages",label:"Pages",icon:Fe},{id:"content",label:"News / Events",icon:Ct},{id:"media",label:"Media Library",icon:$e},{id:"storage",label:"Storage",icon:_e},{id:"design",label:"Design System",icon:Qe}]},{label:"Management",items:[{id:"messages",label:"Messages",icon:pa},{id:"staff",label:"Staff Management",icon:St},{id:"users",label:"Users & Roles",icon:At},{id:"security",label:"Security",icon:Xe},{id:"activity",label:"Activity Logs",icon:it},{id:"backup",label:"Backup",icon:_e},{id:"settings",label:"Settings",icon:ma}]}];function vs(t){return t==="website_admin"?[{label:"Website",items:Je[0].items.filter(s=>["dashboard","studio","approvals","pages","content","media","storage","design"].includes(s.id)).map(s=>s.id==="approvals"?{...s,label:"Approval Status"}:s)}]:Je}const ys=new Set(Je.flatMap(t=>t.items.map(a=>a.id)));function ws(){if(typeof window>"u")return"dashboard";const t=new URLSearchParams(window.location.search).get("panel");return t&&ys.has(t)?t:"dashboard"}function xt(t){if(typeof window>"u")return;const a=new URL(window.location.href);a.pathname="/admin",a.searchParams.set("panel",t),window.history.replaceState(null,"",`${a.pathname}${a.search}${a.hash}`)}function ze(t){return t<1024?`${t} B`:t<1024*1024?`${(t/1024).toFixed(1)} KB`:t<1024*1024*1024?`${(t/1024/1024).toFixed(1)} MB`:t<1024*1024*1024*1024?`${(t/1024/1024/1024).toFixed(2)} GB`:`${(t/1024/1024/1024/1024).toFixed(2)} TB`}async function Se(t,a=1600,s=.82){if(!hs.includes(t.type))throw new Error("Only JPG and PNG image files are allowed.");if(t.size>xs)throw new Error("Image is too large. Maximum image upload is 5 MB.");const d=URL.createObjectURL(t),g=new Image;g.src=d,await new Promise((w,m)=>{g.onload=()=>w(),g.onerror=()=>m(new Error("Could not read image."))});const c=Math.min(1,a/g.width),v=document.createElement("canvas");v.width=Math.max(1,Math.round(g.width*c)),v.height=Math.max(1,Math.round(g.height*c));const N=v.getContext("2d");if(!N)throw new Error("Image optimizer is not available.");N.drawImage(g,0,0,v.width,v.height),URL.revokeObjectURL(d);const u=v.toDataURL("image/png");return{dataUrl:u,original:ze(t.size),optimized:ze(Math.round(u.length*3/4))}}function we({icon:t,label:a,value:s,hint:d,accent:g}){return e.jsx("div",{className:`hover-lift rounded-[1.4rem] border p-5 shadow-soft transition-smooth ${g?"stat-card-shimmer border-gold/40 bg-gold/10":"border-border bg-white"}`,children:e.jsxs("div",{className:"flex items-start justify-between gap-4",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-bold text-muted-foreground",children:a}),e.jsx("p",{className:"mt-2 font-serif text-3xl font-bold text-navy",children:s}),d&&e.jsx("p",{className:"mt-1 text-xs font-semibold text-muted-foreground",children:d})]}),e.jsx("span",{className:`grid h-12 w-12 place-items-center rounded-2xl ${g?"bg-gold text-navy":"bg-navy text-gold"}`,children:e.jsx(t,{className:"h-6 w-6"})})]})})}function X({title:t,kicker:a,children:s,action:d}){return e.jsxs("div",{className:"animate-panel-entry rounded-[1.6rem] border border-border bg-white p-6 shadow-soft",children:[e.jsxs("div",{className:"mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-center",children:[e.jsxs("div",{children:[a&&e.jsx("p",{className:"text-xs font-black uppercase tracking-[0.2em] text-crimson",children:a}),e.jsx("h2",{className:"mt-1 font-serif text-3xl font-bold text-navy",children:t})]}),d]}),s]})}function B(t){return e.jsx("input",{...t,className:`input-line ${t.className||""}`})}function Ne(t){return e.jsx("textarea",{...t,className:`input-line resize-none ${t.className||""}`})}const js=new Set(["home","about","academics","admissions","news","events","sports-clubs","gallery","downloads","student-portal","contact"]);function bt(t){return t==="home"?"/":`/${t}`}function Te(t){return t.split("/").pop().replaceAll("-"," ").replace(/\b\w/g,a=>a.toUpperCase())}function Ns(t){return t.trim().toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,48)}function ks(t,a){let s=t,d=2;for(;a[s];)s=`${t}-${d}`,d+=1;return s}function ft(t,a){const s=new Set([a]),d=[a];for(;d.length;){const g=d.shift();t.filter(c=>c.parentId===g).forEach(c=>{s.has(c.id)||(s.add(c.id),d.push(c.id))})}return s}function Cs({db:t,setActive:a}){const s=t.gallery.length+t.videoGallery.length+t.downloads.length+(t.websiteContent.logoImage?1:0)+(t.websiteContent.heroImage?1:0);return e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"grid gap-4 md:grid-cols-2 xl:grid-cols-4 stagger-children",children:[e.jsx(we,{icon:Fe,label:"Pages",value:Object.keys(t.pages).length,hint:"Main website pages",accent:!0}),e.jsx(we,{icon:ga,label:"News & Notices",value:t.news.length,hint:"Published records"}),e.jsx(we,{icon:ha,label:"Events",value:t.events.length,hint:"Calendar items"}),e.jsx(we,{icon:$e,label:"Media",value:s,hint:"Images / downloads"})]}),e.jsxs("div",{className:"grid gap-6 xl:grid-cols-[1fr_360px]",children:[e.jsx(X,{title:"Quick actions",kicker:"User friendly",children:e.jsx("div",{className:"grid gap-3 md:grid-cols-3 stagger-children",children:[["Edit website","studio",Ze],["Add news","content",Ct],["Upload image","media",le],["Storage status","storage",_e],["Edit pages","pages",Fe],["Design system","design",Qe],["Create backup","backup",_e]].map(([d,g,c])=>e.jsxs("button",{type:"button",onClick:()=>a(g),className:"rounded-2xl border border-border bg-secondary/45 p-5 text-left transition-smooth hover:-translate-y-1 hover:border-gold hover:bg-white hover:shadow-soft",children:[e.jsx(c,{className:"h-7 w-7 text-gold"}),e.jsx("p",{className:"mt-3 font-bold text-navy",children:String(d)}),e.jsx("p",{className:"mt-1 text-xs leading-5 text-muted-foreground",children:"Open this working management panel."})]},String(d)))})}),e.jsx(X,{title:"System health",kicker:"Clean build",children:e.jsx("div",{className:"space-y-4",children:[["Duplicate portal buttons","Fixed"],["Image upload limit","5 MB"],["Video upload limit","500 MB"],["Admin UI","Simplified"],["Website editor","Connected"]].map(([d,g])=>e.jsxs("div",{className:"flex items-center justify-between rounded-2xl bg-secondary/50 px-4 py-3",children:[e.jsx("span",{className:"text-sm font-semibold text-muted-foreground",children:d}),e.jsx("span",{className:"rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700",children:g})]},d))})})]})]})}function Ss({db:t}){const[a,s]=l.useState(""),[d,g]=l.useState(""),c=x=>[...t.navigation].filter(i=>x===null?!i.parentId:i.parentId===x).sort((i,f)=>i.order-f.order),v=x=>ft(t.navigation,x),N=(()=>{const x=[],i=(f,A)=>{c(f).forEach(O=>{t.pages[O.id]&&(x.push({id:O.id,label:O.label,depth:A}),i(O.id,A+1))})};return i(null,0),Object.keys(t.pages).forEach(f=>{t.navigation.some(A=>A.id===f)||x.push({id:f,label:Te(f),depth:0})}),x})(),u=(x,i)=>{$(f=>({...f,pages:{...f.pages,[x]:{...f.pages[x]||{},...i}}}))},w=(x,i)=>{$(f=>({...f,navigation:f.navigation.map(A=>A.id===x?{...A,...i,parentId:i.parentId===null?void 0:i.parentId!==void 0?i.parentId:A.parentId}:A)}))},m=()=>{const x=a.trim(),i=Ns(x);if(!x||!i)return;const f=d?`${d}/${i}`:i;$(A=>{const _=ks(f,A.pages),O=Math.max(0,...A.navigation.map(G=>G.order))+1;return{...A,pages:{...A.pages,[_]:{kicker:d?Te(d):"Page",title:x,body:""}},navigation:[...A.navigation,{id:_,label:x,order:O,visible:!0,parentId:d||void 0}]}}),V(`Page created: ${x}`,"Admin"),s(""),g("")},p=x=>{x!=="home"&&window.confirm(`Delete "${Te(x)}" and any subpages under it?`)&&($(i=>{const f=ft(i.navigation,x),A={...i.pages};return f.forEach(_=>{delete A[_]}),{...i,pages:A,navigation:i.navigation.filter(_=>!f.has(_.id))}}),V(`Page deleted: ${x}`,"Admin"))},b=async(x,i)=>{if(i)try{let A=(await Se(i)).dataUrl;try{A=await xe("page-images",i)}catch(_){if(ue(_))throw _}u(x,{image:A}),V(`Page photo uploaded: ${x}`,"Admin")}catch(f){window.alert(f instanceof Error?f.message:"Page photo upload failed.")}},S=x=>{u(x,{image:""}),V(`Page photo removed: ${x}`,"Admin")},z=["border-l-gold/60","border-l-crimson/50","border-l-navy/30"],y=["bg-white","bg-amber-50/60","bg-slate-50"],L=(x,i=0)=>{const f=t.pages[x];if(!f)return null;const A=t.navigation.find(U=>U.id===x),_=!js.has(x),O=x!=="home",G=A?.parentId?t.navigation.find(U=>U.id===A.parentId):null,ae=v(x),ie=N.filter(U=>U.id!==x&&!ae.has(U.id)),se=c(x).filter(U=>t.pages[U.id]),K=z[Math.min(i,z.length-1)],Z=y[Math.min(i,y.length-1)];return e.jsxs("div",{children:[e.jsxs("div",{className:`rounded-2xl border border-border p-5 ${Z} ${i>0?`border-l-4 ${K}`:""}`,children:[e.jsxs("div",{className:"mb-4 flex items-center justify-between gap-3",children:[e.jsxs("div",{children:[e.jsx("p",{className:"font-serif text-xl font-bold capitalize text-navy",children:A?.label||Te(x)}),e.jsx("p",{className:"text-xs font-semibold text-muted-foreground",children:bt(x)}),G&&e.jsxs("p",{className:"mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-crimson",children:["↳ ".repeat(i),"Under ",G.label]})]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx("a",{href:bt(x),target:"_blank",rel:"noreferrer",className:"rounded-xl border border-border bg-white px-3 py-2 text-xs font-black text-navy",children:"Preview"}),O?e.jsx("button",{type:"button",onClick:()=>p(x),className:"rounded-xl border border-border bg-white p-2 text-crimson",title:"Delete page",children:e.jsx(pe,{className:"h-4 w-4"})}):e.jsx("span",{className:"rounded-xl border border-border bg-white px-3 py-2 text-xs font-black text-muted-foreground",children:"Home"})]})]}),e.jsxs("div",{className:"grid gap-3 md:grid-cols-[1fr_220px]",children:[e.jsx(B,{value:A?.label||Te(x),placeholder:"Menu label",onChange:U=>w(x,{label:U.target.value})}),e.jsxs("select",{value:A?.parentId||"",disabled:!_,onChange:U=>w(x,{parentId:U.target.value||null}),className:"h-12 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-gold disabled:bg-secondary disabled:text-muted-foreground",children:[e.jsx("option",{value:"",children:"Main page"}),ie.map(U=>e.jsxs("option",{value:U.id,children:["– ".repeat(U.depth),"Under ",U.label]},U.id))]})]}),e.jsxs("div",{className:"mt-3 space-y-3",children:[e.jsx(B,{value:f.title||"",placeholder:"Page title",onChange:U=>u(x,{title:U.target.value})}),e.jsx(Ne,{rows:3,value:f.body||"",placeholder:"Page description",onChange:U=>u(x,{body:U.target.value})}),e.jsxs("div",{className:"rounded-2xl border border-border bg-white p-3",children:[f.image?e.jsx("img",{src:f.image,alt:"",className:"mb-3 aspect-[16/7] w-full rounded-xl object-cover"}):e.jsx("div",{className:"mb-3 grid aspect-[16/7] place-items-center rounded-xl bg-secondary text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground",children:"No page photo"}),e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsxs("label",{className:"inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-black text-navy",children:[e.jsx(le,{className:"h-4 w-4"})," Upload photo",e.jsx("input",{type:"file",accept:"image/jpeg,image/png",className:"hidden",onChange:U=>{b(x,U.target.files?.[0])}})]}),f.image&&e.jsxs("button",{type:"button",onClick:()=>S(x),className:"inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-black text-crimson",children:[e.jsx(pe,{className:"h-4 w-4"})," Remove photo"]}),e.jsx("button",{type:"button",onClick:()=>w(x,{visible:!(A?.visible??!0)}),className:`inline-flex items-center rounded-xl px-3 py-2 text-xs font-black ${A?.visible??!0?"bg-emerald-100 text-emerald-700":"bg-slate-200 text-slate-500"}`,children:A?.visible??!0?"Visible in menu":"Hidden from menu"})]})]})]})]}),se.length>0&&e.jsxs("div",{className:`mt-3 space-y-3 border-l-2 pl-5 ${z[Math.min(i,z.length-1)]}`,children:[e.jsxs("p",{className:"pt-1 text-[10px] font-black uppercase tracking-[0.2em] text-crimson",children:["Subpages under ",A?.label||Te(x)]}),se.map(U=>L(U.id,i+1))]})]},x)},T=[...c(null).filter(x=>t.pages[x.id]&&x.id!=="student-portal").map(x=>x.id),...Object.keys(t.pages).filter(x=>!t.navigation.some(i=>i.id===x))];return e.jsxs(X,{title:"Pages",kicker:"Page builder",action:e.jsxs("button",{type:"button",onClick:m,className:"inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-black text-navy",children:[e.jsx(Ce,{className:"h-4 w-4"})," Add page"]}),children:[e.jsxs("div",{className:"mb-6 grid gap-3 rounded-2xl border border-border bg-secondary/30 p-4 md:grid-cols-[minmax(0,1fr)_260px]",children:[e.jsx(B,{value:a,placeholder:"New page title",onChange:x=>s(x.target.value)}),e.jsxs("select",{value:d,onChange:x=>g(x.target.value),className:"h-12 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-gold",children:[e.jsx("option",{value:"",children:"Main page (top level)"}),N.map(x=>e.jsxs("option",{value:x.id,children:["– ".repeat(x.depth),"Subpage under ",x.label]},x.id))]})]}),e.jsx("div",{className:"space-y-5",children:T.map(x=>e.jsx("div",{className:"rounded-[1.4rem] border border-border bg-white p-4 shadow-soft",children:L(x,0)},x))})]})}function As({db:t}){const[a,s]=l.useState(""),[d,g]=l.useState(""),[c,v]=l.useState(""),[N,u]=l.useState("Public"),[w,m]=l.useState(!1),[p,b]=l.useState(""),[S,z]=l.useState(""),[y,L]=l.useState(""),[T,x]=l.useState("School Event"),[i,f]=l.useState(""),[A,_]=l.useState(""),[O,G]=l.useState(!1),ae=l.useRef(null),ie=l.useRef(null),se=async M=>{if(M){m(!0);try{let oe=(await Se(M)).dataUrl;try{oe=await xe("news-images",M)}catch(ce){if(ue(ce))throw ce}v(oe)}catch(J){window.alert(J instanceof Error?J.message:"Image upload failed.")}finally{m(!1)}}},K=async M=>{if(M){G(!0);try{let oe=(await Se(M)).dataUrl;try{oe=await xe("event-images",M)}catch(ce){if(ue(ce))throw ce}_(oe)}catch(J){window.alert(J instanceof Error?J.message:"Image upload failed.")}finally{G(!1)}}},Z=()=>{a.trim()&&($(M=>({...M,news:[{id:ve("NEWS"),title:a.trim(),date:new Date().toISOString().slice(0,10),body:d.trim()||"Updated by website admin.",audience:N,image:c||void 0},...M.news]})),V(`News added: ${a}`,"Admin"),s(""),g(""),v(""),u("Public"),ae.current&&(ae.current.value=""))},U=()=>{p.trim()&&($(M=>({...M,events:[{id:ve("EVT"),title:p.trim(),date:S||new Date().toISOString().slice(0,10),location:y.trim()||"Loyola College",type:T||"School Event",description:i.trim()||void 0,image:A||void 0},...M.events]})),V(`Event added: ${p}`,"Admin"),b(""),z(""),L(""),x("School Event"),f(""),_(""),ie.current&&(ie.current.value=""))},me=M=>$(J=>({...J,news:J.news.filter(oe=>oe.id!==M)})),ge=M=>$(J=>({...J,events:J.events.filter(oe=>oe.id!==M)}));return e.jsxs("div",{className:"grid gap-6 xl:grid-cols-2",children:[e.jsxs(X,{title:"News & notices",kicker:"Content manager",action:e.jsxs("button",{type:"button",onClick:Z,className:"rounded-xl bg-gold px-4 py-2 text-sm font-black text-navy",children:[e.jsx(Ce,{className:"mr-2 inline h-4 w-4"}),"Add News"]}),children:[e.jsxs("div",{className:"space-y-3",children:[e.jsx(B,{placeholder:"News / notice title",value:a,onChange:M=>s(M.target.value)}),e.jsx(Ne,{rows:3,placeholder:"Short description",value:d,onChange:M=>g(M.target.value)}),e.jsxs("select",{value:N,onChange:M=>u(M.target.value),className:"h-12 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-gold",children:[e.jsx("option",{value:"Public",children:"Public"}),e.jsx("option",{value:"Students",children:"Students"}),e.jsx("option",{value:"Parents",children:"Parents"}),e.jsx("option",{value:"Staff",children:"Staff"})]}),e.jsxs("div",{className:"rounded-2xl border border-border bg-white p-3",children:[c?e.jsxs("div",{className:"mb-3 relative",children:[e.jsx("img",{src:c,alt:"News preview",className:"aspect-[16/7] w-full rounded-xl object-cover"}),e.jsx("button",{type:"button",onClick:()=>{v(""),ae.current&&(ae.current.value="")},className:"absolute top-2 right-2 rounded-lg bg-white/90 p-1.5 text-crimson shadow",title:"Remove photo",children:e.jsx(pe,{className:"h-4 w-4"})})]}):e.jsx("div",{className:"mb-3 grid aspect-[16/7] place-items-center rounded-xl bg-secondary text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground",children:w?"Uploading…":"No photo attached"}),e.jsxs("label",{className:"inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-black text-navy",children:[e.jsx(le,{className:"h-4 w-4"}),w?"Uploading…":"Upload photo",e.jsx("input",{ref:ae,type:"file",accept:"image/jpeg,image/png",className:"hidden",disabled:w,onChange:M=>{se(M.target.files?.[0])}})]})]})]}),e.jsx("div",{className:"mt-6 space-y-2",children:t.news.map(M=>e.jsxs("div",{className:"flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-3",children:[M.image&&e.jsx("img",{src:M.image,alt:"",className:"h-12 w-16 shrink-0 rounded-xl object-cover"}),e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("p",{className:"truncate font-bold text-navy",children:M.title}),e.jsxs("p",{className:"text-xs text-muted-foreground",children:[M.date," · ",M.audience]})]}),e.jsx("button",{type:"button",onClick:()=>me(M.id),className:"shrink-0 rounded-xl border border-border bg-white p-2 text-crimson",children:e.jsx(pe,{className:"h-4 w-4"})})]},M.id))})]}),e.jsxs(X,{title:"Events",kicker:"Calendar manager",action:e.jsxs("button",{type:"button",onClick:U,className:"rounded-xl bg-gold px-4 py-2 text-sm font-black text-navy",children:[e.jsx(Ce,{className:"mr-2 inline h-4 w-4"}),"Add Event"]}),children:[e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"grid gap-3 md:grid-cols-[1fr_160px]",children:[e.jsx(B,{placeholder:"Event title",value:p,onChange:M=>b(M.target.value)}),e.jsx(B,{type:"date",value:S,onChange:M=>z(M.target.value)})]}),e.jsxs("div",{className:"grid gap-3 md:grid-cols-2",children:[e.jsx(B,{placeholder:"Location (e.g. Main Hall)",value:y,onChange:M=>L(M.target.value)}),e.jsxs("select",{value:T,onChange:M=>x(M.target.value),className:"h-12 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-gold",children:[e.jsx("option",{value:"School Event",children:"School Event"}),e.jsx("option",{value:"Sports",children:"Sports"}),e.jsx("option",{value:"Academic",children:"Academic"}),e.jsx("option",{value:"Cultural",children:"Cultural"}),e.jsx("option",{value:"Religious",children:"Religious"}),e.jsx("option",{value:"Community",children:"Community"}),e.jsx("option",{value:"Other",children:"Other"})]})]}),e.jsx(Ne,{rows:2,placeholder:"Event description (optional)",value:i,onChange:M=>f(M.target.value)}),e.jsxs("div",{className:"rounded-2xl border border-border bg-white p-3",children:[A?e.jsxs("div",{className:"mb-3 relative",children:[e.jsx("img",{src:A,alt:"Event preview",className:"aspect-[16/7] w-full rounded-xl object-cover"}),e.jsx("button",{type:"button",onClick:()=>{_(""),ie.current&&(ie.current.value="")},className:"absolute top-2 right-2 rounded-lg bg-white/90 p-1.5 text-crimson shadow",title:"Remove photo",children:e.jsx(pe,{className:"h-4 w-4"})})]}):e.jsx("div",{className:"mb-3 grid aspect-[16/7] place-items-center rounded-xl bg-secondary text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground",children:O?"Uploading…":"No event photo"}),e.jsxs("label",{className:"inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-black text-navy",children:[e.jsx(le,{className:"h-4 w-4"}),O?"Uploading…":"Upload event photo",e.jsx("input",{ref:ie,type:"file",accept:"image/jpeg,image/png",className:"hidden",disabled:O,onChange:M=>{K(M.target.files?.[0])}})]})]})]}),e.jsx("div",{className:"mt-6 space-y-2",children:t.events.map(M=>e.jsxs("div",{className:"flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-3",children:[M.image&&e.jsx("img",{src:M.image,alt:"",className:"h-12 w-16 shrink-0 rounded-xl object-cover"}),e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("p",{className:"truncate font-bold text-navy",children:M.title}),e.jsxs("p",{className:"text-xs text-muted-foreground",children:[M.date," · ",M.location," · ",M.type]})]}),e.jsx("button",{type:"button",onClick:()=>ge(M.id),className:"shrink-0 rounded-xl border border-border bg-white p-2 text-crimson",children:e.jsx(pe,{className:"h-4 w-4"})})]},M.id))})]})]})}function Ms({refreshKey:t=0}){const a=De(),[s,d]=l.useState(t),[g,c]=l.useState([]);l.useEffect(()=>{let p=!1;return fetch(`${be}/api/media?ts=${Date.now()}`,{headers:{Accept:"application/json",...Ee()}}).then(b=>b.ok?b.json():[]).then(b=>{p||c(Array.isArray(b)?b:[])}).catch(()=>{p||c([])}),()=>{p=!0}},[s]);const v=(()=>{const p=new Set,b=new Set(["/flag1.png","/loyola-crest.jpg"]),S=y=>{const L=y.split("?")[0];try{return b.has(new URL(L).pathname)}catch{return b.has(L)}},z=y=>{const L=y?.trim();L&&(S(L)||L.startsWith("data:")||p.add(L))};return z(a.websiteContent.heroImage),z(a.websiteContent.backgroundMediaUrl),z(a.websiteContent.logoImage),z(a.websiteContent.seo.ogImage),z(a.media.campusImage),z(a.media.aboutImage),z(a.media.principalImage),Object.values(a.pages).forEach(y=>{z(y.image),z(y.backgroundMediaUrl),z(y.anthemVideoCoverImage)}),a.news.forEach(y=>z(y.image)),a.gallery.forEach(y=>{z(y.image),y.images?.forEach(z)}),a.videoGallery.forEach(y=>{z(y.coverImage),y.videos.forEach(L=>{z(L.url),z(L.webmUrl),z(L.thumbnail)})}),a.teachers.forEach(y=>z(y.image)),a.downloads.forEach(y=>z(y.fileUrl)),[...p]})(),N=Array.from(g.reduce((p,b)=>{const S=b.category||"Uncategorized";return p.set(S,(p.get(S)||0)+1),p},new Map)).sort(([p],[b])=>p.localeCompare(b)),u=v.reduce((p,b)=>{const S=b.toLowerCase().split("?")[0];return/\.(mp4|webm|mov|m4v)$/.test(S)||S.includes("gallery-videos")?p.videos+=1:/\.(pdf|doc|docx|xls|xlsx|zip)$/.test(S)?p.documents+=1:/\.(jpg|jpeg|png|webp|gif)$/.test(S)||S.includes("images")?p.photos+=1:p.other+=1,p},{photos:0,videos:0,documents:0,other:0}),w=[{label:"Photos",count:u.photos},{label:"Videos",count:u.videos},{label:"Documents",count:u.documents},{label:"Other files",count:u.other}],m=p=>{try{if(p.startsWith("gs://"))return p.replace(/^gs:\/\/[^/]+\//,"");const b=new URL(p),S=b.pathname.split("/o/")[1]?.split("?")[0];return decodeURIComponent(S||b.pathname.split("/").pop()||p)}catch{return p}};return e.jsxs(X,{title:"Backend storage",kicker:"MySQL + uploads",action:e.jsxs("button",{type:"button",onClick:()=>d(p=>p+1),className:"inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-xs font-black text-navy",children:[e.jsx(Ie,{className:"h-4 w-4"})," Refresh"]}),children:[e.jsxs("div",{className:"grid gap-4 lg:grid-cols-[1.2fr_0.8fr]",children:[e.jsxs("div",{children:[e.jsxs("div",{className:"grid gap-3 sm:grid-cols-3",children:[e.jsxs("div",{className:"rounded-2xl border border-border bg-secondary/35 p-4",children:[e.jsx("p",{className:"text-xs font-black uppercase tracking-[0.16em] text-muted-foreground",children:"Database"}),e.jsx("p",{className:"mt-2 text-2xl font-black text-navy",children:"MySQL"})]}),e.jsxs("div",{className:"rounded-2xl border border-border bg-secondary/35 p-4",children:[e.jsx("p",{className:"text-xs font-black uppercase tracking-[0.16em] text-muted-foreground",children:"Media"}),e.jsx("p",{className:"mt-2 text-2xl font-black text-navy",children:v.length})]}),e.jsxs("div",{className:"rounded-2xl border border-border bg-secondary/35 p-4",children:[e.jsx("p",{className:"text-xs font-black uppercase tracking-[0.16em] text-muted-foreground",children:"Hosting"}),e.jsx("p",{className:"mt-2 text-2xl font-black text-navy",children:"Hostinger-ready backend"})]})]}),e.jsxs("div",{className:"mt-5",children:[e.jsxs("div",{className:"mb-2 flex items-center justify-between gap-3 text-sm font-bold text-navy",children:[e.jsx("span",{children:"MySQL is the active database and backend/uploads is the media storage."}),e.jsxs("span",{children:[v.length," stored media reference",v.length===1?"":"s"]})]}),e.jsx("div",{className:"h-3 overflow-hidden rounded-full bg-secondary",children:e.jsx("div",{className:"h-full rounded-full bg-gold transition-all",style:{width:"100%"}})}),e.jsx("p",{className:"mt-2 text-xs font-semibold text-muted-foreground",children:"Site content is saved in MySQL. Media uploads are saved to the protected backend/uploads folder."})]})]}),e.jsxs("div",{className:"grid gap-2 sm:grid-cols-2 lg:grid-cols-1",children:[w.map(p=>e.jsxs("div",{className:"flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-black text-navy",children:p.label}),e.jsxs("p",{className:"text-xs font-semibold text-muted-foreground",children:[p.count," file",p.count===1?"":"s"]})]}),e.jsx("p",{className:"text-sm font-black text-navy",children:p.count})]},p.label)),N.length?e.jsxs("div",{className:"rounded-2xl border border-border bg-white px-4 py-3",children:[e.jsx("p",{className:"text-sm font-black text-navy",children:"Saved categories"}),e.jsx("div",{className:"mt-2 flex flex-wrap gap-2",children:N.map(([p,b])=>e.jsxs("span",{className:"rounded-full bg-secondary px-3 py-1 text-[11px] font-black text-navy",children:[p,": ",b]},p))})]}):null]})]}),v.length?e.jsxs("div",{className:"mt-5 border-t border-border pt-5",children:[e.jsx("p",{className:"mb-3 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground",children:"Stored media references"}),e.jsx("div",{className:"grid gap-2 md:grid-cols-2",children:v.slice(0,6).map(p=>e.jsxs("a",{href:p,target:"_blank",rel:"noreferrer",className:"flex items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/30 px-4 py-3 text-sm",children:[e.jsx("span",{className:"min-w-0 truncate font-bold text-navy",children:m(p)}),e.jsx("span",{className:"shrink-0 font-black text-muted-foreground",children:"Open"})]},p))})]}):null]})}function Ut(t){try{const a=new URL(t),s=a.hostname.replace(/^www\./,"");if(s==="youtu.be")return a.pathname.split("/").filter(Boolean)[0]||"";if(s==="youtube.com"||s==="m.youtube.com"||s==="music.youtube.com"){if(a.pathname==="/watch")return a.searchParams.get("v")||"";const d=a.pathname.split("/").filter(Boolean);if(["embed","shorts","live"].includes(d[0]))return d[1]||""}}catch{return""}return""}function Ts(t){const a=Ut(t);return a?`https://www.youtube.com/embed/${a}`:""}function vt({video:t,cover:a,className:s="aspect-video w-full rounded-lg bg-black"}){const d=Ts(t.url);return d?e.jsx("iframe",{src:d,title:t.name,allow:"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",allowFullScreen:!0,className:s}):e.jsxs("video",{controls:!0,poster:a,className:s,children:[t.webmUrl&&e.jsx("source",{src:t.webmUrl,type:"video/webm"}),e.jsx("source",{src:t.url,type:"video/mp4"})]})}function Ps({db:t}){const[a,s]=l.useState("Create an album, then upload up to 10 JPG/PNG images."),[d,g]=l.useState(null),[c,v]=l.useState(""),[N,u]=l.useState(""),[w,m]=l.useState(""),[p,b]=l.useState(""),[S,z]=l.useState(""),[y,L]=l.useState(""),[T,x]=l.useState(t.gallery[0]?.id||""),[i,f]=l.useState(t.videoGallery[0]?.id||""),A=l.useRef(null),_=l.useRef(null),O=l.useRef(null),G=l.useRef(null),ae=()=>{const n=c.trim()||"New Gallery Album",C=ve("ALBUM");$(h=>({...h,gallery:[{id:C,label:n,image:"",images:[],description:"",link:N.trim(),visible:!0},...h.gallery]})),V(`Album created: ${n}`,"Admin"),x(C),v(""),u(""),s(`Album created: ${n}`)},ie=()=>{const n=w.trim()||"New Video Album",C=ve("VIDEOALBUM");$(h=>({...h,videoGallery:[{id:C,label:n,coverImage:"",videos:[],description:"",link:p.trim(),visible:!0},...h.videoGallery]})),V(`Video album created: ${n}`,"Admin"),f(C),m(""),b(""),s(`Video album created: ${n}`)},se=(n,C)=>{$(h=>({...h,gallery:h.gallery.map(P=>P.id===n?{...P,...C}:P)}))},K=(n,C)=>{$(h=>({...h,videoGallery:h.videoGallery.map(P=>P.id===n?{...P,...C}:P)}))},Z=n=>{window.confirm("Delete this album and its media?")&&($(C=>({...C,gallery:C.gallery.filter(h=>h.id!==n)})),T===n&&x(""),V(`Album deleted: ${n}`,"Admin"))},U=n=>{window.confirm("Delete this video album and its videos?")&&($(C=>({...C,videoGallery:C.videoGallery.filter(h=>h.id!==n)})),i===n&&f(""),V(`Video album deleted: ${n}`,"Admin"))},me=(n,C)=>{$(h=>({...h,gallery:h.gallery.map(P=>{if(P.id!==n)return P;const I=(P.images||[P.image]).filter(Boolean).filter(R=>R!==C);return{...P,images:I,image:I[0]||""}})}))},ge=(n,C)=>{$(h=>({...h,videoGallery:h.videoGallery.map(P=>P.id===n?{...P,videos:(P.videos||[]).filter(I=>I.id!==C)}:P)}))},M=async n=>{const C=T||t.gallery[0]?.id;if(!n?.length||!C){s("Create or select an album before uploading images.");return}const h=t.gallery.find(Q=>Q.id===C),P=(h?.images||(h?.image?[h.image]:[])).filter(Boolean),I=Math.max(0,10-P.length),R=Array.from(n).slice(0,I);if(R.length===0){s("This album already has the maximum 10 images.");return}try{s(`Optimizing ${R.length} image${R.length===1?"":"s"}...`);const Q=await Promise.all(R.map(E=>Se(E,900,.72)));s(`Uploading ${R.length} image${R.length===1?"":"s"}...`);const o=await Promise.all(R.map(async(E,H)=>{try{return await xe("gallery-images",E)}catch(r){if(ue(r))throw r;return Q[H].dataUrl}})),j=[...P,...o].slice(0,10);$(E=>({...E,gallery:E.gallery.map(H=>H.id===C?{...H,images:j,image:j[0]||H.image}:H)})),V(`Album images uploaded: ${R.length}`,"Admin");const k=o.filter(E=>!E.startsWith("data:")).length;s(k===o.length?`Uploaded ${R.length} image${R.length===1?"":"s"} to backend storage. Album limit is 10.`:`Saved ${R.length} image${R.length===1?"":"s"}; ${k} uploaded to backend storage. Album limit is 10.`)}catch(Q){s(Q instanceof Error?Q.message:"Upload failed.")}},J=async n=>{const C=T||t.gallery[0]?.id;if(!n||!C){s("Create or select an album before uploading a cover photo.");return}try{s("Uploading album cover photo...");let P=(await Se(n,1200,.78)).dataUrl;try{P=await xe("gallery-covers",n)}catch(I){if(ue(I))throw I}$(I=>({...I,gallery:I.gallery.map(R=>{if(R.id!==C)return R;const Q=(R.images||(R.image?[R.image]:[])).filter(Boolean),o=[P,...Q.filter(j=>j!==P)].slice(0,10);return{...R,image:P,images:o}})})),V(`Album cover uploaded: ${C}`,"Admin"),s("Album cover photo updated.")}catch(h){s(h instanceof Error?h.message:"Cover photo upload failed.")}},oe=async n=>{const C=i||t.videoGallery[0]?.id;if(!n||!C){s("Create or select a video album before uploading a cover photo.");return}try{s("Uploading video album cover photo...");let P=(await Se(n,1200,.78)).dataUrl;try{P=await xe("video-gallery-covers",n)}catch(I){if(ue(I))throw I}$(I=>({...I,videoGallery:I.videoGallery.map(R=>R.id===C?{...R,coverImage:P}:R)})),V(`Video album cover uploaded: ${C}`,"Admin"),s("Video album cover photo updated.")}catch(h){s(h instanceof Error?h.message:"Video cover photo upload failed.")}},ce=async n=>{if(!n)return;const C=i||t.videoGallery[0]?.id;if(!C){s("Create or select a video album before uploading videos.");return}if(!us.includes(n.type)){s("Only MP4, MOV, and WebM videos are allowed.");return}if(n.size>bs){s("Video is too large. Maximum video upload is 500 MB.");return}try{s(`Uploading and optimizing short video: ${ze(n.size)}. Maximum duration is 2 minutes.`);const h=await Pa("gallery-videos",n),P=h.fileUrl||h.url,I=h.webmUrl||"",R={id:ve("VID"),name:h.file?.name||n.name,url:P,webmUrl:I,size:h.file?.size||n.size,durationSeconds:h.file?.durationSeconds||null,uploadedAt:new Date().toISOString(),source:"upload",mediaType:"short_video_upload"};$(Q=>({...Q,videoGallery:Q.videoGallery.map(o=>o.id===C?{...o,videos:[R,...o.videos||[]]}:o)})),g({name:R.name,url:P,webmUrl:I,size:ze(R.size),source:"upload"}),V(`Short video uploaded and optimized: ${n.name}`,"Admin"),s(`Short video optimized as WebM and MP4: ${ze(R.size)}. For long videos, please use a YouTube link to save hosting storage and bandwidth.`)}catch(h){s(h instanceof Error?h.message:"Short video upload failed. For long videos, please use a YouTube link to save hosting storage and bandwidth.")}},D=()=>{const n=i||t.videoGallery[0]?.id,C=S.trim(),h=Ut(C);if(!n){s("Create or select a video album before adding a YouTube video.");return}if(!h){s("Paste a valid YouTube video link.");return}const P=y.trim()||"YouTube video",I=`https://img.youtube.com/vi/${h}/hqdefault.jpg`,R={id:ve("YT"),name:P,url:C,size:0,uploadedAt:new Date().toISOString(),source:"youtube",mediaType:"youtube_video",thumbnail:I};$(Q=>({...Q,videoGallery:Q.videoGallery.map(o=>o.id===n?{...o,videos:[R,...o.videos||[]]}:o)})),g({name:P,url:C,size:"YouTube",source:"youtube"}),z(""),L(""),V(`YouTube video added: ${P}`,"Admin"),s("YouTube video added to the album.")},q=t.gallery.find(n=>n.id===T)||t.gallery[0],ee=t.videoGallery.find(n=>n.id===i)||t.videoGallery[0];return e.jsx("div",{className:"space-y-6",children:e.jsxs("div",{className:"grid gap-6 xl:grid-cols-[360px_1fr]",children:[e.jsxs("div",{className:"space-y-6",children:[e.jsxs(X,{title:"Albums & photos",kicker:"Media library",children:[e.jsx("input",{ref:A,type:"file",accept:"image/jpeg,image/png",multiple:!0,className:"hidden",onChange:n=>{M(n.target.files),n.currentTarget.value=""}}),e.jsx("input",{ref:_,type:"file",accept:"image/jpeg,image/png",className:"hidden",onChange:n=>{J(n.target.files?.[0]),n.currentTarget.value=""}}),e.jsx("input",{ref:O,type:"file",accept:"video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm",className:"hidden",onChange:n=>{ce(n.target.files?.[0]),n.currentTarget.value=""}}),e.jsx("input",{ref:G,type:"file",accept:"image/jpeg,image/png",className:"hidden",onChange:n=>{oe(n.target.files?.[0]),n.currentTarget.value=""}}),e.jsxs("div",{className:"space-y-4",children:[e.jsx(Et,{}),e.jsx(B,{value:c,placeholder:"Album name",onChange:n=>v(n.target.value)}),e.jsx(B,{value:N,placeholder:"Show more link, e.g. https://example.com",onChange:n=>u(n.target.value)}),e.jsxs("button",{type:"button",onClick:ae,className:"flex w-full items-center justify-center gap-3 rounded-2xl bg-gold px-5 py-4 text-sm font-black text-navy",children:[e.jsx(Ce,{className:"h-5 w-5"})," Create album"]}),e.jsxs("select",{value:q?.id||"",onChange:n=>x(n.target.value),className:"h-12 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-gold",children:[e.jsx("option",{value:"",children:"Select album"}),t.gallery.map(n=>e.jsx("option",{value:n.id,children:n.label},n.id))]}),e.jsxs("button",{type:"button",onClick:()=>A.current?.click(),className:"flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gold/50 bg-gold/10 px-5 py-10 text-sm font-black text-navy",children:[e.jsx(le,{className:"h-6 w-6"})," Upload JPG / PNG images"]}),e.jsxs("button",{type:"button",onClick:()=>_.current?.click(),className:"flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-white px-5 py-4 text-sm font-black text-navy",children:[e.jsx($e,{className:"h-5 w-5"})," Upload album cover photo"]})]})]}),e.jsx(X,{title:"Video uploads",kicker:"Short videos & YouTube",children:e.jsxs("div",{className:"space-y-4",children:[e.jsx("p",{className:"rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800",children:"For long videos, please use a YouTube link to save hosting storage and bandwidth."}),e.jsxs("div",{className:"grid grid-cols-2 gap-2 text-xs font-black text-navy",children:[e.jsxs("span",{className:"inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 py-2",children:[e.jsx(Ge,{className:"h-3.5 w-3.5"})," Short video upload"]}),e.jsxs("span",{className:"inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 py-2",children:[e.jsx(Ze,{className:"h-3.5 w-3.5"})," YouTube video"]})]}),e.jsx(B,{value:w,placeholder:"Video album name",onChange:n=>m(n.target.value)}),e.jsx(B,{value:p,placeholder:"Video show more link, e.g. https://youtube.com/@channel",onChange:n=>b(n.target.value)}),e.jsxs("button",{type:"button",onClick:ie,className:"flex w-full items-center justify-center gap-3 rounded-2xl bg-navy px-5 py-4 text-sm font-black text-white",children:[e.jsx(Ce,{className:"h-5 w-5"})," Create video album"]}),e.jsxs("select",{value:ee?.id||"",onChange:n=>f(n.target.value),className:"h-12 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-gold",children:[e.jsx("option",{value:"",children:"Select video album"}),t.videoGallery.map(n=>e.jsx("option",{value:n.id,children:n.label},n.id))]}),e.jsxs("button",{type:"button",onClick:()=>G.current?.click(),className:"flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-white px-5 py-4 text-sm font-black text-navy",children:[e.jsx($e,{className:"h-5 w-5"})," Upload video album cover"]}),e.jsxs("button",{type:"button",onClick:()=>O.current?.click(),className:"flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-navy/30 bg-secondary px-5 py-8 text-sm font-black text-navy",children:[e.jsx(Ge,{className:"h-6 w-6"})," Upload short MP4 / MOV / WebM video"]}),e.jsxs("p",{className:"text-xs font-semibold leading-5 text-muted-foreground",children:["Short uploads are converted to compressed WebM and MP4 files. Maximum duration:"," ",fs/60," minutes."]}),e.jsxs("div",{className:"rounded-2xl border border-border bg-white p-4",children:[e.jsx("p",{className:"mb-3 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground",children:"Add YouTube video"}),e.jsxs("div",{className:"space-y-3",children:[e.jsx(B,{value:S,placeholder:"YouTube link",onChange:n=>z(n.target.value)}),e.jsx(B,{value:y,placeholder:"Video title",onChange:n=>L(n.target.value)}),e.jsxs("button",{type:"button",onClick:D,className:"flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-sm font-black text-white",children:[e.jsx(Ce,{className:"h-4 w-4"})," Add YouTube preview"]})]})]})]})}),e.jsx("div",{className:"rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800",children:a})]}),e.jsxs("div",{className:"space-y-6",children:[e.jsx(X,{title:"Photo albums",kicker:"Images",children:e.jsx("div",{className:"grid gap-3 md:grid-cols-2 2xl:grid-cols-3",children:t.gallery.map(n=>{const C=(n.images||(n.image?[n.image]:[])).filter(Boolean).slice(0,10);return e.jsxs("div",{className:"overflow-hidden rounded-xl border border-border bg-white shadow-soft",children:[e.jsxs("div",{className:"group relative overflow-hidden",children:[e.jsx("img",{src:C[0]||"/loyola-crest.jpg",alt:n.label,className:"aspect-video w-full object-cover transition duration-300 group-hover:scale-[1.03]"}),e.jsxs("button",{type:"button",onClick:()=>{x(n.id),_.current?.click()},className:"absolute inset-0 flex items-center justify-center gap-2 bg-navy/72 text-sm font-black text-white opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100",children:[e.jsx(le,{className:"h-4 w-4"})," Change cover"]})]}),e.jsxs("div",{className:"p-3",children:[e.jsxs("div",{className:"grid gap-2",children:[e.jsx(B,{value:n.label,placeholder:"Album title",onChange:h=>se(n.id,{label:h.target.value})}),e.jsx(Ne,{rows:2,value:n.description||"",placeholder:"Album description",onChange:h=>se(n.id,{description:h.target.value})}),e.jsx(B,{value:n.link||"",placeholder:"Show more website link",onChange:h=>se(n.id,{link:h.target.value})})]}),e.jsx("div",{className:"mt-3 grid grid-cols-5 gap-1.5",children:C.map(h=>e.jsxs("button",{type:"button",onClick:()=>me(n.id,h),title:"Remove image",className:"group relative overflow-hidden rounded-md border border-border bg-secondary",children:[e.jsx("img",{src:h,alt:"",className:"aspect-square w-full object-cover"}),e.jsx("span",{className:"absolute inset-0 grid place-items-center bg-crimson/72 text-white opacity-0 transition-opacity group-hover:opacity-100",children:e.jsx(pe,{className:"h-3.5 w-3.5"})})]},h))}),e.jsxs("div",{className:"mt-3 flex flex-wrap gap-1.5",children:[e.jsx("button",{type:"button",onClick:()=>{x(n.id),A.current?.click()},className:"rounded-lg border border-border px-2.5 py-1.5 text-xs font-black text-navy",children:"Add images"}),e.jsx("button",{type:"button",onClick:()=>{x(n.id),_.current?.click()},className:"rounded-lg border border-border px-2.5 py-1.5 text-xs font-black text-navy",children:"Cover photo"}),e.jsx("button",{type:"button",onClick:()=>se(n.id,{visible:n.visible===!1}),className:`rounded-lg px-2.5 py-1.5 text-xs font-black ${n.visible===!1?"bg-slate-200 text-slate-500":"bg-emerald-100 text-emerald-700"}`,children:n.visible===!1?"Hidden":"Visible"}),e.jsx("button",{type:"button",onClick:()=>Z(n.id),className:"rounded-lg border border-border px-2.5 py-1.5 text-xs font-black text-crimson",children:"Delete"})]})]})]},n.id)})})}),e.jsxs(X,{title:"Video albums",kicker:"Videos",children:[d&&e.jsxs("div",{className:"mb-5 grid gap-4 rounded-xl border border-border bg-secondary/40 p-4 md:grid-cols-[220px_1fr]",children:[e.jsx(vt,{video:{id:"preview",name:d.name,url:d.url,webmUrl:d.webmUrl,size:0,uploadedAt:new Date().toISOString(),source:d.source},className:"aspect-video w-full rounded-lg bg-black"}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"text-xs font-black uppercase tracking-[0.16em] text-muted-foreground",children:"Session preview"}),e.jsx("p",{className:"mt-2 truncate font-bold text-navy",children:d.name}),e.jsx("p",{className:"mt-1 text-xs text-muted-foreground",children:d.size})]})]}),e.jsxs("div",{className:"grid gap-3 lg:grid-cols-2",children:[t.videoGallery.map(n=>{const C=n.videos||[];return e.jsxs("div",{className:"rounded-xl border border-border bg-white p-3 shadow-soft",children:[e.jsxs("div",{className:"mb-3 flex items-center justify-between gap-3",children:[e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"truncate font-black text-navy",children:n.label}),e.jsxs("p",{className:"text-xs font-semibold text-muted-foreground",children:[C.length," video",C.length===1?"":"s"]})]}),e.jsx("button",{type:"button",onClick:()=>{f(n.id),O.current?.click()},className:"shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-black text-navy",children:"Add video"})]}),e.jsxs("div",{className:"mb-3 grid gap-2",children:[e.jsx(B,{value:n.label,placeholder:"Video album title",onChange:h=>K(n.id,{label:h.target.value})}),e.jsx(Ne,{rows:2,value:n.description||"",placeholder:"Video album description",onChange:h=>K(n.id,{description:h.target.value})}),e.jsx(B,{value:n.link||"",placeholder:"Show more website link",onChange:h=>K(n.id,{link:h.target.value})}),e.jsxs("div",{className:"flex flex-wrap gap-1.5",children:[e.jsx("button",{type:"button",onClick:()=>{f(n.id),G.current?.click()},className:"rounded-lg border border-border px-2.5 py-1.5 text-xs font-black text-navy",children:"Cover photo"}),e.jsx("button",{type:"button",onClick:()=>K(n.id,{visible:n.visible===!1}),className:`rounded-lg px-2.5 py-1.5 text-xs font-black ${n.visible===!1?"bg-slate-200 text-slate-500":"bg-emerald-100 text-emerald-700"}`,children:n.visible===!1?"Hidden":"Visible"}),e.jsx("button",{type:"button",onClick:()=>U(n.id),className:"rounded-lg border border-border px-2.5 py-1.5 text-xs font-black text-crimson",children:"Delete"})]})]}),e.jsx("div",{className:"space-y-2",children:C.map(h=>e.jsxs("div",{className:"grid gap-3 rounded-lg border border-border bg-secondary/35 p-2 sm:grid-cols-[150px_1fr]",children:[e.jsx(vt,{video:h,cover:n.coverImage||h.thumbnail,className:"aspect-video w-full rounded-md bg-black"}),e.jsxs("div",{className:"flex min-w-0 items-center justify-between gap-3",children:[e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"truncate text-xs font-black text-navy",children:h.name}),e.jsxs("p",{className:"text-xs font-semibold text-muted-foreground",children:[h.size>0?ze(h.size):"YouTube",h.durationSeconds?` - ${Math.round(h.durationSeconds)}s`:""]})]}),e.jsx("button",{type:"button",onClick:()=>ge(n.id,h.id),className:"shrink-0 rounded-md border border-border bg-white px-2 py-1 text-xs font-black text-crimson",children:"Remove"})]})]},h.id))})]},n.id)}),t.videoGallery.length===0&&e.jsx("div",{className:"rounded-xl border border-dashed border-border bg-secondary/35 p-6 text-sm font-semibold text-muted-foreground",children:"No video albums added yet."})]})]})]})]})})}function zs({db:t}){const a=s=>$(d=>({...d,websiteContent:{...d.websiteContent,...s}}));return e.jsx(X,{title:"Design system",kicker:"Professional UI",children:e.jsxs("div",{className:"grid gap-6 lg:grid-cols-2",children:[e.jsxs("div",{className:"space-y-5",children:[e.jsxs("label",{className:"block",children:[e.jsx("span",{className:"text-xs font-black uppercase tracking-[0.18em] text-muted-foreground",children:"Primary color"}),e.jsx("input",{type:"color",value:t.websiteContent.primaryColor,onChange:s=>a({primaryColor:s.target.value}),className:"mt-2 h-14 w-full rounded-2xl border border-border bg-white p-1"})]}),e.jsxs("label",{className:"block",children:[e.jsx("span",{className:"text-xs font-black uppercase tracking-[0.18em] text-muted-foreground",children:"Accent color"}),e.jsx("input",{type:"color",value:t.websiteContent.accentColor,onChange:s=>a({accentColor:s.target.value}),className:"mt-2 h-14 w-full rounded-2xl border border-border bg-white p-1"})]}),e.jsxs("label",{className:"block",children:[e.jsx("span",{className:"text-xs font-black uppercase tracking-[0.18em] text-muted-foreground",children:"Custom CSS"}),e.jsx(Ne,{rows:7,value:t.websiteContent.customCss,onChange:s=>a({customCss:s.target.value})})]})]}),e.jsx("div",{className:"rounded-[1.4rem] bg-navy p-6 text-white",children:e.jsx(Es,{})})]})})}function Es(){return e.jsxs("div",{children:[e.jsx("p",{className:"text-xs font-black uppercase tracking-[0.2em] text-gold-light",children:"Animation presets"}),e.jsx("h3",{className:"mt-3 font-serif text-4xl font-bold",children:"Cinematic school identity"}),e.jsx("div",{className:"mt-6 grid gap-3",children:["Fade-in sections","Card hover lift","Button glow","Hero overlay","Mobile optimized spacing"].map(t=>e.jsxs("div",{className:"flex items-center gap-3 rounded-2xl bg-white/10 p-3 text-sm font-semibold text-white/80",children:[e.jsx(je,{className:"h-4 w-4 text-gold-light"})," ",t]},t))})]})}function Ls({db:t}){const[a,s]=l.useState(null),d=c=>{s(c),$(v=>({...v,messages:v.messages.map(N=>N.id===c?{...N,status:"Read"}:N)}))},g=t.messages.find(c=>c.id===a);return g?e.jsxs(X,{title:g.subject,kicker:"Message detail",children:[e.jsx("button",{type:"button",onClick:()=>s(null),className:"mb-6 inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-black text-navy transition-smooth hover:border-gold hover:bg-gold/10",children:"← Back to inbox"}),e.jsxs("div",{className:"rounded-2xl border border-border bg-secondary/30 p-6 space-y-5",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-xs font-black uppercase tracking-[0.18em] text-muted-foreground",children:"From"}),e.jsx("p",{className:"mt-1 font-bold text-navy",children:g.name}),e.jsx("p",{className:"text-sm text-muted-foreground",children:g.email}),g.phone&&e.jsxs("div",{className:"mt-2 flex items-center gap-2 text-sm font-bold text-crimson",children:[e.jsx(ua,{className:"h-3.5 w-3.5"}),g.phone]})]}),e.jsx("span",{className:"rounded-full bg-emerald-100 px-4 py-1.5 text-xs font-black text-emerald-700",children:"Read"})]}),e.jsx("hr",{className:"border-border"}),e.jsxs("div",{children:[e.jsx("p",{className:"text-xs font-black uppercase tracking-[0.18em] text-muted-foreground mb-2",children:"Subject"}),e.jsx("p",{className:"font-bold text-navy text-lg",children:g.subject})]}),e.jsxs("div",{children:[e.jsx("p",{className:"text-xs font-black uppercase tracking-[0.18em] text-muted-foreground mb-2",children:"Message"}),e.jsx("p",{className:"text-sm leading-7 text-slate-700 whitespace-pre-wrap",children:g.body})]}),g.createdAt&&e.jsxs("p",{className:"text-xs font-semibold text-muted-foreground",children:["Received: ",new Date(g.createdAt).toLocaleString()]})]})]}):e.jsx(X,{title:"Contact messages",kicker:"Inbox",children:e.jsxs("div",{className:"space-y-3",children:[t.messages.map(c=>e.jsx("button",{type:"button",onClick:()=>d(c.id),className:"w-full rounded-2xl border border-border bg-secondary/40 p-4 text-left transition-smooth hover:-translate-y-0.5 hover:border-gold hover:bg-white hover:shadow-soft cursor-pointer",children:e.jsxs("div",{className:"flex flex-col justify-between gap-3 md:flex-row md:items-start",children:[e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:`font-bold text-navy ${c.status!=="Read"?"font-black":""}`,children:c.subject}),e.jsxs("p",{className:"mt-1 text-sm text-muted-foreground",children:[c.name," · ",c.email," ",c.phone?`· ${c.phone}`:""]}),e.jsx("p",{className:"mt-2 text-sm leading-6 text-slate-500 line-clamp-1",children:c.body})]}),e.jsx("span",{className:`shrink-0 rounded-full px-3 py-1 text-xs font-black ${c.status==="Read"?"bg-secondary text-muted-foreground":"bg-gold/25 text-navy"}`,children:c.status})]})},c.id)),t.messages.length===0&&e.jsx("p",{className:"text-sm text-muted-foreground",children:"No messages yet."})]})})}function $s({db:t}){const[a,s]=l.useState(""),[d,g]=l.useState(""),[c,v]=l.useState(""),[N,u]=l.useState("website_admin"),w=()=>{!a.trim()||!d.trim()||($(m=>({...m,users:[{id:ve("USER"),name:a,email:d,password:c,role:N,status:"Active"},...m.users]})),V(`Admin user added: ${d}`,"Admin"),s(""),g(""),v(""),u("website_admin"))};return e.jsxs("div",{className:"grid gap-6 xl:grid-cols-[380px_1fr]",children:[e.jsx(X,{title:"Add user",kicker:"Roles",children:e.jsxs("div",{className:"space-y-3",children:[e.jsx(B,{placeholder:"Full name",value:a,onChange:m=>s(m.target.value)}),e.jsx(B,{placeholder:"Email",type:"email",value:d,onChange:m=>g(m.target.value)}),e.jsx(B,{placeholder:"Temporary password",value:c,onChange:m=>v(m.target.value)}),e.jsxs("select",{value:N,onChange:m=>u(m.target.value),className:"input-line",children:[e.jsx("option",{value:"website_admin",children:"Website Admin"}),e.jsx("option",{value:"eduzync_admin",children:"EduTrack Admin"}),e.jsx("option",{value:"superadmin",children:"Super Admin"}),e.jsx("option",{value:"masteradmin",children:"Master Admin"})]}),e.jsx("button",{type:"button",onClick:w,className:"w-full rounded-xl bg-gold px-4 py-3 text-sm font-black text-navy",children:"Add User"})]})}),e.jsx(X,{title:"Admin accounts",kicker:"Access control",children:e.jsx("div",{className:"space-y-3",children:t.users.filter(m=>["website_admin","eduzync_admin","superadmin","masteradmin"].includes(m.role)).map(m=>e.jsxs("div",{className:"flex flex-col justify-between gap-3 rounded-2xl border border-border bg-secondary/40 p-4 md:flex-row md:items-center",children:[e.jsxs("div",{children:[e.jsx("p",{className:"font-bold text-navy",children:m.name}),e.jsxs("p",{className:"text-sm text-muted-foreground",children:[m.email," · ",m.role]})]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx("button",{type:"button",onClick:()=>$(p=>({...p,users:p.users.map(b=>b.id===m.id?{...b,status:b.status==="Active"?"Blocked":"Active"}:b)})),className:"rounded-xl border border-border bg-white px-3 py-2 text-xs font-black text-navy",children:m.status}),e.jsx("button",{type:"button",onClick:()=>$(p=>({...p,users:p.users.filter(b=>b.id!==m.id)})),className:"rounded-xl border border-border bg-white p-2 text-crimson",children:e.jsx(pe,{className:"h-4 w-4"})})]})]},m.id))})})]})}function Is({db:t}){const a=l.useRef(null),s=()=>{const g=new File([JSON.stringify(t,null,2)],"loyola-backup.json",{type:"application/json"}),c=URL.createObjectURL(g),v=document.createElement("a");v.href=c,v.download=`loyola-backup-${new Date().toISOString().slice(0,10)}.json`,v.click(),URL.revokeObjectURL(c),V("Backup exported","Admin")},d=async g=>{if(g)try{const c=JSON.parse(await g.text());$(()=>c),V("Backup imported","Admin")}catch{alert("Invalid backup file.")}};return e.jsxs(X,{title:"Backup & restore",kicker:"Safety",children:[e.jsx("input",{ref:a,type:"file",accept:"application/json",className:"hidden",onChange:g=>{d(g.target.files?.[0])}}),e.jsxs("div",{className:"grid gap-4 md:grid-cols-3",children:[e.jsxs("button",{type:"button",onClick:s,className:"rounded-2xl border border-border bg-secondary/40 p-6 text-left transition-smooth hover:border-gold hover:bg-white",children:[e.jsx(ba,{className:"h-8 w-8 text-gold"}),e.jsx("p",{className:"mt-4 font-bold text-navy",children:"Download backup"}),e.jsx("p",{className:"mt-1 text-sm text-muted-foreground",children:"Export full local database."})]}),e.jsxs("button",{type:"button",onClick:()=>a.current?.click(),className:"rounded-2xl border border-border bg-secondary/40 p-6 text-left transition-smooth hover:border-gold hover:bg-white",children:[e.jsx(le,{className:"h-8 w-8 text-gold"}),e.jsx("p",{className:"mt-4 font-bold text-navy",children:"Restore backup"}),e.jsx("p",{className:"mt-1 text-sm text-muted-foreground",children:"Import JSON backup file."})]}),e.jsxs("button",{type:"button",onClick:()=>{confirm("Reset the local demo database?")&&Ht()},className:"rounded-2xl border border-red-200 bg-red-50 p-6 text-left text-red-700 transition-smooth hover:bg-red-100",children:[e.jsx(pe,{className:"h-8 w-8"}),e.jsx("p",{className:"mt-4 font-bold",children:"Reset local data"}),e.jsx("p",{className:"mt-1 text-sm",children:"Use only if the demo data is broken."})]})]})]})}function Us({db:t}){const a=t.websiteContent.socials||{},s=w=>$(m=>({...m,websiteContent:{...m.websiteContent,...w}})),d=(w,m)=>$(p=>({...p,websiteContent:{...p.websiteContent,socials:{...p.websiteContent.socials||{},[w]:m}}})),g=l.useRef(null),[c,v]=l.useState(!1),N=[{key:"facebook",label:"Facebook",placeholder:"https://www.facebook.com/your-page",Icon:fa},{key:"instagram",label:"Instagram",placeholder:"https://www.instagram.com/your-profile",Icon:va},{key:"youtube",label:"YouTube",placeholder:"https://www.youtube.com/@your-channel",Icon:ya},{key:"linkedin",label:"LinkedIn",placeholder:"https://www.linkedin.com/school/your-page",Icon:wa},{key:"whatsapp",label:"WhatsApp channel",placeholder:"https://whatsapp.com/channel/...",Icon:ja}],u=async w=>{if(w){v(!0);try{let p=(await Se(w,1200,.78)).dataUrl;try{p=await xe("site-settings",w)}catch(b){if(ue(b))throw b}s({anthemVideoCoverImage:p}),V("Anthem cover photo updated","Admin")}catch(m){alert(m instanceof Error?m.message:"Upload failed.")}finally{v(!1)}}};return e.jsxs("div",{className:"space-y-6",children:[e.jsx(X,{title:"System settings",kicker:"School information",children:e.jsxs("div",{className:"grid gap-4 lg:grid-cols-2",children:[e.jsx(B,{value:t.websiteContent.schoolName,onChange:w=>s({schoolName:w.target.value}),placeholder:"School name"}),e.jsx(B,{value:t.websiteContent.tagline,onChange:w=>s({tagline:w.target.value}),placeholder:"Tagline"}),e.jsx(B,{value:t.websiteContent.phone,onChange:w=>s({phone:w.target.value}),placeholder:"Phone"}),e.jsx(B,{value:t.websiteContent.email,onChange:w=>s({email:w.target.value}),placeholder:"Email"}),e.jsx(B,{value:t.websiteContent.address,onChange:w=>s({address:w.target.value}),placeholder:"Address"}),e.jsx(B,{value:t.websiteContent.officeHours,onChange:w=>s({officeHours:w.target.value}),placeholder:"Office Hours (e.g. Mon-Fri, 8AM - 3PM)"}),e.jsx(B,{value:t.websiteContent.mapUrl,onChange:w=>s({mapUrl:w.target.value}),placeholder:"Google Maps share URL"}),e.jsx(B,{value:t.websiteContent.mapEmbedUrl,onChange:w=>s({mapEmbedUrl:w.target.value}),placeholder:"Google Maps embed URL"}),e.jsx(B,{value:t.websiteContent.seo.metaTitle,onChange:w=>$(m=>({...m,websiteContent:{...m.websiteContent,seo:{...m.websiteContent.seo,metaTitle:w.target.value}}})),placeholder:"SEO title"})]})}),e.jsxs(X,{title:"Social media links",kicker:"Footer icons",children:[e.jsx("div",{className:"grid gap-4 lg:grid-cols-2",children:N.map(({key:w,label:m,placeholder:p,Icon:b})=>e.jsxs("label",{className:"block",children:[e.jsxs("span",{className:"mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground",children:[e.jsx(b,{className:"h-4 w-4 text-gold"}),m]}),e.jsx(B,{value:a[w]||"",onChange:S=>d(w,S.target.value),placeholder:p})]},w))}),e.jsx("p",{className:"mt-4 text-sm leading-6 text-muted-foreground",children:"Add full links here, then publish. Icons with empty links stay hidden on the public website."})]}),e.jsx(X,{title:"College Anthem",kicker:"Identity",children:e.jsxs("div",{className:"grid gap-6 lg:grid-cols-2",children:[e.jsxs("div",{className:"space-y-4",children:[e.jsx(B,{value:t.websiteContent.anthemVideoUrl,onChange:w=>s({anthemVideoUrl:w.target.value}),placeholder:"YouTube link (e.g. https://www.youtube.com/watch?v=...)"}),e.jsxs("div",{className:"rounded-2xl border border-border bg-white p-3",children:[t.websiteContent.anthemVideoCoverImage?e.jsxs("div",{className:"relative mb-3",children:[e.jsx("img",{src:t.websiteContent.anthemVideoCoverImage,alt:"Anthem cover",className:"aspect-video w-full rounded-xl object-cover"}),e.jsx("button",{type:"button",onClick:()=>s({anthemVideoCoverImage:""}),className:"absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-crimson shadow",children:e.jsx(pe,{className:"h-4 w-4"})})]}):e.jsx("div",{className:"mb-3 grid aspect-video place-items-center rounded-xl bg-secondary text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground",children:c?"Uploading…":"No anthem cover photo"}),e.jsxs("label",{className:"inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-black text-navy",children:[e.jsx(le,{className:"h-4 w-4"}),c?"Uploading…":"Upload cover photo",e.jsx("input",{ref:g,type:"file",accept:"image/jpeg,image/png",className:"hidden",disabled:c,onChange:w=>{u(w.target.files?.[0])}})]})]})]}),e.jsx("div",{className:"flex items-center justify-center rounded-3xl bg-navy p-6 text-center text-white",children:e.jsxs("div",{children:[e.jsx(Ge,{className:"mx-auto h-12 w-12 text-gold"}),e.jsx("h4",{className:"mt-4 font-serif text-2xl font-bold",children:"Official Anthem Media"}),e.jsx("p",{className:"mt-2 text-sm text-white/70",children:"Manage the ceremonial video link and its cover photo used on the College Anthem & Hymn page."})]})})]})})]})}function Rs({db:t}){return e.jsxs(X,{title:"Security center",kicker:"Protection",children:[e.jsx("div",{className:"grid gap-4 md:grid-cols-3",children:[["Role-based admin access","Website Admin, Super Admin and Master Admin can open this panel."],["Upload validation","Images are JPG/PNG up to 5 MB. Videos are MP4/MOV/WebM up to 500 MB."],["Activity logs","Open the Activity Logs tab to review admin actions."]].map(([a,s])=>e.jsxs("div",{className:"rounded-2xl border border-border bg-secondary/40 p-5",children:[e.jsx(Xe,{className:"h-7 w-7 text-gold"}),e.jsx("p",{className:"mt-4 font-bold text-navy",children:a}),e.jsx("p",{className:"mt-2 text-sm leading-6 text-muted-foreground",children:s})]},a))}),e.jsx("div",{className:"mt-6 space-y-3",children:t.auditLogs.slice(0,10).map(a=>e.jsxs("div",{className:"rounded-2xl bg-white px-4 py-3 text-sm shadow-soft",children:[e.jsx("b",{children:a.action}),e.jsxs("span",{className:"text-muted-foreground",children:[" ","· ",a.user," · ",new Date(a.createdAt).toLocaleString()]})]},a.id))})]})}function _s(){return e.jsx(Ms,{})}function yt(t){const a=t.actorName||"",s=t.actorEmail||(t.user.includes("@")?t.user:"");return a&&s&&a!==s?`${a} (${s})`:s||a||t.user||"System"}function Rt(t){return t?{masteradmin:"Master Admin",superadmin:"Super Admin",website_admin:"Website Admin",eduzync_admin:"EduTrack Admin",teacher:"Teacher",student:"Student",parent:"Parent"}[t]||t:"System"}function Ds({db:t}){return e.jsxs(X,{title:"Activity logs",kicker:"Full user history",children:[e.jsxs("div",{className:"mb-5 grid gap-3 md:grid-cols-3",children:[e.jsxs("div",{className:"rounded-2xl border border-border bg-secondary/35 p-4",children:[e.jsx("p",{className:"text-xs font-black uppercase tracking-[0.16em] text-muted-foreground",children:"Total records"}),e.jsx("p",{className:"mt-2 text-2xl font-black text-navy",children:t.auditLogs.length})]}),e.jsxs("div",{className:"rounded-2xl border border-border bg-secondary/35 p-4",children:[e.jsx("p",{className:"text-xs font-black uppercase tracking-[0.16em] text-muted-foreground",children:"Login records"}),e.jsx("p",{className:"mt-2 text-2xl font-black text-navy",children:t.auditLogs.filter(a=>(a.area||a.action).toLowerCase().includes("login")||a.action.toLowerCase().includes("signed")).length})]}),e.jsxs("div",{className:"rounded-2xl border border-border bg-secondary/35 p-4",children:[e.jsx("p",{className:"text-xs font-black uppercase tracking-[0.16em] text-muted-foreground",children:"Latest activity"}),e.jsx("p",{className:"mt-2 text-sm font-black text-navy",children:t.auditLogs[0]?new Date(t.auditLogs[0].createdAt).toLocaleString():"No activity"})]})]}),e.jsxs("div",{className:"space-y-3",children:[t.auditLogs.map(a=>e.jsx("div",{className:"rounded-2xl border border-border bg-secondary/30 p-4",children:e.jsxs("div",{className:"flex flex-col justify-between gap-3 md:flex-row md:items-start",children:[e.jsxs("div",{className:"min-w-0",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx("span",{className:"rounded-full bg-gold/20 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-navy",children:a.area||"General"}),e.jsx("span",{className:"rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground",children:Rt(a.actorRole)})]}),e.jsx("p",{className:"mt-3 text-sm font-black text-navy",children:yt(a)}),e.jsxs("p",{className:"mt-1 text-sm font-semibold text-slate-700",children:[yt(a)," ",a.action.charAt(0).toLowerCase(),a.action.slice(1),"."]}),e.jsxs("p",{className:"mt-1 text-xs text-muted-foreground",children:["Raw action: ",a.action]})]}),e.jsx("span",{className:"shrink-0 text-xs font-semibold text-muted-foreground",children:new Date(a.createdAt).toLocaleString()})]})},a.id)),t.auditLogs.length===0&&e.jsx("p",{className:"rounded-2xl border border-border bg-secondary/30 p-5 text-sm text-muted-foreground",children:"No activity yet."})]})]})}function Ys(){const t=De(),a=wt(),[s,d]=l.useState(()=>ws()),g=l.useRef("dashboard"),[c,v]=l.useState(!1),[N,u]=l.useState("idle"),[w,m]=l.useState("Ready"),[p,b]=l.useState("info"),S=vs(a.user?.role),z=S.flatMap(i=>i.items.map(f=>f.id)),y=a.user?.role==="website_admin";if(l.useEffect(()=>{!a.loading&&!a.user&&(window.location.href="/login")},[a.loading,a.user]),l.useEffect(()=>{!a.user||!ut.includes(a.user.role)||window.location.pathname!=="/admin"&&window.history.replaceState(null,"",`/admin${window.location.search}${window.location.hash}`)},[a.user]),l.useEffect(()=>{if(a.user&&!z.includes(s)){const i=z[0]||"dashboard";d(i),xt(i)}},[s,a.user,z]),l.useEffect(()=>{if(!a.user||g.current===s)return;const i=S.flatMap(f=>f.items).find(f=>f.id===s)?.label;i&&V(`Opened ${i} panel`,a.user.email),g.current=s},[s,a.user,S]),a.loading||!a.user)return e.jsx(Vt,{title:"Opening Loyola Digital Studio",subtitle:"Loading website tools and admin panels"});if(!ut.includes(a.user.role))return e.jsx("main",{className:"grid min-h-screen place-items-center bg-[#eef3ff] px-6",children:e.jsxs("section",{className:"max-w-lg rounded-2xl border border-border bg-white p-8 text-center shadow-soft",children:[e.jsx(Xe,{className:"mx-auto h-10 w-10 text-crimson"}),e.jsx("h1",{className:"mt-4 font-serif text-4xl font-bold text-navy",children:"Access Denied"}),e.jsx("p",{className:"mt-3 text-sm leading-6 text-muted-foreground",children:"Website Studio is available only for Website Admin, Super Admin, and Master Admin accounts."}),e.jsx("a",{href:"/portal",className:"mt-6 inline-flex rounded-xl bg-navy px-5 py-3 text-sm font-black text-white",children:"Back to portal"})]})});const L=async()=>{V("Admin signed out",a.user?.email||"admin"),await Bt(null),window.location.href="/login"},T=async()=>{u("saving"),V("Admin draft saved",a.user?.email||"admin");const i=await ke();i.remote?(b("info"),m(i.contentVersion?`Saved to cloud as version ${i.contentVersion}`:"Saved to cloud")):i.localOnly?(b("info"),m("Draft saved locally. Submit for approval when ready.")):(b("error"),m(`Cloud save failed${i.error?`: ${i.error}`:"."} Local draft kept on this device.`)),u("idle")},x=async()=>{if(y){u("submitting"),V("Admin submitted website changes for approval",a.user?.email||"admin"),await ke();try{const f=await zt(t);b("info"),m(`Submitted for approval as request #${f.id}`)}catch(f){b("error"),m(`Approval submit failed: ${f instanceof Error?f.message:"Request could not be created."}`)}u("idle");return}u("publishing"),V("Admin published changes",a.user?.email||"admin");const i=await ke();i.remote?(b("info"),m(i.contentVersion?`Published to cloud as version ${i.contentVersion}`:"Published to cloud")):(b("error"),m(`Server publish failed${i.error?`: ${i.error}`:"."} Public website was not updated.`)),u("idle")};return e.jsxs("div",{"data-admin-panel":!0,className:"flex min-h-screen bg-[#eef3f8] text-slate-900",children:[e.jsxs("aside",{className:`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-navy text-white shadow-2xl transition-transform lg:static lg:translate-x-0 ${c?"translate-x-0":"-translate-x-full"}`,children:[e.jsx("div",{className:"border-b border-white/10 p-6",children:e.jsxs("a",{href:"/","aria-label":"Open public website",title:"Open public website",className:"flex items-center gap-3 rounded-2xl outline-none transition-smooth hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-gold",children:[e.jsx("img",{src:"/loyola-crest.jpg",alt:"Loyola crest",className:"h-12 w-12 rounded-full border-2 border-gold bg-white object-contain p-1"}),e.jsxs("div",{children:[e.jsx("p",{className:"font-serif text-2xl font-bold text-gold-light",children:"Loyola Studio"}),e.jsx("p",{className:"text-[10px] font-black uppercase tracking-[0.22em] text-white/50",children:"Professional CMS"})]})]})}),e.jsx("nav",{className:"flex-1 overflow-y-auto p-3",children:S.map(i=>e.jsxs("div",{className:"py-2",children:[e.jsx("p",{className:"px-3 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-white/40",children:i.label}),e.jsx("div",{className:"space-y-1",children:i.items.map(f=>e.jsxs("button",{type:"button",onClick:()=>{d(f.id),xt(f.id),v(!1)},className:`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition-smooth ${s===f.id?"bg-gold text-navy shadow-gold":"text-white/60 hover:bg-white/10 hover:text-white"}`,children:[e.jsx(f.icon,{className:"h-5 w-5"})," ",f.label]},f.id))})]},i.label))}),e.jsx("div",{className:"border-t border-white/10 p-4",children:e.jsxs("button",{type:"button",onClick:L,className:"flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15",children:[e.jsx(da,{className:"h-4 w-4"})," Sign out"]})})]}),e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("header",{className:"sticky top-0 z-30 border-b border-border bg-white/90 px-4 py-4 shadow-soft backdrop-blur md:px-8",children:e.jsxs("div",{className:"flex flex-col justify-between gap-4 xl:flex-row xl:items-center",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("button",{type:"button",onClick:()=>v(!0),className:"rounded-xl border border-border bg-white p-2 lg:hidden",children:e.jsx(Oe,{className:"h-5 w-5"})}),e.jsxs("div",{children:[e.jsxs("p",{className:"text-xs font-black uppercase tracking-[0.22em] text-crimson",children:[Rt(a.user.role)," access"]}),e.jsx("h1",{className:"font-serif text-3xl font-bold text-navy",children:S.flatMap(i=>i.items).find(i=>i.id===s)?.label||"Dashboard"})]})]}),e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsxs("button",{type:"button",onClick:()=>window.open("/","_blank","noopener,noreferrer"),className:"inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-black text-navy",children:[e.jsx(kt,{className:"h-4 w-4"})," Preview"]}),e.jsxs("button",{type:"button",disabled:N!=="idle",onClick:()=>{T()},className:"inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-black text-white disabled:opacity-60",children:[e.jsx(Ke,{className:"h-4 w-4"})," ",N==="saving"?"Saving":"Save"]}),e.jsxs("button",{type:"button",disabled:N!=="idle",onClick:()=>{x()},className:"inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-black text-navy disabled:opacity-60",children:[y?e.jsx(Re,{className:"h-4 w-4"}):e.jsx(je,{className:"h-4 w-4"})," ",N==="publishing"?"Publishing":N==="submitting"?"Submitting":y?"Submit for Approval":"Publish"]}),e.jsx("span",{className:`inline-flex max-w-full items-center rounded-xl border px-3 py-2.5 text-xs font-black ${p==="error"?"border-red-200 bg-red-50 text-red-800":"border-border bg-white text-muted-foreground"}`,children:w})]})]})}),e.jsxs("main",{className:"p-4 md:p-8",children:[s==="dashboard"&&e.jsx(Cs,{db:t,setActive:d}),s==="studio"&&e.jsx(tt,{}),s==="approvals"&&(a.user.role==="website_admin"?e.jsx(gs,{}):e.jsx(cs,{})),s==="pages"&&e.jsx(Ss,{db:t}),s==="content"&&e.jsx(As,{db:t}),s==="media"&&e.jsx(Ps,{db:t}),s==="storage"&&e.jsx(_s,{}),s==="design"&&e.jsx(zs,{db:t}),s==="messages"&&e.jsx(Ls,{db:t}),s==="staff"&&e.jsx(Hs,{db:t}),s==="users"&&e.jsx($s,{db:t}),s==="security"&&e.jsx(Rs,{db:t}),s==="activity"&&e.jsx(Ds,{db:t}),s==="backup"&&e.jsx(Is,{db:t}),s==="settings"&&e.jsx(Us,{db:t})]})]})]})}function Js(){return e.jsx(tt,{})}function Ks(t){return e.jsx(tt,{})}function Vs({file:t,onCancel:a,onCrop:s}){const[d,g]=l.useState(""),[c,v]=l.useState({x:0,y:0}),[N,u]=l.useState(1),[w,m]=l.useState(null),[p,b]=l.useState(!1);l.useEffect(()=>{const y=URL.createObjectURL(t);return g(y),()=>URL.revokeObjectURL(y)},[t]);const S=l.useCallback((y,L)=>{m(L)},[]),z=async()=>{if(!d||!w)return;b(!0);const y=await Bs(d),L=document.createElement("canvas");L.width=600,L.height=600;const T=L.getContext("2d");T&&(T.drawImage(y,w.x,w.y,w.width,w.height,0,0,600,600),s(L.toDataURL("image/png")))};return e.jsx("div",{className:"fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-6",children:e.jsxs("div",{className:"flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl",children:[e.jsxs("div",{className:"flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"font-serif text-2xl font-bold text-navy",children:"Adjust Profile Photo"}),e.jsx("p",{className:"mt-1 text-sm text-muted-foreground",children:"Drag the photo into the square and zoom for a clean crop."})]}),e.jsx("button",{type:"button",onClick:a,className:"rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-navy","aria-label":"Close cropper",children:e.jsx(He,{className:"h-5 w-5"})})]}),e.jsx("div",{className:"relative h-[62vh] min-h-[420px] bg-black sm:h-[68vh]",children:d&&e.jsx(Na,{image:d,crop:c,zoom:N,minZoom:1,maxZoom:4,aspect:1,cropShape:"rect",showGrid:!0,objectFit:"contain",onCropChange:v,onCropComplete:S,onZoomChange:u,classes:{containerClassName:"staff-photo-cropper",cropAreaClassName:"staff-photo-crop-area"}})}),e.jsxs("div",{className:"grid gap-4 border-t border-border px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6",children:[e.jsxs("label",{className:"flex items-center gap-4",children:[e.jsx("span",{className:"w-12 text-xs font-black uppercase text-muted-foreground",children:"Zoom"}),e.jsx("input",{type:"range",min:1,max:4,step:.01,value:N,onChange:y=>u(Number(y.target.value)),className:"h-2 flex-1 accent-gold"})]}),e.jsxs("div",{className:"flex gap-3",children:[e.jsx("button",{type:"button",onClick:a,className:"min-w-32 rounded-xl border border-border bg-white px-5 py-3 text-sm font-bold text-navy hover:bg-secondary",children:"Cancel"}),e.jsx("button",{type:"button",disabled:p,onClick:()=>{z()},className:"min-w-40 rounded-xl bg-navy px-5 py-3 text-sm font-bold text-white shadow-soft hover:bg-navy/90 disabled:opacity-60",children:p?"Uploading...":"Crop & Upload"})]})]})]})})}function Bs(t){return new Promise((a,s)=>{const d=new Image;d.onload=()=>a(d),d.onerror=s,d.src=t})}function Hs({db:t}){const[a,s]=l.useState("dashboard"),[d,g]=l.useState(""),[c,v]=l.useState("All"),[N,u]=l.useState("Mr."),[w,m]=l.useState(""),[p,b]=l.useState("Academic Staff"),[S,z]=l.useState("Middle"),[y,L]=l.useState("Active"),[T,x]=l.useState("Normal Teacher"),[i,f]=l.useState(""),[A,_]=l.useState(""),[O,G]=l.useState(""),[ae,ie]=l.useState(""),[se,K]=l.useState(""),[Z,U]=l.useState(!0),[me,ge]=l.useState(""),[M,J]=l.useState(""),[oe,ce]=l.useState(!1),[D,q]=l.useState(null),[ee,n]=l.useState(null);l.useEffect(()=>{(T==="The Archbishop of Colombo"||T==="General Manager of Catholic Private Schools")&&(b("Non-Academic Staff"),z("Administration"))},[T]);const C={"The Archbishop of Colombo":"Top Administration","General Manager of Catholic Private Schools":"Top Administration","Rector / Principal":"Top Administration","Vice Rector":"Top Administration","Vice Rector / Prefect of Games":"Top Administration","Principal of Primary School":"Top Administration","Priest in Charge":"Top Administration","Priest in Charge & Sectional Head of Upper School":"Top Administration","Vice Principal - Primary School":"Vice Principals","Vice Principal - Middle School":"Vice Principals","Vice Principal - Upper School":"Vice Principals","Vice Principal - Advanced Level":"Vice Principals","Sectional Head - Primary School":"Sectional Heads","Sectional Head - Middle School":"Sectional Heads","Sectional Head - Upper School":"Sectional Heads","Sectional Head - Advanced Level":"Sectional Heads","Assistant Sectional Head - Primary School":"Sectional Heads","Assistant Sectional Head - Middle School":"Sectional Heads","Assistant Sectional Head - Upper School":"Sectional Heads","Assistant Sectional Head - Advanced Level":"Sectional Heads","Subjects Head - Primary School":"Subject Heads","Subjects Head - Middle School":"Subject Heads","Subjects Head - Upper School":"Subject Heads","Subjects Head - Advanced Level":"Subject Heads","Grade 1 Head":"Grade Heads","Grade 2 Head":"Grade Heads","Grade 3 Head":"Grade Heads","Grade 4 Head":"Grade Heads","Grade 5 Head":"Grade Heads","Grade 6 Head":"Grade Heads","Grade 7 Head":"Grade Heads","Grade 8 Head":"Grade Heads","Grade 9 Head":"Grade Heads","Grade 10 Head":"Grade Heads","Grade 11 Head":"Grade Heads","Science / Maths Stream Head":"A/L Stream Heads","Commerce Stream Head":"A/L Stream Heads","Arts Stream Head":"A/L Stream Heads","Technology Stream Head":"A/L Stream Heads","Sinhala Coordinator - Primary School":"Primary School Subject Coordinators","Mathematics Coordinator - Primary School":"Primary School Subject Coordinators","Environmental Studies Coordinator - Primary School":"Primary School Subject Coordinators","English Coordinator - Primary School":"Primary School Subject Coordinators","Roman Catholicism Coordinator - Primary School":"Primary School Subject Coordinators","Sinhala Coordinator - Middle School":"Middle School Subject Coordinators","Mathematics Coordinator - Middle School":"Middle School Subject Coordinators","Science Coordinator - Middle School":"Middle School Subject Coordinators","English Coordinator - Middle School":"Middle School Subject Coordinators","History / Geography / Civics Coordinator - Middle School":"Middle School Subject Coordinators","Roman Catholicism Coordinator - Middle School":"Middle School Subject Coordinators","Health Science & Physical Education Coordinator - Middle School":"Middle School Subject Coordinators","Practical & Technical Skills Coordinator - Middle School":"Middle School Subject Coordinators","Sinhala Coordinator - Upper School":"Upper School Subject Coordinators","Mathematics Coordinator - Upper School":"Upper School Subject Coordinators","Science Coordinator - Upper School":"Upper School Subject Coordinators","English Coordinator - Upper School":"Upper School Subject Coordinators","Roman Catholicism Coordinator - Upper School":"Upper School Subject Coordinators","Health Science & Physical Education Coordinator - Upper School":"Upper School Subject Coordinators","Practical & Technical Skills Coordinator - Upper School":"Upper School Subject Coordinators","Arts Coordinator":"Aesthetic Subject Coordinators","Dancing Coordinator":"Aesthetic Subject Coordinators","Eastern Music Coordinator":"Aesthetic Subject Coordinators","Western Music Coordinator":"Aesthetic Subject Coordinators","Science / Maths Coordinator - Advanced Level":"Advanced Level Subject Coordinators","Commerce Coordinator - Advanced Level":"Advanced Level Subject Coordinators","Arts Coordinator - Advanced Level":"Advanced Level Subject Coordinators","English Medium Coordinator - Primary School":"English Medium Coordinators","English Medium Coordinator - Middle School":"English Medium Coordinators","English Medium Coordinator - Upper School":"English Medium Coordinators","English Medium Coordinator - Advanced Level":"English Medium Coordinators","Class Teacher 1 - A":"Class Teachers - Primary School","Class Teacher 1 - B":"Class Teachers - Primary School","Class Teacher 1 - C":"Class Teachers - Primary School","Class Teacher 1 - E":"Class Teachers - Primary School","Class Teacher 2 - A":"Class Teachers - Primary School","Class Teacher 2 - B":"Class Teachers - Primary School","Class Teacher 2 - C":"Class Teachers - Primary School","Class Teacher 2 - D":"Class Teachers - Primary School","Class Teacher 2 - E":"Class Teachers - Primary School","Class Teacher 2 - F":"Class Teachers - Primary School","Class Teacher 3 - A":"Class Teachers - Primary School","Class Teacher 3 - B":"Class Teachers - Primary School","Class Teacher 3 - C":"Class Teachers - Primary School","Class Teacher 3 - D":"Class Teachers - Primary School","Class Teacher 4 - A":"Class Teachers - Primary School","Class Teacher 4 - B":"Class Teachers - Primary School","Class Teacher 4 - C":"Class Teachers - Primary School","Class Teacher 4 - D":"Class Teachers - Primary School","Class Teacher 5 - A":"Class Teachers - Primary School","Class Teacher 5 - B":"Class Teachers - Primary School","Class Teacher 5 - C":"Class Teachers - Primary School","Class Teacher 5 - D":"Class Teachers - Primary School","Class Teacher 6 - A":"Class Teachers - Middle School","Class Teacher 6 - B":"Class Teachers - Middle School","Class Teacher 6 - C":"Class Teachers - Middle School","Class Teacher 6 - D":"Class Teachers - Middle School","Class Teacher 7 - A":"Class Teachers - Middle School","Class Teacher 7 - B":"Class Teachers - Middle School","Class Teacher 7 - C":"Class Teachers - Middle School","Class Teacher 7 - D":"Class Teachers - Middle School","Class Teacher 7 - E":"Class Teachers - Middle School","Class Teacher 8 - B":"Class Teachers - Middle School","Class Teacher 8 - C":"Class Teachers - Middle School","Class Teacher 8 - D":"Class Teachers - Middle School","Class Teacher 8 - E":"Class Teachers - Middle School","Class Teacher 9 - A":"Class Teachers - Upper School","Class Teacher 9 - C":"Class Teachers - Upper School","Class Teacher 9 - D":"Class Teachers - Upper School","Class Teacher 9 - E":"Class Teachers - Upper School","Class Teacher 10 - A":"Class Teachers - Upper School","Class Teacher 10 - B":"Class Teachers - Upper School","Class Teacher 10 - C":"Class Teachers - Upper School","Class Teacher 10 - D":"Class Teachers - Upper School","Class Teacher 10 - E":"Class Teachers - Upper School","Class Teacher 11 - A":"Class Teachers - Upper School","Class Teacher 11 - B":"Class Teachers - Upper School","Class Teacher 11 - C":"Class Teachers - Upper School","Class Teacher 11 - D":"Class Teachers - Upper School","Class Teacher 11 - E":"Class Teachers - Upper School","12 Maths (SM)":"Class Teachers - Advance Level Section","12 Bio (SM)":"Class Teachers - Advance Level Section","12 Maths / Bio (EM)":"Class Teachers - Advance Level Section","12 Commerce - A (SM)":"Class Teachers - Advance Level Section","12 Commerce - B (SM)":"Class Teachers - Advance Level Section","12 Commerce (EM)":"Class Teachers - Advance Level Section","12 Arts":"Class Teachers - Advance Level Section","13 Maths (SM)":"Class Teachers - Advance Level Section","13 Bio (SM)":"Class Teachers - Advance Level Section","13 Maths / Bio (EM)":"Class Teachers - Advance Level Section","13 Commerce - A (SM)":"Class Teachers - Advance Level Section","13 Commerce - B (SM)":"Class Teachers - Advance Level Section","13 Arts - A (SM)":"Class Teachers - Advance Level Section","13 Arts - B (SM)":"Class Teachers - Advance Level Section","13 Arts (EM)":"Class Teachers - Advance Level Section","13 Technology":"Class Teachers - Advance Level Section","Subject Teacher - Primary School":"Subject Teachers - Primary School","Subject Teacher - Middle School":"Subject Teachers - Middle School","Subject Teacher - Upper School":"Subject Teachers - Upper School","Subject Teacher - Advanced Level":"Subject Teachers - Advanced Level","Special Need Resource Unit Teacher":"Special Academic Positions","Visiting Teacher":"Special Academic Positions",Counsellor:"Special Academic Positions","Administrative Secretary":"Administrative Department",Secretary:"Administrative Department","Head - Academic Office":"Academic Department","Academic Officer":"Academic Department",Accountant:"Financial Department","Accounts Assistant":"Financial Department","Manager - IT":"IT Department","Assistant IT":"IT Department",Receptionist:"Other Non-Academic Positions","Bookstore Clerk":"Other Non-Academic Positions","Bookstore Assistant":"Other Non-Academic Positions","Office Assistant":"Other Non-Academic Positions","Maintenance Supervisor":"Other Non-Academic Positions","Nursing Officer":"Other Non-Academic Positions",Librarian:"Other Non-Academic Positions","Supportive Staff Member":"Supportive Staff","Normal Teacher":"All Teachers Directory"},h=r=>C[r]||"All Teachers Directory",P=async(r,F)=>{try{let Y=r;try{Y=await za("staff-profiles",r,F.name)}catch(te){if(ue(te))throw te;console.error("Storage upload failed, falling back to data URL",te)}K(Y),q(null)}catch{window.alert("Upload failed.")}},I=r=>{const F=/^LCS-\d{4}$/,Y=r.map(W=>W.id).filter(W=>F.test(W)).map(W=>parseInt(W.split("-")[1]));return`LCS-${(Y.length>0?Math.max(...Y)+1:1).toString().padStart(4,"0")}`},R=async(r,F)=>{if(!Z)return null;const Y=me.trim().toLowerCase(),te=M;if(!Y)throw new Error("Teacher portal email is required.");if(!ee&&!te)throw new Error("Temporary password is required for a new account.");const W=await fetch(`${be}/api/staff-accounts`,{method:"POST",headers:Ee({"Content-Type":"application/json"}),body:JSON.stringify({teacherId:r,name:F,email:Y,password:te,status:"Active"})}),re=await W.json().catch(()=>({}));if(!W.ok)throw new Error(re.error||"Could not create teacher account.");return re.user},Q=async()=>{if(!w)return window.alert("Name is required");const r=h(T),F=`${N?N+" ":""}${w}`.trim(),Y=ee||I(t.teachers);ce(!0);try{!Z&&ee&&await fetch(`${be}/api/staff-accounts/${encodeURIComponent(ee)}`,{method:"DELETE",headers:Ee()}).catch(()=>null);const te=await R(Y,F);$(W=>{let re=[...W.teachers];const _t=T==="The Archbishop of Colombo"||T==="General Manager of Catholic Private Schools"||T==="Rector / Principal"||T.includes("Rector")||T.includes("Principal")||T.includes("Head")||T.includes("Coordinator")||T==="Accountant"||T==="Librarian"||T==="Counsellor";y==="Active"&&_t&&(re=re.map(fe=>fe.id!==Y&&fe.position===T&&fe.status==="Active"?{...fe,status:"Hidden"}:fe));const at=Z?{accountEmail:te?.email||me.trim().toLowerCase(),accountUserId:te?.id||Y,accountStatus:te?.status||"Active"}:{accountEmail:"",accountUserId:"",accountStatus:"Disabled"};return ee?(re=re.map(fe=>fe.id===ee?{...fe,name:F,type:p,section:S,status:y,position:T,classes:i,subject:A,qualifications:O,responsibilities:ae,image:se,category:r,...at}:fe),V(`Staff member updated: ${F}`,"Admin")):(re.push({id:Y,name:F,type:p,section:S,status:y,position:T,classes:i,subject:A,qualifications:O,responsibilities:ae,image:se,category:r,...at}),V(`Staff member added: ${F} (${Y})`,"Admin")),{...W,teachers:re}}),J(""),o(),s("all")}catch(te){window.alert(te instanceof Error?te.message:"Could not save staff member.")}finally{ce(!1)}},o=()=>{n(null),u("Mr."),m(""),b("Academic Staff"),z("Middle"),L("Active"),x("Normal Teacher"),f(""),_(""),G(""),ie(""),K(""),U(!0),ge(""),J("")},j=r=>{n(r.id);const F=r.name.match(/^(Mr\.|Mrs\.|Ms\.|Dr\.|Rev\.\sFr\.|Bro\.)\s(.*)/);F?(u(F[1]),m(F[2])):(u(""),m(r.name)),b(r.type||"Academic Staff"),z(r.section||"Middle"),L(r.status||"Active"),x(r.position||"Normal Teacher"),f(r.classes||""),_(r.subject||""),G(r.qualifications||""),ie(r.responsibilities||""),K(r.image||""),U(!!(r.accountEmail||r.accountUserId)),ge(r.accountEmail||""),J(""),s("add")},k=async r=>{if(window.confirm("Are you sure you want to delete this staff member?")){try{await fetch(`${be}/api/staff-accounts/${encodeURIComponent(r)}`,{method:"DELETE",headers:Ee()})}catch(F){console.error("Could not disable linked teacher account",F)}$(F=>({...F,teachers:F.teachers.filter(Y=>Y.id!==r)})),V(`Staff member deleted: ${r}`,"Admin")}},E=t.teachers.filter(r=>!(c!=="All"&&r.type!==c||d&&!r.name.toLowerCase().includes(d.toLowerCase())&&!(r.position||"").toLowerCase().includes(d.toLowerCase()))),H=["All","Academic Staff","Non-Academic Staff","Supportive Staff"];return e.jsxs("div",{className:"space-y-6",children:[D&&e.jsx(Vs,{file:D,onCancel:()=>q(null),onCrop:r=>{P(r,D)}}),e.jsxs(X,{title:"Staff Management",kicker:"Team",action:e.jsxs("div",{className:"flex gap-2",children:[e.jsxs("button",{type:"button",onClick:()=>{o(),s("add")},className:"rounded-xl bg-gold px-4 py-2 text-sm font-black text-navy inline-flex items-center gap-2",children:[e.jsx(Ce,{className:"h-4 w-4"})," Add Staff Member"]}),e.jsx("a",{href:"/college-staff",target:"_blank",className:"rounded-xl border border-border bg-white px-4 py-2 text-sm font-black text-navy inline-flex items-center gap-2",children:"Preview Staff Page"})]}),children:[e.jsx("div",{className:"mb-6 flex flex-wrap gap-2 border-b border-border pb-4",children:[{id:"dashboard",label:"Staff Dashboard"},{id:"all",label:"All Staff Members"},{id:"add",label:ee?"Edit Staff Member":"Add Staff Member"}].map(r=>e.jsx("button",{type:"button",onClick:()=>s(r.id),className:`rounded-xl px-4 py-2 text-sm font-bold ${a===r.id?"bg-navy text-white":"bg-secondary text-muted-foreground hover:bg-secondary/80"}`,children:r.label},r.id))}),a==="dashboard"&&e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"grid gap-4 md:grid-cols-4 stagger-children",children:[e.jsx(we,{icon:At,label:"Total Staff",value:t.teachers.length}),e.jsx(we,{icon:xa,label:"Academic Staff",value:t.teachers.filter(r=>r.type==="Academic Staff"||!r.type).length}),e.jsx(we,{icon:St,label:"Non-Academic",value:t.teachers.filter(r=>r.type==="Non-Academic Staff").length}),e.jsx(we,{icon:Ue,label:"Supportive",value:t.teachers.filter(r=>r.type==="Supportive Staff").length})]}),e.jsxs("div",{className:"rounded-2xl border border-border bg-white p-5 shadow-soft",children:[e.jsx("h3",{className:"font-bold text-navy mb-4",children:"Recently Added Staff"}),e.jsx("div",{className:"space-y-2",children:[...t.teachers].reverse().slice(0,5).map(r=>e.jsxs("div",{className:"hover-lift flex items-center justify-between rounded-xl bg-secondary/50 p-3 transition-smooth",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[r.image?e.jsx("img",{src:r.image,className:"h-10 w-10 rounded-full object-cover",alt:""}):e.jsx("div",{className:"grid h-10 w-10 place-items-center rounded-full bg-navy text-white",children:e.jsx(Ue,{className:"h-5 w-5"})}),e.jsxs("div",{children:[e.jsx("p",{className:"font-bold text-navy text-sm",children:r.name}),e.jsx("p",{className:"text-xs text-muted-foreground",children:r.position||r.type})]})]}),e.jsx("button",{type:"button",onClick:()=>j(r),className:"text-xs font-bold text-crimson hover:underline",children:"Edit"})]},r.id))})]})]}),a==="all"&&e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"flex flex-wrap gap-3",children:[e.jsx(B,{placeholder:"Search by name or position...",value:d,onChange:r=>g(r.target.value),className:"max-w-xs"}),e.jsx("select",{value:c,onChange:r=>v(r.target.value),className:"h-12 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-gold",children:H.map(r=>e.jsx("option",{value:r,children:r},r))})]}),e.jsx("div",{className:"overflow-x-auto rounded-2xl border border-border bg-white shadow-soft",children:e.jsxs("table",{className:"w-full text-left text-sm",children:[e.jsx("thead",{className:"bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground",children:e.jsxs("tr",{children:[e.jsx("th",{className:"p-4",children:"Staff ID"}),e.jsx("th",{className:"p-4",children:"Staff Member"}),e.jsx("th",{className:"p-4",children:"Position"}),e.jsx("th",{className:"p-4",children:"Display Place"}),e.jsx("th",{className:"p-4",children:"Section"}),e.jsx("th",{className:"p-4",children:"Portal Account"}),e.jsx("th",{className:"p-4",children:"Status"}),e.jsx("th",{className:"p-4 text-right",children:"Actions"})]})}),e.jsxs("tbody",{className:"divide-y divide-border",children:[E.map(r=>e.jsxs("tr",{className:"transition-smooth hover:bg-secondary/30",children:[e.jsx("td",{className:"p-4 font-mono text-xs font-bold text-slate-500",children:r.id}),e.jsxs("td",{className:"p-4 flex items-center gap-3",children:[r.image?e.jsx("img",{src:r.image,className:"h-10 w-10 rounded-full object-cover",alt:""}):e.jsx("div",{className:"grid h-10 w-10 place-items-center rounded-full bg-navy text-white",children:e.jsx(Ue,{className:"h-5 w-5"})}),e.jsx("span",{className:"font-bold text-navy",children:r.name})]}),e.jsx("td",{className:"p-4 text-muted-foreground",children:r.position||"-"}),e.jsx("td",{className:"p-4 text-xs font-bold text-crimson",children:r.category||"All Teachers Directory"}),e.jsx("td",{className:"p-4 text-muted-foreground",children:r.section||"-"}),e.jsx("td",{className:"p-4 text-xs",children:r.accountEmail?e.jsxs("div",{children:[e.jsx("p",{className:"font-bold text-navy",children:r.accountEmail}),e.jsxs("p",{className:"text-muted-foreground",children:[r.accountStatus||"Active"," · ",r.accountUserId||r.id]})]}):e.jsx("span",{className:"font-bold text-muted-foreground",children:"Not created"})}),e.jsx("td",{className:"p-4",children:e.jsx("span",{className:`rounded-full px-2 py-1 text-xs font-black ${r.status==="Active"?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-500"}`,children:r.status||"Active"})}),e.jsxs("td",{className:"p-4 text-right space-x-2",children:[e.jsx("button",{type:"button",onClick:()=>j(r),className:"text-navy hover:text-gold mr-2 font-bold text-xs",children:"Edit"}),e.jsx("button",{type:"button",onClick:()=>{k(r.id)},className:"text-crimson hover:text-red-700 font-bold text-xs",children:"Delete"})]})]},r.id)),E.length===0&&e.jsx("tr",{children:e.jsx("td",{colSpan:8,className:"p-8 text-center text-muted-foreground",children:"No staff found matching criteria."})})]})]})})]}),a==="add"&&e.jsxs("div",{className:"grid gap-6 xl:grid-cols-[280px_1fr]",children:[e.jsxs("div",{children:[e.jsx("p",{className:"mb-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground",children:"Profile Photo"}),e.jsx("div",{className:"rounded-2xl border border-border bg-white p-5 text-center text-sm shadow-soft",children:se?e.jsxs(e.Fragment,{children:[e.jsx("img",{src:se,className:"mx-auto mb-4 h-40 w-40 rounded-full object-cover shadow-inner",alt:""}),e.jsx("button",{type:"button",onClick:()=>K(""),className:"text-crimson font-bold hover:underline",children:"Remove Photo"})]}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"mx-auto mb-4 grid h-40 w-40 place-items-center rounded-full bg-secondary/50 border-2 border-dashed border-border text-muted-foreground",children:e.jsx(Ue,{className:"h-16 w-16"})}),e.jsxs("label",{className:"cursor-pointer rounded-xl bg-secondary px-4 py-2 font-bold text-navy hover:bg-gold inline-block w-full",children:[e.jsx("input",{type:"file",accept:"image/jpeg,image/png",className:"hidden",onChange:r=>{const F=r.target.files?.[0];F&&q(F),r.target.value=""}}),"Choose File"]})]})})]}),e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"rounded-2xl border border-border bg-white p-6 shadow-soft",children:[e.jsx("h3",{className:"mb-4 font-serif text-xl font-bold text-navy border-b border-border pb-3",children:"Basic Details"}),e.jsxs("div",{className:"grid gap-4 md:grid-cols-2",children:[e.jsxs("div",{children:[e.jsx("label",{className:"mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground",children:"Name Title"}),e.jsxs("select",{value:N,onChange:r=>u(r.target.value),className:"w-full h-12 rounded-xl border border-border px-3 text-sm font-semibold text-navy outline-none focus:border-gold",children:[e.jsx("option",{children:"Mr."}),e.jsx("option",{children:"Mrs."}),e.jsx("option",{children:"Ms."}),e.jsx("option",{children:"Dr."}),e.jsx("option",{children:"Rev. Fr."}),e.jsx("option",{children:"Bro."}),e.jsx("option",{value:"",children:"None"})]})]}),e.jsxs("div",{children:[e.jsx("label",{className:"mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground",children:"Full Name"}),e.jsx(B,{placeholder:"E.g. Full name",value:w,onChange:r=>m(r.target.value)})]}),e.jsxs("div",{children:[e.jsx("label",{className:"mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground",children:"Staff Type"}),e.jsxs("select",{value:p,onChange:r=>b(r.target.value),className:"w-full h-12 rounded-xl border border-border px-3 text-sm font-semibold text-navy outline-none focus:border-gold",children:[e.jsx("option",{children:"Academic Staff"}),e.jsx("option",{children:"Non-Academic Staff"}),e.jsx("option",{children:"Supportive Staff"})]})]}),e.jsxs("div",{children:[e.jsx("label",{className:"mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground",children:"Section"}),e.jsxs("select",{value:S,onChange:r=>z(r.target.value),className:"w-full h-12 rounded-xl border border-border px-3 text-sm font-semibold text-navy outline-none focus:border-gold",children:[e.jsx("option",{children:"Administration"}),e.jsx("option",{children:"Primary School"}),e.jsx("option",{children:"Middle School"}),e.jsx("option",{children:"Upper School"}),e.jsx("option",{children:"Advanced Level"}),e.jsx("option",{children:"Non-Academic Department"}),e.jsx("option",{children:"Supportive Staff"})]})]})]})]}),e.jsxs("div",{className:"rounded-2xl border border-border bg-white p-6 shadow-soft",children:[e.jsxs("div",{className:"mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"font-serif text-xl font-bold text-navy",children:"Teacher Portal Account"}),e.jsx("p",{className:"mt-1 text-xs font-semibold text-muted-foreground",children:"Creates a separate login in the backend users table. Password is hashed and never saved on the public staff profile."})]}),e.jsxs("label",{className:"flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-bold text-navy",children:[e.jsx("input",{type:"checkbox",checked:Z,onChange:r=>U(r.target.checked),className:"h-4 w-4 rounded border-border text-navy"}),"Create login"]})]}),e.jsxs("div",{className:"grid gap-4 md:grid-cols-2",children:[e.jsxs("div",{children:[e.jsx("label",{className:"mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground",children:"Login Email"}),e.jsx(B,{type:"email",placeholder:"teacher@loyola.local",value:me,disabled:!Z,onChange:r=>ge(r.target.value)})]}),e.jsxs("div",{children:[e.jsx("label",{className:"mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground",children:ee?"New Password":"Temporary Password"}),e.jsx(B,{type:"password",placeholder:ee?"Leave blank to keep old password":"Minimum 6 characters",value:M,disabled:!Z,onChange:r=>J(r.target.value)})]})]})]}),e.jsxs("div",{className:"rounded-2xl border border-border bg-white p-6 shadow-soft",children:[e.jsx("h3",{className:"mb-4 font-serif text-xl font-bold text-navy border-b border-border pb-3",children:"Position Details"}),e.jsxs("div",{className:"grid gap-4 md:grid-cols-2",children:[e.jsxs("div",{children:[e.jsx("label",{className:"mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground",children:"Position"}),e.jsxs("select",{value:T,onChange:r=>x(r.target.value),className:"w-full h-12 rounded-xl border border-border px-3 text-sm font-semibold text-navy outline-none focus:border-gold",children:[Object.keys(C).map(r=>e.jsx("option",{value:r,children:r},r)),e.jsx("option",{value:"Other",children:"Other"})]})]}),e.jsxs("div",{children:[e.jsx("label",{className:"mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground",children:"Auto Display Place"}),e.jsx("div",{className:"flex h-12 w-full items-center rounded-xl border border-border bg-emerald-50 px-3 text-sm font-black text-emerald-700",children:h(T)}),e.jsx("p",{className:"mt-1 text-[10px] uppercase font-bold text-muted-foreground",children:"Automatically chosen based on Position"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground",children:"Grade/Classes"}),e.jsx(B,{placeholder:"E.g. Grade 1-5",value:i,onChange:r=>f(r.target.value)})]}),e.jsxs("div",{children:[e.jsx("label",{className:"mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground",children:"Subject"}),e.jsxs("select",{value:A,onChange:r=>_(r.target.value),className:"w-full h-12 rounded-xl border border-border px-3 text-sm font-semibold text-navy outline-none focus:border-gold",children:[e.jsx("option",{value:"",children:"None / N/A"}),e.jsx("option",{children:"Sinhala"}),e.jsx("option",{children:"Mathematics"}),e.jsx("option",{children:"Science"}),e.jsx("option",{children:"English"}),e.jsx("option",{children:"Roman Catholicism"}),e.jsx("option",{children:"Commerce"}),e.jsx("option",{children:"Arts"}),e.jsx("option",{children:"Technology"}),e.jsx("option",{children:"Dancing"}),e.jsx("option",{children:"Eastern Music"}),e.jsx("option",{children:"Western Music"}),e.jsx("option",{children:"Health Science & Physical Education"}),e.jsx("option",{children:"Practical & Technical Skills"}),e.jsx("option",{children:"Other"})]})]})]})]}),e.jsxs("div",{className:"rounded-2xl border border-border bg-white p-6 shadow-soft",children:[e.jsx("h3",{className:"mb-4 font-serif text-xl font-bold text-navy border-b border-border pb-3",children:"Professional Details"}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("label",{className:"mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground",children:"Qualifications"}),e.jsx(Ne,{rows:3,placeholder:"Type qualifications here...",value:O,onChange:r=>G(r.target.value)})]}),e.jsxs("div",{children:[e.jsx("label",{className:"mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground",children:"Other Responsibilities"}),e.jsx(Ne,{rows:3,placeholder:"Type responsibilities here...",value:ae,onChange:r=>ie(r.target.value)})]})]})]}),e.jsxs("div",{className:"flex items-center justify-between border-t border-border pt-6",children:[e.jsx("div",{children:e.jsxs("label",{className:"flex items-center gap-2 cursor-pointer",children:[e.jsx("input",{type:"checkbox",checked:y==="Active",onChange:r=>L(r.target.checked?"Active":"Hidden"),className:"h-4 w-4 rounded border-border text-navy"}),e.jsx("span",{className:"text-sm font-bold text-navy",children:"Publish Profile to Website"})]})}),e.jsxs("div",{className:"flex gap-3",children:[e.jsx("button",{type:"button",onClick:o,className:"rounded-xl border border-border bg-white px-6 py-3 text-sm font-bold text-navy hover:bg-secondary",children:"Cancel"}),e.jsx("button",{type:"button",disabled:oe,onClick:()=>{Q()},className:"rounded-xl bg-navy px-6 py-3 text-sm font-bold text-white shadow-soft hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-60",children:oe?"Saving...":ee?"Update Profile":"Publish Staff"})]})]})]})]})]})]})}export{Ys as AdminPortal,Ks as CrudPanel,Js as DeferredWebsiteEditor};

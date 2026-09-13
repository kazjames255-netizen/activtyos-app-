// HAF wave-2 by script: pull every eequ listing, map postcodes → council (postcodes.io), read each target-council
// listing page's __NEXT_DATA__ (isHaf / council / categories / prices), sweep the discovered councilIds through the
// list API, and write scripts/leads/out/haf-la/wave2-<N>.json in merge_haf shape.  Run from server/:
//   node scripts/leads/haf_eequ.mjs "Solihull,Manchester,…" wave2-4      (resumable: state in out/eequ-state/)
import fs from "fs";
const [,, laArg, outName="wave2-eequ"] = process.argv;
const REGION={"Solihull":"West Midlands","Manchester":"North West","Buckinghamshire":"South East","Dorset":"South West","Hampshire":"South East","Leicester":"East Midlands","Staffordshire":"West Midlands","Stoke-on-Trent":"West Midlands","Cambridgeshire":"East of England","Telford and Wrekin":"West Midlands","Hertfordshire":"East of England","Suffolk":"East of England","West Sussex":"South East","Kensington and Chelsea":"London","Barnet":"London","South Tyneside":"North East","Bedford":"East of England","Central Bedfordshire":"East of England","Derbyshire":"East Midlands","Portsmouth":"South East","Wiltshire":"South West","Somerset":"South West"};
const T = laArg ? laArg.split(",").map(s=>s.trim()) : Object.keys(REGION);
const ST="scripts/leads/out/eequ-state"; fs.mkdirSync(ST,{recursive:true}); const J=(f,d)=>fs.existsSync(`${ST}/${f}`)?JSON.parse(fs.readFileSync(`${ST}/${f}`,"utf8")):d; const W=(f,v)=>fs.writeFileSync(`${ST}/${f}`,JSON.stringify(v));
// 1. every listing summary
let all=J("all.json",null); if(!all){ all=[]; let off=0,total=1; while(off<total){ const j=await (await fetch(`https://api.eequ.org/experiences?limit=100&offset=${off}`)).json(); total=j.totalItems; for(const i of j.items) all.push({slug:i.slug,title:i.title,mentor:i.mentor?.professionalName||"",city:i.address?.city,pc:i.address?.zipCode}); off+=100; } W("all.json",all); } console.log("eequ listings",all.length);
// 2. postcode → LA
const pcmap=J("pc.json",{}); const norm=p=>(p||"").toUpperCase().replace(/\s+/g," ").trim(); const pcs=[...new Set(all.map(x=>norm(x.pc)).filter(p=>/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/.test(p)&&!(p in pcmap)))];
for(let i=0;i<pcs.length;i+=100){ const j=await (await fetch("https://api.postcodes.io/postcodes",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({postcodes:pcs.slice(i,i+100)})})).json(); for(const q of j.result||[]) pcmap[q.query]=q.result?{d:q.result.admin_district,c:q.result.admin_county}:null; } W("pc.json",pcmap);
const laOfPc=p=>{ const q=pcmap[norm(p)]; if(!q) return null; return T.find(t=>q.d===t||q.c===t)||null; };
// 3. listing pages (isHaf, council, categories, prices)
const pages=J("pages.json",{}); const meta={}; for(const x of all) meta[x.slug]=x;
const getPage=async(x)=>{ try{ const h=await (await fetch(`https://eequ.org/experience/${x.slug}`)).text(); const m=h.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/); const e=m&&JSON.parse(m[1]).props.pageProps.experience; if(!e){pages[x.slug]={err:"noexp"};return;} pages[x.slug]={isHaf:e.isHaf,councilId:e.council?.id||null,council:e.council?.title||null,cats:(e.categories||[]).map(c=>c.name),prices:(e.tickets||[]).map(t=>t.price),mentor:e.mentor?.professionalName,city:e.address?.city,title:e.title}; }catch(err){pages[x.slug]={err:String(err).slice(0,80)};} };
const fetchPages=async(list)=>{ const todo=list.filter(x=>!pages[x.slug]); console.log("pages to fetch",todo.length); for(let i=0;i<todo.length;i+=6){ await Promise.all(todo.slice(i,i+6).map(getPage)); if(i%300===0) W("pages.json",pages); } W("pages.json",pages); };
await fetchPages(all.filter(x=>laOfPc(x.pc)));
// 4. sweep every council id seen on a target-council listing (catches listings whose postcode didn't resolve)
const councilIds=new Set(); for(const x of all){ const p=pages[x.slug]; if(p?.councilId&&laOfPc(x.pc)) councilIds.add(p.councilId); }
const extra=[]; for(const id of councilIds){ let off=0,total=1; while(off<total){ const j=await (await fetch(`https://api.eequ.org/experiences?limit=100&offset=${off}&councilId=${id}`)).json(); total=j.totalItems; for(const i of j.items){ if(!meta[i.slug]){ meta[i.slug]={slug:i.slug,title:i.title,mentor:i.mentor?.professionalName||"",city:i.address?.city,pc:i.address?.zipCode}; extra.push(meta[i.slug]); } else extra.push(meta[i.slug]); } off+=100; } }
await fetchPages(extra);
// 5. group HAF listings by council → provider.  A listing counts only if eequ flags it isHaf AND (category HAF, HAF-branded council, or HAF wording) — council "Aiming High"/short-breaks schemes are NOT HAF.
const laOfCouncil=t=>{ if(!t) return null; const l=t.toLowerCase(); if(/babergh|mid suffolk/.test(l)) return "Suffolk"; if(/leicestershire/.test(l)) return "__leics__"; return T.find(la=>l.includes(la.toLowerCase()))||null; };
const isHaf=p=>(p.cats||[]).includes("HAF")||/\bHAF\b/i.test(p.council||"")||/\bHAF\b|holiday activit(y|ies) (and|&) food/i.test(p.title||"");
const las={};
for(const [slug,p] of Object.entries(pages)){ if(p.err||!p.isHaf||!isHaf(p)) continue; let la=laOfCouncil(p.council); const m=meta[slug]||{}; if(la==="__leics__") la = laOfPc(m.pc)==="Leicester" ? "Leicester" : null; if(!la) continue;
  const key=(p.mentor||"").trim(); if(!key) continue; las[la]=las[la]||{}; const pr=las[la][key]=las[la][key]||{name:key,towns:new Set(),titles:[],slugs:[],paid:false,cats:new Set(),council:p.council};
  pr.towns.add(p.city||m.city||""); pr.titles.push(p.title); pr.slugs.push(slug); for(const c of p.cats||[]) if(c!=="HAF") pr.cats.add(c.toLowerCase()); if((p.prices||[]).some(x=>x>0)) pr.paid=true; }
const out=[]; for(const [la,provs] of Object.entries(las)){ const providers=Object.values(provs).map(pr=>({name:pr.name,town:[...pr.towns].filter(Boolean).slice(0,3).join(" / "),website:`https://eequ.org/experience/${pr.slugs[0]}`,activityType:[...pr.cats].join(", ")||"holiday club",paid:pr.paid?true:null,note:`eequ HAF listing${pr.titles.length>1?`s (${pr.titles.length})`:""} under ${pr.council}: ${pr.titles.slice(0,3).join("; ")}`.slice(0,300)}));
  out.push({la,region:REGION[la]||null,programmeName:`${la} Holiday Activities and Food (HAF) programme`,hafPageUrl:null,directoryUrl:"https://eequ.org",note:`Providers parsed by script (haf_eequ.mjs) from eequ listings flagged isHaf with council = ${[...new Set(Object.values(provs).map(p=>p.council))].join(" / ")} on ${new Date().toISOString().slice(0,10)}; next-holiday listings may not be live yet.`,providers}); }
fs.mkdirSync("scripts/leads/out/haf-la",{recursive:true}); fs.writeFileSync(`scripts/leads/out/haf-la/${outName}.json`,JSON.stringify(out,null,1));
for(const o of out) console.log(o.la.padEnd(22),o.providers.length); console.log("wrote",outName, "councils",out.length);

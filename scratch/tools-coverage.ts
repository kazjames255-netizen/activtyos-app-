import { readFileSync, readdirSync } from "node:fs";
import { REGISTRY } from "../features/learninghub/tools/registry";
import { mergeRules, selectTools } from "../features/learninghub/tools/selection/select";
const rd = "features/learninghub/tools/selection/rules/";
const rules = mergeRules(readdirSync(rd).filter(f=>f.endsWith(".json")&&!f.includes("golden")).map(f=>JSON.parse(readFileSync(rd+f,"utf8"))),"m");
const live = new Set(REGISTRY.filter(t=>t.status==="live").map(t=>t.id));
const ls = JSON.parse(readFileSync("scratch/nc/lessons.full.json","utf8"));
const ks=(y:number)=>y<=2?"KS1":y<=6?"KS2":y<=9?"KS3":"KS4";
const agg:any={}, used:Record<string,number>={}, spec:Record<string,number>={};
for(const l of ls){
  const r=selectTools({subject:l.s,year:l.y,title:l.t,unit:l.u,objective:l.o,programme:l.p},rules,id=>live.has(id),{max:3});
  const rl=r.filter(x=>x.source==="rule"); const sp=rl.some(x=>x.score>=0.5);
  for(const k of [l.s,l.s+" "+ks(l.y)]){const a=agg[k]??={n:0,any:0,spec:0};a.n++;if(rl.length)a.any++;if(sp)a.spec++;}
  for(const x of rl){used[x.tool]=(used[x.tool]||0)+1;}
}
const ruleTools=new Set(rules.rules.map((r:any)=>r.tool));
const out={agg:Object.fromEntries(Object.entries(agg).map(([k,a]:any)=>[k,{n:a.n,any:+(100*a.any/a.n).toFixed(1),spec:+(100*a.spec/a.n).toFixed(1)}])),
 top:Object.entries(used).sort((a,b)=>b[1]-a[1]).slice(0,15),
 orphansLive:[...live].filter(t=>!used[t]).map(t=>({id:t,title:REGISTRY.find(x=>x.id===t)!.title,subject:REGISTRY.find(x=>x.id===t)!.subject,hasRule:ruleTools.has(t as string)})),
 liveCount:live.size,usedCount:Object.keys(used).length};
console.log(JSON.stringify(out,null,1));
if(process.env.DUMP){const un:any[]=[];for(const l of ls){if(l.s!==process.env.DUMP)continue;const r=selectTools({subject:l.s,year:l.y,title:l.t,unit:l.u,objective:l.o,programme:l.p},rules,id=>live.has(id),{max:3}).filter(x=>x.source==="rule"&&x.score>=0.5);if(!r.length)un.push(l);}
 require("node:fs").writeFileSync("/tmp/x/un-"+process.env.DUMP+".json",JSON.stringify(un));}

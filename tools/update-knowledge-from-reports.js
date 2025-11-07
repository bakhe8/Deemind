// Updates configs/knowledge/salla-docs.json using current reports and source.
// - Adds SDK APIs observed in warnings (sdk-unknown)
// - Adds <salla-*> custom elements found in Twig outputs

import fs from 'fs';
import path from 'path';

function loadJson(p, fallback){ try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch { return fallback; } }
function uniq(arr){ return Array.from(new Set(arr)); }

function scanTwigForSallaTags(root){
  const out = new Set();
  function walk(dir){
    for (const n of fs.readdirSync(dir)){
      const full = path.join(dir,n);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else if (n.endsWith('.twig')){
        const txt = fs.readFileSync(full,'utf8');
        for (const m of txt.matchAll(/<\s*(salla-[a-z0-9-]+)(\s|>)/gi)) out.add(m[1].toLowerCase());
      }
    }
  }
  if (fs.existsSync(root)) walk(root);
  return Array.from(out);
}

function main(){
  const knowPath = path.resolve('configs','knowledge','salla-docs.json');
  const knowledge = loadJson(knowPath, { sdk:{ apis:[], deprecated:[] }, webComponents:{ tags:[] } });

  // Merge SDK APIs from report warnings (gimni)
  const reportPath = path.resolve('output','gimni','report-extended.json');
  const rep = loadJson(reportPath, null);
  if (rep && Array.isArray(rep.warnings)){
    const apis = rep.warnings.filter(w=>w.type==='sdk-unknown').map(w=>{
      const m = String(w.message||'').match(/reference:\s*(\S+)/i);
      return m ? m[1] : null;
    }).filter(Boolean);
    knowledge.sdk = knowledge.sdk || { apis:[], deprecated:[] };
    knowledge.sdk.apis = uniq([...(knowledge.sdk.apis||[]), ...apis]);
  }

  // Merge web components from current outputs
  const tags = scanTwigForSallaTags(path.resolve('output'));
  knowledge.webComponents = knowledge.webComponents || { tags: [] };
  knowledge.webComponents.tags = uniq([...(knowledge.webComponents.tags||[]), ...tags]);

  fs.mkdirSync(path.dirname(knowPath), { recursive: true });
  fs.writeFileSync(knowPath, JSON.stringify(knowledge, null, 2));
  console.log('Knowledge updated at', knowPath);
}

main();


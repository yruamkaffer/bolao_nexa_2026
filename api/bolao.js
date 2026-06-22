
const SHEET_ID = '1DVLPCm8xLxRFsadiEW_89_H3GE9cv5YAyNY5CI3jrzM';
const PUB_ID = '2PACX-1vSsInCRk-l_QEpBvknAIq3Aua_gywvZEi9c95ySWDmUipn3ss6ImJxHqgkx9goZeWyjWEw5FekvCC9m';
const GIDS = { ranking:0, jogos:920522404, palpites:47894027, campeoes:509630144, desempenhoDia:2139496193, desempenhoRodada:1006910075 };
const ENV = { ranking:'CSV_RANKING_URL', jogos:'CSV_JOGOS_URL', palpites:'CSV_PALPITES_URL', campeoes:'CSV_CAMPEOES_URL', desempenhoDia:'CSV_DESEMPENHO_DIA_URL', desempenhoRodada:'CSV_DESEMPENHO_RODADA_URL' };
const gviz = gid => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
const pubcsv = gid => `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?gid=${gid}&single=true&output=csv`;
const GE_COPA_URL = 'https://ge.globo.com/futebol/copa-do-mundo/';
const GE_BRASIL_URL = 'https://ge.globo.com/futebol/selecao-brasileira/';
const GE_NEYMAR_URL = 'https://ge.globo.com/atletas/neymar/';
function withTimeout(ms=9000){ const c=new AbortController(); const t=setTimeout(()=>c.abort(),ms); return {signal:c.signal, done:()=>clearTimeout(t)}; }
async function fetchText(url, timeout=9000){
  if(!url) throw new Error('URL vazia');
  const t=withTimeout(timeout);
  try{
    const finalUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
    const r = await fetch(finalUrl, {signal:t.signal, headers:{'user-agent':'Mozilla/5.0 BolaoNexa','accept':'text/csv,text/html,*/*'}});
    if(!r.ok) throw new Error(`${r.status} ${url}`);
    const text = await r.text();
    if(!text || text.trim().length < 3) throw new Error(`CSV vazio ${url}`);
    return text;
  } finally { t.done(); }
}
async function firstOk(urls, label){
  const errors=[];
  for(const url of urls.filter(Boolean)){
    try{ return {text: await fetchText(url), url}; }
    catch(e){ errors.push(e.message); }
  }
  throw new Error(`${label}: ${errors.join(' | ')}`);
}
function strip(html){return String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()}
function normUrl(u){ if(!u)return''; if(u.startsWith('//'))return 'https:'+u; if(u.startsWith('/'))return 'https://ge.globo.com'+u; return u; }
function extractNoticias(html, limit=8, filtro=null){ const out=[], seen=new Set(); const re=/<a\b[^>]*href=["']([^"']*\/noticia\/[^"']+\.ghtml(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi; let m; while((m=re.exec(String(html||'')))&&out.length<limit*3){ const url=normUrl(m[1]).split('?')[0]; const titulo=strip(m[2]).replace(/\s+\|\s+ge$/i,'').trim(); if(!titulo||titulo.length<24||/mostrar mais|image|foto/i.test(titulo))continue; if(filtro&&!filtro(titulo,url))continue; const key=(titulo+'|'+url).toLowerCase(); if(seen.has(key))continue; seen.add(key); out.push({titulo,url,fonte:'ge'}); } return out.slice(0,limit); }
module.exports = async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Cache-Control','no-store, max-age=0, must-revalidate');
  const newsOnly = req.query && req.query.news === '1';
  const warnings=[];
  if(newsOnly){
    const urls={copa:process.env.GE_COPA_URL||GE_COPA_URL, brasil:process.env.GE_BRASIL_URL||GE_BRASIL_URL, neymar:process.env.GE_NEYMAR_URL||GE_NEYMAR_URL};
    const [c,b,n] = await Promise.allSettled([fetchText(urls.copa,7000), fetchText(urls.brasil,7000), fetchText(urls.neymar,7000)]);
    if(c.status==='rejected') warnings.push('noticias: '+c.reason.message);
    if(b.status==='rejected') warnings.push('brasil: '+b.reason.message);
    if(n.status==='rejected') warnings.push('neymar: '+n.reason.message);
    return res.status(200).json({ok:true,source:'news',updatedAt:new Date().toISOString(),noticias:c.status==='fulfilled'?extractNoticias(c.value,8):[],noticiasBrasil:b.status==='fulfilled'?extractNoticias(b.value,4,(t,u)=>/brasil|sele[cç][aã]o|copa|neymar|ancelotti|haiti/i.test(t+' '+u)):[],noticiasNeymar:n.status==='fulfilled'?extractNoticias(n.value,6,(t,u)=>/neymar|santos|brasil|sele[cç][aã]o|copa/i.test(t+' '+u)):[],warnings});
  }
  const csvs={}, urls={}, started=Date.now();
  await Promise.all(Object.entries(GIDS).map(async ([key,gid])=>{
    const envUrl = process.env[ENV[key]];
    const candidates = [gviz(gid), envUrl, pubcsv(gid)];
    try{ const got=await firstOk(candidates, key); csvs[key]=got.text; urls[key]=got.url; }
    catch(e){ warnings.push(e.message); }
  }));
  return res.status(200).json({ok:Object.keys(csvs).length>0,source:'vercel-api-gviz-pub-env',updatedAt:new Date().toISOString(),tookMs:Date.now()-started,urls,csvs,warnings});
};

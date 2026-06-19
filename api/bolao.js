const SHEET_ID = '1DVLPCm8xLxRFsadiEW_89_H3GE9cv5YAyNY5CI3jrzM';
// GViz CSV consulta a planilha pública pelo ID original e costuma atualizar bem mais rápido que /pub.
const pub = gid => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
const DEFAULT_URLS = {
  ranking: pub(0),
  jogos: pub(920522404),
  palpites: pub(47894027),
  campeoes: pub(509630144),
  desempenhoDia: pub(2139496193),
  desempenhoRodada: pub(1006910075)
};
const GE_COPA_URL = 'https://ge.globo.com/futebol/copa-do-mundo/';
const GE_BRASIL_URL = 'https://ge.globo.com/futebol/selecao-brasileira/';
const GE_NEYMAR_URL = 'https://ge.globo.com/atletas/neymar/';
function withTimeout(ms=8000){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);return{signal:c.signal,done:()=>clearTimeout(t)}}
async function fetchText(url, timeout=8000){ if(!url)return null; const t=withTimeout(timeout); try{ const finalUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
 const r=await fetch(finalUrl,{signal:t.signal,headers:{'user-agent':'Mozilla/5.0 BolaoNexa/clean','accept':'text/csv,text/html,*/*'}}); if(!r.ok) throw new Error(`${r.status} ${url}`); return await r.text(); } finally {t.done();} }
function strip(html){return String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()}
function normUrl(u){ if(!u)return''; if(u.startsWith('//'))return 'https:'+u; if(u.startsWith('/'))return 'https://ge.globo.com'+u; return u; }
function extractNoticias(html, limit=8, filtro=null){ const out=[], seen=new Set(); const re=/<a\b[^>]*href=["']([^"']*\/noticia\/[^"']+\.ghtml(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi; let m; while((m=re.exec(String(html||'')))&&out.length<limit*3){ const url=normUrl(m[1]).split('?')[0]; const titulo=strip(m[2]).replace(/\s+\|\s+ge$/i,'').trim(); if(!titulo||titulo.length<24||/mostrar mais|image|foto/i.test(titulo))continue; if(filtro&&!filtro(titulo,url))continue; const key=(titulo+'|'+url).toLowerCase(); if(seen.has(key))continue; seen.add(key); out.push({titulo,url,fonte:'ge'}); } return out.slice(0,limit); }
module.exports = async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const useEnvCsv = process.env.FORCE_ENV_CSV === '1';
  const urls={
    ranking: useEnvCsv && process.env.CSV_RANKING_URL ? process.env.CSV_RANKING_URL : DEFAULT_URLS.ranking,
    jogos: useEnvCsv && process.env.CSV_JOGOS_URL ? process.env.CSV_JOGOS_URL : DEFAULT_URLS.jogos,
    palpites: useEnvCsv && process.env.CSV_PALPITES_URL ? process.env.CSV_PALPITES_URL : DEFAULT_URLS.palpites,
    campeoes: useEnvCsv && process.env.CSV_CAMPEOES_URL ? process.env.CSV_CAMPEOES_URL : DEFAULT_URLS.campeoes,
    desempenhoDia: useEnvCsv && process.env.CSV_DESEMPENHO_DIA_URL ? process.env.CSV_DESEMPENHO_DIA_URL : DEFAULT_URLS.desempenhoDia,
    desempenhoRodada: useEnvCsv && process.env.CSV_DESEMPENHO_RODADA_URL ? process.env.CSV_DESEMPENHO_RODADA_URL : DEFAULT_URLS.desempenhoRodada,
    noticias: process.env.GE_COPA_URL || GE_COPA_URL,
    noticiasBrasil: process.env.GE_BRASIL_URL || GE_BRASIL_URL,
    noticiasNeymar: process.env.GE_NEYMAR_URL || GE_NEYMAR_URL
  };
  const warnings=[]; const started=Date.now();
  if(req.query?.news==='1'){
    const [c,b,n]=await Promise.allSettled([fetchText(urls.noticias,7000),fetchText(urls.noticiasBrasil,7000),fetchText(urls.noticiasNeymar,7000)]);
    return res.status(200).json({ok:true,source:'news',updatedAt:new Date().toISOString(),noticias:c.status==='fulfilled'?extractNoticias(c.value,8):[],noticiasBrasil:b.status==='fulfilled'?extractNoticias(b.value,4,(t,u)=>/brasil|sele[cç][aã]o|copa|neymar|ancelotti|haiti/i.test(t+' '+u)):[],noticiasNeymar:n.status==='fulfilled'?extractNoticias(n.value,6,(t,u)=>/neymar|santos|brasil|sele[cç][aã]o|copa/i.test(t+' '+u)):[],warnings});
  }
  const keys=['ranking','jogos','palpites','campeoes','desempenhoDia','desempenhoRodada']; const csvs={};
  await Promise.all(keys.map(async k=>{ try{ csvs[k]=await fetchText(urls[k],8000); } catch(e){ warnings.push(`${k}: ${e.message}`); } }));
  res.status(200).json({ok:Object.keys(csvs).length>0,source:'vercel-clean-api',updatedAt:new Date().toISOString(),tookMs:Date.now()-started,urls,csvs,warnings});
};

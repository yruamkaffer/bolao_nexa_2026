const DEFAULT_RANKING_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSsInCRk-l_QEpBvknAIq3Aua_gywvZEi9c95ySWDmUipn3ss6ImJxHqgkx9goZeWyjWEw5FekvCC9m/pub?output=csv';
const GE_COPA_URL = 'https://ge.globo.com/futebol/copa-do-mundo/';
const GE_ARTILHARIA_URL = 'https://ge.globo.com/futebol/copa-do-mundo/noticia/2026/06/12/copa-do-mundo-2026-veja-ranking-de-artilheiros-e-garcons.ghtml';
const GE_BRASIL_URL = 'https://ge.globo.com/futebol/selecao-brasileira/';
const GE_NEYMAR_URL = 'https://ge.globo.com/atletas/neymar/';

function withTimeout(ms = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, done: () => clearTimeout(timer) };
}

async function fetchText(url, timeoutMs = 7000) {
  if (!url) return null;
  const { controller, done } = withTimeout(timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 BolaoNexa/1.2 (+https://vercel.app)',
        'accept': 'text/html,application/xhtml+xml,application/xml,text/csv;q=0.9,*/*;q=0.8'
      }
    });
    if (!res.ok) throw new Error(`Falha ao buscar ${url}: ${res.status}`);
    return await res.text();
  } finally {
    done();
  }
}

async function fetchMap(urls, keys, warnings, timeoutMs = 7000) {
  const entries = keys.filter(key => urls[key]).map(key => [key, urls[key]]);
  const unique = new Map();
  for (const [, url] of entries) if (!unique.has(url)) unique.set(url, fetchText(url, timeoutMs));
  const results = await Promise.allSettled([...unique.entries()].map(async ([url, promise]) => [url, await promise]));
  const byUrl = new Map();
  for (const result of results) {
    if (result.status === 'fulfilled') byUrl.set(result.value[0], result.value[1]);
    else warnings.push(`url: ${result.reason?.message || result.reason}`);
  }
  const out = {};
  for (const [key, url] of entries) {
    if (byUrl.has(url)) out[key] = byUrl.get(url);
    else warnings.push(`${key}: não carregou`);
  }
  return out;
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(html) {
  return decodeEntities(String(html || ''))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUrl(url) {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `https://ge.globo.com${url}`;
  return url;
}

function cleanTitle(title) {
  return stripHtml(title)
    .replace(/\s+\|\s+ge\s*$/i, '')
    .replace(/^#+\s*/, '')
    .trim();
}

function extractArtilharia(html) {
  const text = stripHtml(html);
  const m = text.match(/Veja os artilheiros da Copa do Mundo 2026\s*(.*?)\s*Veja os garçons/i);
  return m ? m[1].slice(0, 1800) : null;
}

function extractNoticias(html, limit = 8, filtro = null) {
  const items = [];
  const seen = new Set();
  const page = String(html || '');
  const anchorRegex = /<a\b[^>]*href=["']([^"']*(?:ge\.globo\.com)?[^"']*\/noticia\/[^"']+\.ghtml(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRegex.exec(page)) && items.length < Math.max(limit * 2, 8)) {
    const url = normalizeUrl(decodeEntities(match[1]).split('?')[0]);
    const title = cleanTitle(match[2]);
    if (!title || title.length < 24 || /mostrar mais|image|foto|vídeo/i.test(title)) continue;
    if (filtro && !filtro(title, url)) continue;
    const key = `${title.toLowerCase()}|${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ titulo: title, url, tempo: '', fonte: 'ge' });
  }
  if (items.length < Math.min(4, limit)) {
    const urlRegex = /https:\/\/ge\.globo\.com\/[^"\\]+?\/noticia\/[^"\\]+?\.ghtml/gi;
    const titleAroundRegex = /"(?:headline|title)"\s*:\s*"([^"]{28,180})"/gi;
    const urls = [...page.matchAll(urlRegex)].map(m => m[0].replace(/\\\//g, '/'));
    const titles = [...page.matchAll(titleAroundRegex)].map(m => decodeEntities(m[1]).trim());
    for (let i = 0; i < Math.min(urls.length, titles.length) && items.length < limit; i++) {
      const title = cleanTitle(titles[i]);
      const url = normalizeUrl(urls[i]);
      if (!title || !/copa|brasil|sele[cç][aã]o|mundial|grupo|jogo|gol|fifa|haiti|neymar|ancelotti/i.test(title)) continue;
      if (filtro && !filtro(title, url)) continue;
      const key = `${title.toLowerCase()}|${url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ titulo: title, url, tempo: '', fonte: 'ge' });
    }
  }
  return items.slice(0, limit);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const isLite = req.query?.lite === '1';
  const newsOnly = req.query?.news === '1';
  const fresh = req.query?.fresh === '1' || req.query?.ts;
  res.setHeader('Cache-Control', fresh ? 'no-store' : (isLite ? 's-maxage=30, stale-while-revalidate=60' : 's-maxage=180, stale-while-revalidate=600'));

  const started = Date.now();
  const warnings = [];
  const urls = {
    ranking: process.env.CSV_RANKING_URL || DEFAULT_RANKING_CSV,
    jogos: process.env.CSV_JOGOS_URL || '',
    palpites: process.env.CSV_PALPITES_URL || '',
    campeoes: process.env.CSV_CAMPEOES_URL || '',
    pontuacao: process.env.CSV_PONTUACAO_URL || process.env.CSV_PONTOS_JOGOS_URL || '',
    desempenhoDia: process.env.CSV_DESEMPENHO_DIA_URL || '',
    desempenhoRodada: process.env.CSV_DESEMPENHO_RODADA_URL || '',
    noticias: process.env.GE_COPA_URL || GE_COPA_URL,
    noticiasBrasil: process.env.GE_BRASIL_URL || GE_BRASIL_URL,
    noticiasNeymar: process.env.GE_NEYMAR_URL || GE_NEYMAR_URL,
    artilharia: process.env.GE_ARTILHARIA_URL || GE_ARTILHARIA_URL
  };

  let csvs = {};
  if (!newsOnly) {
    csvs = await fetchMap(urls, ['ranking', 'jogos', 'palpites', 'campeoes', 'pontuacao', 'desempenhoDia', 'desempenhoRodada'], warnings, 6500);
  }

  let artilhariaTexto = null;
  let noticias = [];
  let noticiasBrasil = [];
  let noticiasNeymar = [];

  if (!isLite) {
    const [art, copa, brasil, ney] = await Promise.allSettled([
      fetchText(urls.artilharia, 6500),
      fetchText(urls.noticias, 6500),
      fetchText(urls.noticiasBrasil, 6500),
      fetchText(urls.noticiasNeymar, 6500)
    ]);
    if (art.status === 'fulfilled') artilhariaTexto = extractArtilharia(art.value); else warnings.push(`ge artilharia: ${art.reason?.message || art.reason}`);
    if (copa.status === 'fulfilled') noticias = extractNoticias(copa.value, 8); else warnings.push(`ge notícias: ${copa.reason?.message || copa.reason}`);
    if (brasil.status === 'fulfilled') noticiasBrasil = extractNoticias(brasil.value, 4, (titulo, url) => /brasil|sele[cç][aã]o|haiti|neymar|ancelotti|casemiro|endrick/i.test(titulo + ' ' + url)); else warnings.push(`ge notícias brasil: ${brasil.reason?.message || brasil.reason}`);
    if (ney.status === 'fulfilled') noticiasNeymar = extractNoticias(ney.value, 6, (titulo, url) => /neymar|santos|sele[cç][aã]o|brasil|copa|ney/i.test(titulo + ' ' + url)); else warnings.push(`ge notícias neymar: ${ney.reason?.message || ney.reason}`);
  }

  res.status(200).json({
    ok: newsOnly ? true : Object.keys(csvs).length > 0,
    source: isLite ? 'vercel-function-lite' : (newsOnly ? 'vercel-function-news' : 'vercel-function'),
    updatedAt: new Date().toISOString(),
    tookMs: Date.now() - started,
    urls,
    csvs,
    artilhariaTexto,
    noticias,
    noticiasBrasil,
    noticiasNeymar,
    warnings
  });
};

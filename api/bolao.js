const DEFAULT_RANKING_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSsInCRk-l_QEpBvknAIq3Aua_gywvZEi9c95ySWDmUipn3ss6ImJxHqgkx9goZeWyjWEw5FekvCC9m/pub?output=csv';
const GE_COPA_URL = 'https://ge.globo.com/futebol/copa-do-mundo/';
const GE_ARTILHARIA_URL = 'https://ge.globo.com/futebol/copa-do-mundo/noticia/2026/06/12/copa-do-mundo-2026-veja-ranking-de-artilheiros-e-garcons.ghtml';
const GE_BRASIL_URL = 'https://ge.globo.com/futebol/selecao-brasileira/';

async function fetchText(url) {
  if (!url) return null;
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 BolaoNexa/1.1 (+https://vercel.app)',
      'accept': 'text/html,application/xhtml+xml,application/xml,text/csv;q=0.9,*/*;q=0.8'
    }
  });
  if (!res.ok) throw new Error(`Falha ao buscar ${url}: ${res.status}`);
  return await res.text();
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

  // 1) Padrão mais comum: links de matéria dentro da página da Copa no ge.
  const anchorRegex = /<a\b[^>]*href=["']([^"']*\/futebol\/copa-do-mundo\/noticia\/[^"']+\.ghtml(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi;
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

  // 2) Fallback para metadados JSON/Next/Globo quando os anchors chegam sem texto útil.
  if (items.length < Math.min(4, limit)) {
    const urlRegex = /https:\/\/ge\.globo\.com\/futebol\/copa-do-mundo\/noticia\/[^"\\]+?\.ghtml/gi;
    const titleAroundRegex = /"(?:headline|title)"\s*:\s*"([^"]{28,180})"/gi;
    const urls = [...page.matchAll(urlRegex)].map(m => m[1].replace(/\\\//g, '/'));
    const titles = [...page.matchAll(titleAroundRegex)].map(m => decodeEntities(m[1]).trim());
    for (let i = 0; i < Math.min(urls.length, titles.length) && items.length < 8; i++) {
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
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=600');

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
    artilharia: process.env.GE_ARTILHARIA_URL || GE_ARTILHARIA_URL
  };

  const csvs = {};
  for (const key of ['ranking', 'jogos', 'palpites', 'campeoes', 'pontuacao', 'desempenhoDia', 'desempenhoRodada']) {
    const url = urls[key];
    if (!url) continue;
    try { csvs[key] = await fetchText(url); }
    catch (err) { warnings.push(`${key}: ${err.message}`); }
  }

  let artilhariaTexto = null;
  try { artilhariaTexto = extractArtilharia(await fetchText(urls.artilharia)); }
  catch (err) { warnings.push(`ge artilharia: ${err.message}`); }

  let noticias = [];
  try { noticias = extractNoticias(await fetchText(urls.noticias), 8); }
  catch (err) { warnings.push(`ge notícias: ${err.message}`); }

  let noticiasBrasil = [];
  try {
    const brasilHtml = await fetchText(urls.noticiasBrasil);
    noticiasBrasil = extractNoticias(brasilHtml, 4, (titulo, url) => /brasil|sele[cç][aã]o|haiti|neymar|ancelotti|casemiro|endrick/i.test(titulo + ' ' + url));
  } catch (err) { warnings.push(`ge notícias brasil: ${err.message}`); }

  res.status(200).json({
    ok: Object.keys(csvs).length > 0,
    source: 'vercel-function',
    updatedAt: new Date().toISOString(),
    urls,
    csvs,
    artilhariaTexto,
    noticias,
    noticiasBrasil,
    warnings
  });
};

/*
 * API Vercel - Bolão Copa do Mundo NEXA 2026
 * Sem dependências. Busca Google Sheets via gviz CSV, normaliza dados e entrega JSON consolidado.
 */

const APP_VERSION = '2026.06.22-final-v1';

const SHEET_ID = process.env.SHEET_ID || '1DVLPCm8xLxRFsadiEW_89_H3GE9cv5YAyNY5CI3jrzM';
const PARTICIPANTES = ['Junin', 'Binho', 'Carlos', 'Jean', 'Matheus', 'Yruam', 'Rodrigo', 'Rapha', 'IA'];

const SHEETS = {
  ranking: {
    label: 'Classificação',
    sheet: process.env.SHEET_RANKING_NAME || 'Classificação',
    gid: process.env.SHEET_RANKING_GID || ''
  },
  jogos: {
    label: 'Jogos',
    sheet: process.env.SHEET_JOGOS_NAME || 'Jogos',
    gid: process.env.SHEET_JOGOS_GID || ''
  },
  palpites: {
    label: 'Palpites',
    sheet: process.env.SHEET_PALPITES_NAME || 'Palpites',
    gid: process.env.SHEET_PALPITES_GID || ''
  },
  desempenhoDia: {
    label: 'Desempenho por dia',
    sheet: process.env.SHEET_DESEMPENHO_DIA_NAME || 'Desempenho por dia',
    gid: process.env.SHEET_DESEMPENHO_DIA_GID || ''
  },
  desempenhoRodada: {
    label: 'Desempenho por rodada',
    sheet: process.env.SHEET_DESEMPENHO_RODADA_NAME || 'Desempenho por rodada',
    gid: process.env.SHEET_DESEMPENHO_RODADA_GID || ''
  },
  campeoes: {
    label: 'Outras pontuações',
    sheet: process.env.SHEET_CAMPEOES_NAME || 'Outras pontuações',
    gid: process.env.SHEET_CAMPEOES_GID || ''
  }
};

const FALLBACK_CAMPEOES = [
  { nome: 'Junin', palpite: 'Portugal', origem: 'fallback-local' },
  { nome: 'Yruam', palpite: 'Espanha', origem: 'fallback-local' },
  { nome: 'Matheus', palpite: 'Brasil', origem: 'fallback-local' },
  { nome: 'Jean', palpite: 'França', origem: 'fallback-local' },
  { nome: 'Binho', palpite: 'Argentina', origem: 'fallback-local' },
  { nome: 'Carlos', palpite: 'Espanha', origem: 'fallback-local' },
  { nome: 'IA', palpite: 'França', origem: 'fallback-local' },
  { nome: 'Rodrigo', palpite: 'Brasil', origem: 'fallback-local' },
  { nome: 'Rapha', palpite: 'Holanda', origem: 'fallback-local' }
];

const ENV_KEY_MAP = {
  ranking: 'RANKING',
  jogos: 'JOGOS',
  palpites: 'PALPITES',
  desempenhoDia: 'DESEMPENHO_DIA',
  desempenhoRodada: 'DESEMPENHO_RODADA',
  campeoes: 'CAMPEOES'
};

const NEWS_SOURCES = {
  copa: 'https://ge.globo.com/futebol/copa-do-mundo/',
  brasil: 'https://ge.globo.com/futebol/selecao-brasileira/',
  neymar: 'https://ge.globo.com/atletas/neymar/'
};

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function cleanCell(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const cleaned = raw
    .replace(/R\$/gi, '')
    .replace(/%/g, '')
    .replace(/[^0-9,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toInt(value) {
  const n = toNumber(value);
  return n === null ? null : Math.trunc(n);
}

function isParticipantName(value) {
  const n = normalizeText(value);
  return PARTICIPANTES.some((p) => normalizeText(p) === n);
}

function getParticipantCanonical(value) {
  const n = normalizeText(value);
  return PARTICIPANTES.find((p) => normalizeText(p) === n) || null;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < String(text || '').length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
  return rows
    .map((r) => {
      const out = Array.from({ length: width }, (_, idx) => cleanCell(r[idx] ?? ''));
      return out;
    })
    .filter((r) => r.some((c) => c !== ''));
}

function findHeaderRow(rows, keywords, minMatches = 2) {
  const kws = keywords.map(normalizeText);
  for (let i = 0; i < rows.length; i += 1) {
    const joined = rows[i].map(normalizeText).join(' | ');
    const matches = kws.filter((kw) => joined.includes(kw)).length;
    if (matches >= minMatches) return i;
  }
  return -1;
}

function findColumn(header, aliases) {
  const normalizedAliases = aliases.map(normalizeText);
  let idx = header.findIndex((h) => normalizedAliases.includes(normalizeText(h)));
  if (idx >= 0) return idx;
  idx = header.findIndex((h) => normalizedAliases.some((a) => normalizeText(h).includes(a)));
  return idx;
}

function findColumnDeep(rows, headerRowIndex, aliases, lookback = 2) {
  const start = Math.max(0, headerRowIndex - lookback);
  const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const normalizedAliases = aliases.map(normalizeText);

  for (let c = 0; c < width; c += 1) {
    const vertical = [];
    for (let r = start; r <= headerRowIndex; r += 1) vertical.push(rows[r]?.[c] || '');
    const joined = normalizeText(vertical.join(' '));
    if (normalizedAliases.some((a) => joined === a || joined.includes(a))) return c;
  }
  return -1;
}

function buildSheetUrl(key) {
  const cfg = SHEETS[key];
  const envUrl = process.env[`SHEET_${ENV_KEY_MAP[key] || key.toUpperCase()}_URL`] || '';
  if (envUrl) {
    const sep = envUrl.includes('?') ? '&' : '?';
    return `${envUrl}${sep}_=${Date.now()}`;
  }
  const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;
  if (cfg.gid) return `${base}&gid=${encodeURIComponent(cfg.gid)}&_=${Date.now()}`;
  return `${base}&sheet=${encodeURIComponent(cfg.sheet)}&_=${Date.now()}`;
}

async function fetchText(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 BolaoNexa/1.0',
        'Accept': 'text/csv,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cache-Control': 'no-cache'
      },
      cache: 'no-store',
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSheetRows(key) {
  const url = buildSheetUrl(key);
  const text = await fetchText(url, 12000);
  if (/^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text)) {
    throw new Error('Google Sheets retornou HTML, não CSV. Verifique permissão pública da aba.');
  }
  return { rows: parseCSV(text), url };
}

function parseRanking(rows) {
  if (!rows.length) return [];
  const headerIdx = findHeaderRow(rows, ['participante', 'pontos'], 2);
  const hidx = headerIdx >= 0 ? headerIdx : findHeaderRow(rows, ['nome', 'total'], 1);
  const header = rows[hidx] || rows[0] || [];

  const posCol = findColumn(header, ['posição', 'posicao', 'pos', '#', 'rank']);
  const nameCol = findColumn(header, ['participante', 'nome', 'jogador']);
  const ptsCol = findColumn(header, ['pontos', 'pts', 'total']);
  const cravCol = findColumn(header, ['cravadas', 'cravada']);
  const corrCol = findColumn(header, ['palpites corretos', 'corretos', 'acertos']);
  const faseCol = findColumn(header, ['pontos fase grupos', 'fase grupos', 'fase de grupos']);
  const mataCol = findColumn(header, ['pontos mata-mata', 'mata-mata', 'mata mata']);
  const bonusCol = findColumn(header, ['pontos bônus', 'pontos bonus', 'bônus', 'bonus']);

  const dataStart = hidx >= 0 ? hidx + 1 : 0;
  const parsed = [];

  rows.slice(dataStart).forEach((row) => {
    const detectedName = nameCol >= 0 ? row[nameCol] : row.find(isParticipantName);
    const nome = getParticipantCanonical(detectedName);
    if (!nome) return;

    const pontos = ptsCol >= 0 ? toNumber(row[ptsCol]) : firstNumberNear(row, detectedName);
    parsed.push({
      posicao: posCol >= 0 ? normalizePosition(row[posCol]) : null,
      nome,
      pontos: pontos ?? 0,
      cravadas: cravCol >= 0 ? (toInt(row[cravCol]) ?? 0) : 0,
      corretos: corrCol >= 0 ? (toInt(row[corrCol]) ?? 0) : 0,
      faseGrupos: faseCol >= 0 ? (toNumber(row[faseCol]) ?? pontos ?? 0) : (pontos ?? 0),
      mataMata: mataCol >= 0 ? (toNumber(row[mataCol]) ?? 0) : 0,
      bonus: bonusCol >= 0 ? (toNumber(row[bonusCol]) ?? 0) : 0
    });
  });

  const hasOfficialPosition = parsed.some((r) => r.posicao !== null);
  if (!hasOfficialPosition) {
    parsed.sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  parsed.forEach((r, idx) => { if (!r.posicao) r.posicao = idx + 1; });
  return parsed;
}

function firstNumberNear(row, detectedName) {
  const idx = row.indexOf(detectedName);
  const from = idx >= 0 ? idx + 1 : 0;
  for (let i = from; i < row.length; i += 1) {
    const n = toNumber(row[i]);
    if (n !== null) return n;
  }
  return null;
}

function normalizePosition(value) {
  const n = toInt(String(value ?? '').replace(/[^0-9]/g, ''));
  return n || null;
}

function parseScore(value) {
  const raw = cleanCell(value);
  if (!raw) return null;
  const match = raw.match(/(-?\d+)\s*(?::|x|X|-|a)\s*(-?\d+)/i);
  if (!match) return null;
  return { g1: Number(match[1]), g2: Number(match[2]), text: `${Number(match[1])}:${Number(match[2])}` };
}

function splitTeams(value) {
  const raw = cleanCell(value);
  if (!raw) return [null, null];
  const parts = raw.split(/\s+(?:x|X|vs\.?|versus)\s+/i).map(cleanCell).filter(Boolean);
  return parts.length >= 2 ? [parts[0], parts.slice(1).join(' x ')] : [null, null];
}

function parseJogos(rows) {
  if (!rows.length) return [];
  let hidx = findHeaderRow(rows, ['jogo', 'data', 'hora'], 2);
  if (hidx < 0) hidx = findHeaderRow(rows, ['partida', 'rodada'], 1);
  if (hidx < 0) hidx = 0;
  const header = rows[hidx] || [];

  const numCol = findColumn(header, ['jogo', 'nº', 'n°', 'num', 'número', 'numero', '#']);
  const dataCol = findColumn(header, ['data', 'dia']);
  const horaCol = findColumn(header, ['hora', 'horário', 'horario']);
  const rodadaCol = findColumn(header, ['rodada', 'fase']);
  const grupoCol = findColumn(header, ['grupo']);
  const time1Col = findColumn(header, ['time 1', 'seleção 1', 'selecao 1', 'mandante', 'equipe 1', 'time1']);
  const time2Col = findColumn(header, ['time 2', 'seleção 2', 'selecao 2', 'visitante', 'equipe 2', 'time2']);
  const partidaCol = findColumn(header, ['partida', 'jogo/partida', 'confronto']);
  const placarCol = findColumn(header, ['placar', 'resultado']);
  const gols1Col = findColumn(header, ['gols 1', 'gol 1', 'g1', 'placar 1', 'gols time 1']);
  const gols2Col = findColumn(header, ['gols 2', 'gol 2', 'g2', 'placar 2', 'gols time 2']);

  const jogos = [];
  rows.slice(hidx + 1).forEach((row) => {
    const num = numCol >= 0 ? toInt(row[numCol]) : firstIntInRow(row.slice(0, 4));
    if (!num) return;

    let time1 = time1Col >= 0 ? cleanCell(row[time1Col]) : '';
    let time2 = time2Col >= 0 ? cleanCell(row[time2Col]) : '';
    if ((!time1 || !time2) && partidaCol >= 0) {
      const [a, b] = splitTeams(row[partidaCol]);
      time1 = time1 || a || '';
      time2 = time2 || b || '';
    }
    if (!time1 || !time2) return;

    let g1 = gols1Col >= 0 ? toInt(row[gols1Col]) : null;
    let g2 = gols2Col >= 0 ? toInt(row[gols2Col]) : null;
    if ((g1 === null || g2 === null) && placarCol >= 0) {
      const score = parseScore(row[placarCol]);
      if (score) { g1 = score.g1; g2 = score.g2; }
    }

    jogos.push({
      num,
      data: dataCol >= 0 ? cleanCell(row[dataCol]) : '',
      hora: horaCol >= 0 ? cleanCell(row[horaCol]) : '',
      rodada: rodadaCol >= 0 ? cleanCell(row[rodadaCol]) : inferRodada(num),
      grupo: grupoCol >= 0 ? cleanCell(row[grupoCol]).replace(/^grupo\s+/i, '') : inferGrupo(time1, time2),
      time1,
      time2,
      gols1: g1,
      gols2: g2,
      status: g1 !== null && g2 !== null ? 'finalizado' : 'pendente'
    });
  });
  return jogos.sort((a, b) => a.num - b.num);
}

function firstIntInRow(row) {
  for (const cell of row) {
    const n = toInt(cell);
    if (n !== null && n > 0) return n;
  }
  return null;
}

function inferRodada(num) {
  if (num <= 24) return '1ª rodada';
  if (num <= 48) return '2ª rodada';
  if (num <= 72) return '3ª rodada';
  return 'Mata-mata';
}

function inferGrupo() { return ''; }

function parsePalpites(rows) {
  if (!rows.length) return { palpites: [], palpitesPorJogo: {}, debug: { participantRow: -1, subHeaderRow: -1, mapped: [] } };

  let participantRow = -1;
  let maxNames = 0;
  rows.forEach((row, idx) => {
    const names = row.filter(isParticipantName).length;
    if (names > maxNames) { maxNames = names; participantRow = idx; }
  });

  if (participantRow < 0 || maxNames < 2) {
    throw new Error('Não encontrei a linha dos participantes na aba Palpites.');
  }

  let subHeaderRow = -1;
  for (let r = participantRow + 1; r <= Math.min(rows.length - 1, participantRow + 4); r += 1) {
    const rowNorm = rows[r].map(normalizeText);
    const palpiteCount = rowNorm.filter((c) => c.includes('palpite')).length;
    const pontosCount = rowNorm.filter((c) => c.includes('ponto') || c === 'pts').length;
    if (palpiteCount >= 2 && pontosCount >= 2) { subHeaderRow = r; break; }
  }
  if (subHeaderRow < 0) subHeaderRow = participantRow + 1;

  const participantCells = [];
  rows[participantRow].forEach((cell, col) => {
    const name = getParticipantCanonical(cell);
    if (name) participantCells.push({ name, col });
  });
  participantCells.sort((a, b) => a.col - b.col);

  const mapping = participantCells.map((item, idx) => {
    const nextCol = participantCells[idx + 1]?.col ?? rows[subHeaderRow].length;
    const candidates = [];
    for (let c = item.col; c < nextCol; c += 1) candidates.push(c);
    // Em planilhas com célula mesclada, o nome pode estar 1 coluna antes do bloco real.
    if (!candidates.length && item.col + 1 < rows[subHeaderRow].length) candidates.push(item.col + 1);

    let palpiteCol = candidates.find((c) => normalizeText(rows[subHeaderRow][c]).includes('palpite'));
    let pontosCol = candidates.find((c) => {
      const n = normalizeText(rows[subHeaderRow][c]);
      return n.includes('ponto') || n === 'pts';
    });

    if (palpiteCol === undefined) palpiteCol = item.col;
    if (pontosCol === undefined) {
      pontosCol = candidates.find((c) => c !== palpiteCol && toNumber(rows[subHeaderRow + 1]?.[c]) !== null);
      if (pontosCol === undefined) pontosCol = palpiteCol + 1;
    }

    return { participante: item.name, palpiteCol, pontosCol };
  });

  const gameCol = findGameColumn(rows, participantRow, subHeaderRow);
  const dataStart = subHeaderRow + 1;
  const palpites = [];

  rows.slice(dataStart).forEach((row) => {
    const jogo = gameCol >= 0 ? toInt(row[gameCol]) : firstIntInRow(row.slice(0, 4));
    if (!jogo) return;
    mapping.forEach((m) => {
      const score = parseScore(row[m.palpiteCol]);
      const rawPalpite = cleanCell(row[m.palpiteCol]);
      const pontos = toNumber(row[m.pontosCol]);
      if (!rawPalpite && pontos === null) return;
      palpites.push({
        jogo,
        participante: m.participante,
        palpite: score ? score.text : rawPalpite,
        g1: score ? score.g1 : null,
        g2: score ? score.g2 : null,
        pontos: pontos === null ? null : pontos
      });
    });
  });

  const palpitesPorJogo = groupBy(palpites, (p) => String(p.jogo));
  return { palpites, palpitesPorJogo, debug: { participantRow, subHeaderRow, mapped: mapping } };
}

function findGameColumn(rows, participantRow, subHeaderRow) {
  for (let r = Math.max(0, participantRow - 2); r <= subHeaderRow; r += 1) {
    const col = findColumn(rows[r] || [], ['jogo', 'nº', 'n°', 'numero', 'número']);
    if (col >= 0) return col;
  }
  for (let c = 0; c < Math.min(6, rows[subHeaderRow]?.length || 0); c += 1) {
    let intCount = 0;
    for (let r = subHeaderRow + 1; r < Math.min(rows.length, subHeaderRow + 15); r += 1) {
      const n = toInt(rows[r][c]);
      if (n !== null && n > 0 && n <= 150) intCount += 1;
    }
    if (intCount >= 3) return c;
  }
  return 0;
}

function groupBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function parseMatrix(rows, mode) {
  if (!rows.length) return [];
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const hasParticipant = row.some((c) => ['participante', 'nome', 'jogador'].includes(normalizeText(c)));
    const hasKnownParticipantBelow = rows.slice(i + 1, i + 8).some((r) => r.some(isParticipantName));
    const hasPeriod = row.some((c) => mode === 'dia' ? /\d{1,2}\/\d{1,2}/.test(c) : normalizeText(c).includes('rodada'));
    if ((hasParticipant || hasKnownParticipantBelow) && hasPeriod) { headerIdx = i; break; }
  }
  if (headerIdx < 0) headerIdx = 0;

  const header = rows[headerIdx];
  let participantCol = findColumn(header, ['participante', 'nome', 'jogador']);
  if (participantCol < 0) {
    participantCol = 0;
    for (let c = 0; c < Math.min(4, header.length); c += 1) {
      if (rows.slice(headerIdx + 1, headerIdx + 10).some((r) => isParticipantName(r[c]))) { participantCol = c; break; }
    }
  }

  const periodCols = header
    .map((cell, col) => ({ cell: cleanCell(cell), col }))
    .filter(({ cell, col }) => col !== participantCol && isMatrixPeriod(cell, mode));

  const out = [];
  rows.slice(headerIdx + 1).forEach((row) => {
    const participante = getParticipantCanonical(row[participantCol]) || getParticipantCanonical(row.find(isParticipantName));
    if (!participante) return;
    const valores = {};
    periodCols.forEach(({ cell, col }) => {
      const n = toNumber(row[col]);
      if (n !== null) valores[cell] = n;
    });
    out.push({ participante, valores });
  });
  return out;
}

function isMatrixPeriod(value, mode) {
  const raw = cleanCell(value);
  if (!raw) return false;
  const norm = normalizeText(raw);
  if (mode === 'dia') return /^\d{1,2}\/\d{1,2}/.test(raw) || /^\d{1,2}-\d{1,2}/.test(raw);
  return norm.includes('rodada') || /^\d+[ªa]?\s*rod/.test(norm);
}

function parseCampeoes(rows) {
  if (!rows.length) return [];
  const out = [];

  // Caso simples: colunas Participante/Nome e Campeão/Palpite.
  let headerIdx = findHeaderRow(rows, ['participante', 'campe'], 1);
  if (headerIdx < 0) headerIdx = findHeaderRow(rows, ['nome', 'palpite'], 1);
  if (headerIdx >= 0) {
    const header = rows[headerIdx];
    const nameCol = findColumn(header, ['participante', 'nome', 'jogador']);
    const champCol = findColumn(header, ['campeão', 'campeao', 'palpite campeão', 'palpite campeao', 'palpite']);
    if (nameCol >= 0 && champCol >= 0) {
      rows.slice(headerIdx + 1).forEach((row) => {
        const nome = getParticipantCanonical(row[nameCol]);
        const palpite = cleanCell(row[champCol]);
        if (nome && palpite) out.push({ nome, palpite, origem: 'planilha' });
      });
    }
  }

  // Caso livre: nome e seleção na mesma linha.
  if (!out.length) {
    rows.forEach((row) => {
      const nomeCell = row.find(isParticipantName);
      const nome = getParticipantCanonical(nomeCell);
      if (!nome) return;
      const idx = row.indexOf(nomeCell);
      const possible = row.slice(idx + 1).find((c) => c && !/pontos?|cravadas?|corretos?/i.test(c) && !isParticipantName(c));
      if (possible) out.push({ nome, palpite: cleanCell(possible), origem: 'planilha' });
    });
  }

  const seen = new Set();
  return out.filter((item) => {
    const key = normalizeText(item.nome);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getLastFinishedGame(jogos) {
  const finished = jogos.filter((j) => j.status === 'finalizado');
  if (!finished.length) return null;
  return finished.sort((a, b) => a.num - b.num).at(-1);
}

function buildGroupStandings(jogos) {
  const byGroup = {};
  jogos.filter((j) => j.status === 'finalizado' && j.grupo).forEach((j) => {
    const group = String(j.grupo).replace(/^grupo\s+/i, '').trim();
    if (!group) return;
    if (!byGroup[group]) byGroup[group] = {};
    ensureTeam(byGroup[group], j.time1);
    ensureTeam(byGroup[group], j.time2);
    applyGame(byGroup[group][j.time1], j.gols1, j.gols2);
    applyGame(byGroup[group][j.time2], j.gols2, j.gols1);
  });

  return Object.fromEntries(Object.entries(byGroup).map(([grupo, teams]) => {
    const table = Object.values(teams).sort((a, b) =>
      b.pontos - a.pontos || b.saldo - a.saldo || b.gp - a.gp || a.time.localeCompare(b.time, 'pt-BR')
    );
    return [grupo, table];
  }));
}

function ensureTeam(group, name) {
  if (!group[name]) group[name] = { time: name, jogos: 0, vitorias: 0, empates: 0, derrotas: 0, gp: 0, gc: 0, saldo: 0, pontos: 0 };
}

function applyGame(team, gp, gc) {
  team.jogos += 1;
  team.gp += gp;
  team.gc += gc;
  team.saldo = team.gp - team.gc;
  if (gp > gc) { team.vitorias += 1; team.pontos += 3; }
  else if (gp === gc) { team.empates += 1; team.pontos += 1; }
  else team.derrotas += 1;
}

function buildStats({ ranking, jogos, palpitesPorJogo, desempenhoDia, desempenhoRodada }) {
  const finalizados = jogos.filter((j) => j.status === 'finalizado');
  const pendentes = jogos.filter((j) => j.status !== 'finalizado');
  const totalGols = finalizados.reduce((sum, j) => sum + (j.gols1 || 0) + (j.gols2 || 0), 0);
  const lider = ranking[0] || null;
  const perseguidor = ranking[1] || null;
  const ultimoJogo = getLastFinishedGame(jogos);
  const palpitesUltimo = ultimoJogo ? (palpitesPorJogo[String(ultimoJogo.num)] || []) : [];
  const maxUltimo = palpitesUltimo.reduce((max, p) => Math.max(max, p.pontos ?? -Infinity), -Infinity);
  const melhoresUltimo = Number.isFinite(maxUltimo) ? palpitesUltimo.filter((p) => p.pontos === maxUltimo).map((p) => p.participante) : [];

  const placares = groupBy(finalizados, (j) => `${j.gols1}x${j.gols2}`);
  const placarMaisComum = Object.entries(placares).sort((a, b) => b[1].length - a[1].length)[0];
  const jogoMaisGoleador = finalizados.slice().sort((a, b) => ((b.gols1 + b.gols2) - (a.gols1 + a.gols2)) || a.num - b.num)[0] || null;

  return {
    totalParticipantes: ranking.length || PARTICIPANTES.length,
    jogosDisputados: finalizados.length,
    jogosPendentes: pendentes.length,
    totalGols,
    mediaGolsPorJogo: finalizados.length ? Number((totalGols / finalizados.length).toFixed(2)) : null,
    liderAtual: lider ? lider.nome : null,
    perseguidor: perseguidor ? perseguidor.nome : null,
    maiorPontuacaoGeral: ranking.length ? Math.max(...ranking.map((r) => r.pontos)) : null,
    menorPontuacaoGeral: ranking.length ? Math.min(...ranking.map((r) => r.pontos)) : null,
    jogoMaisGoleador: jogoMaisGoleador ? `${jogoMaisGoleador.time1} ${jogoMaisGoleador.gols1}x${jogoMaisGoleador.gols2} ${jogoMaisGoleador.time2}` : null,
    placarMaisComum: placarMaisComum ? `${placarMaisComum[0]} (${placarMaisComum[1].length}x)` : null,
    participanteMaiorPontuacaoUltimoJogo: melhoresUltimo.length ? `${melhoresUltimo.join(', ')} (${maxUltimo} pts)` : null,
    melhorDiaDesempenho: bestMatrixPerformance(desempenhoDia),
    melhorRodadaDesempenho: bestMatrixPerformance(desempenhoRodada),
    maiorCravadas: bestRankingField(ranking, 'cravadas'),
    maiorCorretos: bestRankingField(ranking, 'corretos'),
    mediaPontosParticipante: ranking.length ? Number((ranking.reduce((s, r) => s + (r.pontos || 0), 0) / ranking.length).toFixed(2)) : null
  };
}

function bestRankingField(ranking, field) {
  if (!ranking.length) return null;
  const max = Math.max(...ranking.map((r) => r[field] || 0));
  const names = ranking.filter((r) => (r[field] || 0) === max).map((r) => r.nome);
  return `${names.join(', ')} (${max})`;
}

function bestMatrixPerformance(matrix) {
  let best = null;
  matrix.forEach((row) => {
    Object.entries(row.valores || {}).forEach(([periodo, valor]) => {
      if (typeof valor !== 'number') return;
      if (!best || valor > best.valor) best = { participante: row.participante, periodo, valor };
    });
  });
  return best ? `${best.participante} — ${best.periodo}: ${best.valor} pts` : null;
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteUrl(url, base) {
  try { return new URL(url, base).href; }
  catch { return ''; }
}

async function fetchNews(url, limit = 8) {
  try {
    const html = await fetchText(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`, 7000);
    const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    const seen = new Set();
    const news = [];
    for (const match of anchors) {
      const href = absoluteUrl(match[1], url);
      const text = decodeHtml(match[2].replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' '));
      if (!href || !text || text.length < 18 || text.length > 180) continue;
      if (!/ge\.globo\.com|globoesporte\.globo\.com/.test(href)) continue;
      const key = normalizeText(text);
      if (seen.has(key)) continue;
      seen.add(key);
      news.push({ titulo: text, resumo: '', link: href, fonte: 'ge' });
      if (news.length >= limit) break;
    }
    return news;
  } catch (_) {
    return [];
  }
}

async function loadSecondaryNews(debug) {
  const [noticias, noticiasBrasil, noticiasNeymar] = await Promise.all([
    fetchNews(NEWS_SOURCES.copa, 8),
    fetchNews(NEWS_SOURCES.brasil, 4),
    fetchNews(NEWS_SOURCES.neymar, 4)
  ]);
  debug.noticias = { copa: noticias.length, brasil: noticiasBrasil.length, neymar: noticiasNeymar.length };
  return { noticias, noticiasBrasil, noticiasNeymar };
}

async function buildPayload() {
  const debug = {
    appVersion: APP_VERSION,
    origem: 'Google Sheets gviz CSV',
    rankingLinhas: 0,
    jogosLinhas: 0,
    palpitesLinhas: 0,
    desempenhoDiaLinhas: 0,
    desempenhoRodadaLinhas: 0,
    campeoesLinhas: 0,
    registros: {},
    erros: [],
    sheets: Object.fromEntries(Object.entries(SHEETS).map(([key, cfg]) => [key, { label: cfg.label, sheet: cfg.sheet, gid: cfg.gid || null }]))
  };

  const raw = {};
  const keys = Object.keys(SHEETS);
  const results = await Promise.allSettled(keys.map(async (key) => [key, await fetchSheetRows(key)]));
  results.forEach((result, idx) => {
    const key = keys[idx];
    if (result.status === 'fulfilled') {
      raw[key] = result.value[1].rows;
      debug[`${key}Linhas`] = raw[key].length;
      debug.sheets[key].url = result.value[1].url.replace(/&_=[0-9]+$/, '&_={timestamp}');
    } else {
      raw[key] = [];
      debug.erros.push({ aba: SHEETS[key].label, erro: result.reason?.message || String(result.reason) });
    }
  });

  let ranking = [], jogos = [], palpites = [], palpitesPorJogo = {}, desempenhoDia = [], desempenhoRodada = [], campeoes = [];

  try { ranking = parseRanking(raw.ranking); }
  catch (err) { debug.erros.push({ aba: 'Classificação', erro: err.message }); }
  try { jogos = parseJogos(raw.jogos); }
  catch (err) { debug.erros.push({ aba: 'Jogos', erro: err.message }); }
  try {
    const p = parsePalpites(raw.palpites);
    palpites = p.palpites;
    palpitesPorJogo = p.palpitesPorJogo;
    debug.palpitesParser = p.debug;
  } catch (err) { debug.erros.push({ aba: 'Palpites', erro: err.message }); }
  try { desempenhoDia = parseMatrix(raw.desempenhoDia, 'dia'); }
  catch (err) { debug.erros.push({ aba: 'Desempenho por dia', erro: err.message }); }
  try { desempenhoRodada = parseMatrix(raw.desempenhoRodada, 'rodada'); }
  catch (err) { debug.erros.push({ aba: 'Desempenho por rodada', erro: err.message }); }
  try { campeoes = parseCampeoes(raw.campeoes); }
  catch (err) { debug.erros.push({ aba: 'Palpites de campeão', erro: err.message }); }
  if (!campeoes.length) {
    campeoes = FALLBACK_CAMPEOES;
    debug.erros.push({ aba: 'Palpites de campeão', erro: 'Usando fallback local porque a aba não trouxe campeões.' });
  }

  debug.registros = {
    ranking: ranking.length,
    jogos: jogos.length,
    palpites: palpites.length,
    palpitesComPontos: palpites.filter((p) => p.pontos !== null).length,
    desempenhoDia: desempenhoDia.length,
    desempenhoRodada: desempenhoRodada.length,
    campeoes: campeoes.length
  };

  const ultimoJogo = getLastFinishedGame(jogos);
  const grupos = buildGroupStandings(jogos);
  const estatisticas = buildStats({ ranking, jogos, palpitesPorJogo, desempenhoDia, desempenhoRodada });
  const secondary = await loadSecondaryNews(debug);

  return {
    ok: true,
    appVersion: APP_VERSION,
    atualizadoEm: new Date().toISOString(),
    debug,
    ranking,
    jogos,
    palpites,
    palpitesPorJogo,
    desempenhoDia,
    desempenhoRodada,
    campeoes,
    ultimoJogo,
    estatisticas,
    grupos,
    ...secondary,
    centralNey: {
      imagem: 'https://topobolo.com/wp-content/uploads/2026/05/neymar-na-copa-de-2026-desenho-scaled.png',
      link: NEWS_SOURCES.neymar
    }
  };
}

async function handler(req, res) {
  setJsonHeaders(res);
  if (req.method && !['GET', 'HEAD'].includes(req.method)) {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, erro: 'Método não permitido.' }));
    return;
  }

  try {
    const payload = await buildPayload();
    res.statusCode = 200;
    res.end(JSON.stringify(payload));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({
      ok: false,
      atualizadoEm: new Date().toISOString(),
      erro: err.message || 'Erro inesperado na API.',
      debug: { appVersion: APP_VERSION }
    }));
  }
}

module.exports = handler;
module.exports._test = {
  parseCSV,
  normalizeText,
  toNumber,
  findHeaderRow,
  isParticipantName,
  parseRanking,
  parseJogos,
  parsePalpites,
  parseMatrix,
  parseCampeoes,
  buildStats,
  buildGroupStandings
};

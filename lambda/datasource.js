'use strict';

/**
 * datasource.js
 * ----------------------------------------------------------------------------
 * Busca e normaliza os dados do site do Tio Leo (https://tioleobpt.com.br).
 *
 *  - Times boss por servidor  -> js/script3.js (objeto `fallbackServers`)
 *      O site ATUALIZA ESSE ARQUIVO TODO DIA. Fazemos o parse em runtime.
 *  - Horarios dos bosses      -> api/bosses.php (exige header X-Requested-With)
 *
 * Cache em memoria (Lambda quente) de 30 minutos. Se a rede falhar, mantem
 * o ultimo dado bom; se nunca tiver buscado, usa o snapshot do schedule.js.
 * ----------------------------------------------------------------------------
 */

const https = require('https');

/**
 * Snapshot local (schedule.js). O import e defensivo de proposito: no
 * Alexa-hosted o codigo e colado A MAO na aba Code do Console e um arquivo
 * vazio derruba o Lambda inteiro ("Tive um problema para acessar os dados...").
 * Se isso acontecer, registramos no CloudWatch e seguimos de pe.
 */
let schedule = {};
try {
  schedule = require('./schedule');
} catch (e) {
  console.error('[datasource] schedule.js nao carregou:', (e && e.message) || e);
}
const FALLBACK_SERVERS = schedule.FALLBACK_SERVERS || {};
const SERVER_ORDER = schedule.SERVER_ORDER || [];
const FALLBACK_DATE = schedule.FALLBACK_DATE || null;

const SCRIPT3_URL = 'https://tioleobpt.com.br/js/script3.js';
const BOSSES_URL = 'https://tioleobpt.com.br/api/bosses.php';

const CACHE_TTL_MS = 30 * 60 * 1000;
const HTTP_TIMEOUT_MS = 4500;
const USER_AGENT = 'TimeBossAlexaSkill/1.0 (+https://tioleobpt.com.br)';

const cache = {
  at: 0,
  servers: null,
  bosses: null,
};

/** GET simples com timeout usando apenas o modulo https nativo. */
function httpGet(url, extraHeaders) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const req = https.get(
      url,
      { headers: Object.assign({ 'User-Agent': USER_AGENT, Accept: '*/*' }, extraHeaders || {}) },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (settled) return;
          settled = true;
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(body);
          else reject(new Error('HTTP ' + res.statusCode + ' em ' + url));
        });
      }
    );
    req.setTimeout(HTTP_TIMEOUT_MS, () => {
      if (settled) return;
      settled = true;
      req.destroy(new Error('timeout em ' + url));
    });
    req.on('error', (e) => {
      if (settled) return;
      settled = true;
      reject(e);
    });
  });
}

/**
 * Extrai o primeiro objeto JSON balanceado que aparece depois de `marker`.
 * Ex.: marker = "fallbackServers" acha "{ ... }" e devolve o texto.
 */
function extractObjectAfter(text, marker) {
  const at = text.indexOf(marker);
  if (at < 0) return null;
  const start = text.indexOf('{', at);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let quote = '';
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Garante o formato { Servidor: { Time: "MM" } } e valida os minutos. */
function normalizeServers(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  let count = 0;
  for (const server of Object.keys(raw)) {
    const teams = raw[server];
    if (!teams || typeof teams !== 'object' || Array.isArray(teams)) continue;
    out[server] = {};
    for (const team of Object.keys(teams)) {
      const minute = parseInt(teams[team], 10);
      if (Number.isNaN(minute) || minute < 0 || minute > 59) continue;
      out[server][team] = String(minute);
      count++;
    }
  }
  return count > 0 ? out : null;
}

/** Descobre o objeto de servidores dentro do script3.js. */
function extractServersFromScript(scriptText) {
  const markers = [
    'fallbackServers',
    'TIOLEO_DATA.servers',
    'TIOLEO_DATA["servers"]',
    '"servers"',
  ];
  for (const marker of markers) {
    const raw = extractObjectAfter(scriptText, marker);
    if (!raw) continue;
    try {
      const normalized = normalizeServers(JSON.parse(raw));
      if (normalized) return normalized;
    } catch (e) {
      /* tenta o proximo marker */
    }
  }
  return null;
}

/**
 * Retorna a tabela de times por servidor.
 * Ordem de tentativa: cache fresco -> script3.js -> ultimo cache -> snapshot.
 */
async function getServers() {
  const result = await fetchServers();
  console.log(
    '[datasource] fonte=' + result.source + ' servidores=' + Object.keys(result.servers || {}).join(', ')
  );
  return result;
}

async function fetchServers() {
  const now = Date.now();
  if (cache.servers && now - cache.at < CACHE_TTL_MS) {
    return { servers: cache.servers, source: 'cache', updatedAt: cache.at };
  }
  try {
    const script = await httpGet(SCRIPT3_URL);
    const servers = extractServersFromScript(script);
    if (servers) {
      cache.servers = servers;
      cache.at = now;
      return { servers, source: 'remoto', updatedAt: now };
    }
  } catch (e) {
    /* cai para o fallback abaixo */
  }
  if (cache.servers) {
    return { servers: cache.servers, source: 'cache', updatedAt: cache.at };
  }
  return { servers: FALLBACK_SERVERS, source: 'fallback', fallbackDate: FALLBACK_DATE };
}

/** Horarios completos dos bosses (api/bosses.php). Pode ser null se falhar. */
async function getBosses() {
  const now = Date.now();
  if (cache.bosses && now - cache.at < CACHE_TTL_MS) return cache.bosses;
  try {
    const body = await httpGet(BOSSES_URL, { 'X-Requested-With': 'XMLHttpRequest' });
    const json = JSON.parse(body);
    if (json && Array.isArray(json.bosses)) {
      cache.bosses = json;
      return json;
    }
  } catch (e) {
    /* sem bosses online: recurso extra fica indisponivel */
  }
  return cache.bosses;
}

function normalizeToken(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Resolve o nome do servidor ignorando caixa/acentos (ex.: "awell" -> "Awell"). */
function resolveServer(servers, value) {
  if (!value || !servers) return null;
  const target = normalizeToken(value);
  for (const name of Object.keys(servers)) {
    if (normalizeToken(name) === target) return name;
  }
  return null;
}

/** Resolve o nome do time dentro de um servidor (ignora caixa/acentos). */
function resolveTeam(teamMap, value) {
  if (!value || !teamMap) return null;
  const target = normalizeToken(value);
  for (const name of Object.keys(teamMap)) {
    if (normalizeToken(name) === target) return name;
  }
  return null;
}

/** Lista [{time, minute}] ordenada por minuto crescente (desempate alfabetico). */
function sortedTeams(teamMap) {
  // Sort estavel: empate de minuto mantem a ordem original do site
  // (ex.: Awell -> Gama 17 antes de Delta 17, igual a pagina).
  return Object.entries(teamMap || {})
    .map(([time, minute]) => ({ time, minute: parseInt(minute, 10) }))
    .sort((a, b) => a.minute - b.minute);
}

/** Ordena os nomes de servidores conforme a ordem oficial do site. */
function orderedServers(servers) {
  const names = Object.keys(servers || {});
  const ordered = SERVER_ORDER.filter((s) => names.includes(s));
  const extra = names.filter((s) => !SERVER_ORDER.includes(s)).sort();
  return ordered.concat(extra);
}

module.exports = {
  getServers,
  getBosses,
  resolveServer,
  resolveTeam,
  sortedTeams,
  orderedServers,
  normalizeServers,
  extractServersFromScript,
  SCRIPT3_URL,
  BOSSES_URL,
};

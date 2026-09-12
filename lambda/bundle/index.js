'use strict';

/**
 * Time Boss Tio Leo - Lambda em ARQUIVO UNICO (skill Alexa-hosted).
 * GERADO POR tools/bundle-hosted.js - nao edite aqui: edite os arquivos soltos
 * da pasta lambda\ e rode "node tools\bundle-hosted.js".
 *
 * Cole TODO o conteudo deste arquivo em index.js na aba Code do Console e
 * clique em Deploy. Nao precisa criar datasource.js, reminders.js, timeutil.js
 * nem schedule.js.
 */

const __registro = {};

/** require do mini-modulo: "./x" sai do registro; "https"/"ask-sdk-core" vai para o Node. */
function __req(nome) {
  if (nome.charAt(0) !== '.') return require(nome);
  const mod = __registro[nome];
  if (!mod) throw new Error("Cannot find module '" + nome + "'");
  if (!mod.carregado) {
    mod.carregado = true;
    mod.fn(mod, mod.exports, __req);
  }
  return mod.exports;
}

function __def(nome, fn) {
  __registro[nome] = { fn: fn, exports: {}, carregado: false };
}
/* ===== timeutil.js ===== */
__def('./timeutil', function (module, exports, require) {
'use strict';

/**
 * timeutil.js
 * ----------------------------------------------------------------------------
 * Utilitarios de data/hora no fuso do usuario (device timezone do Alexa).
 * Nao usa dependencias externas; usa Intl do proprio Node.
 * ----------------------------------------------------------------------------
 */

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

function pad(n, len) {
  return String(n).padStart(len || 2, '0');
}

/** Retorna as partes de data/hora "de parede" no fuso informado. */
function tzParts(timeZone, date) {
  const tz = timeZone || DEFAULT_TIMEZONE;
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const p = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  // Alguns ambientes retornam "24" para meia-noite.
  if (p.hour === '24') p.hour = '00';
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

/** Offset do fuso no formato "+HH:MM" / "-HH:MM". */
function tzOffset(timeZone, date) {
  const tz = timeZone || DEFAULT_TIMEZONE;
  try {
    const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
    const name = dtf.formatToParts(date).find((p) => p.type === 'timeZoneName');
    if (name) {
      const m = /GMT([+-]\d{2}:\d{2})/.exec(name.value);
      if (m) return m[1];
      if (name.value === 'GMT' || name.value === 'UTC') return '+00:00';
    }
  } catch (e) {
    /* ignora e cai no fallback */
  }
  return '+00:00';
}

/** requestTime do Reminders API: ISO 8601 com offset, ex. 2026-09-12T14:05:00-03:00 */
function reminderRequestTime(timeZone, date) {
  const d = date || new Date();
  const p = tzParts(timeZone, d);
  return (
    p.year + '-' + pad(p.month) + '-' + pad(p.day) +
    'T' + pad(p.hour) + ':' + pad(p.minute) + ':' + pad(p.second) +
    tzOffset(timeZone, d)
  );
}

/**
 * Proxima ocorrencia (datetime local, sem offset) para um dado minuto/hora.
 * Formata como "YYYY-MM-DDTHH:mm:00" (formato aceito pelo Reminders API).
 * Se o horario de hoje ja passou, agenda para o dia seguinte (a recorrencia
 * diaria continua valendo para os dias seguintes).
 */
function nextScheduledTime(hour, minute, timeZone, date) {
  const d = date || new Date();
  const p = tzParts(timeZone, d);
  const min = Number(minute);

  // Compara em "tempo de parede" usando aritmetica UTC (estavel p/ DST).
  const nowWall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  let targetWall = Date.UTC(p.year, p.month - 1, p.day, hour, min, 0);
  if (targetWall <= nowWall) targetWall += 24 * 3600 * 1000;

  const t = new Date(targetWall);
  return (
    t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()) +
    'T' + pad(t.getUTCHours()) + ':' + pad(t.getUTCMinutes()) + ':00'
  );
}

/**
 * Quantos minutos (e segundos) faltam para o proximo minuto-alvo "de parede".
 * O boss nasce a cada hora no minuto informado, entao consideramos sempre a
 * proxima ocorrencia dentro das proximas 60 minutos.
 */
function minutesUntil(targetMinute, timeZone, date) {
  const d = date || new Date();
  const p = tzParts(timeZone, d);
  // Compara dentro da hora (o boss nasce a cada hora no minuto alvo).
  const nowSec = p.minute * 60 + p.second;
  let diff = Number(targetMinute) * 60 - nowSec;
  if (diff <= 0) diff += 3600;
  return { minutes: Math.floor(diff / 60), seconds: diff % 60 };
}

/**
 * Proxima hora (cheia) da lista `hours` a partir de agora.
 * Usado em "proximos bosses" (horarios em hora cheia).
 */
function nextHourOccurrence(hours, timeZone, date) {
  const d = date || new Date();
  const p = tzParts(timeZone, d);
  const nowSec = p.hour * 3600 + p.minute * 60 + p.second;
  let best = null;
  for (const h of hours) {
    const hr = Number(h);
    let diff = hr * 3600 - nowSec;
    if (diff <= 0) diff += 24 * 3600;
    if (best === null || diff < best.diffSec) best = { hour: hr, diffSec: diff };
  }
  if (!best) return null;
  return {
    hour: best.hour,
    minutes: Math.floor(best.diffSec / 60),
    label: pad(best.hour) + ':00',
  };
}

/** Agora (wall clock) no fuso informado: {hour, minute}. */
function localNow(timeZone, date) {
  const p = tzParts(timeZone, date || new Date());
  return { hour: p.hour, minute: p.minute };
}

module.exports = {
  DEFAULT_TIMEZONE,
  pad,
  tzParts,
  tzOffset,
  reminderRequestTime,
  nextScheduledTime,
  minutesUntil,
  nextHourOccurrence,
  localNow,
};
});

/* ===== schedule.js ===== */
__def('./schedule', function (module, exports, require) {
'use strict';

/**
 * schedule.js
 * ----------------------------------------------------------------------------
 * Snapshot (fallback) da tabela "Time Boss" do TioLeoBPT.
 *
 * FONTE DE VERDADE (atualizada todo dia pelo Tio Leo):
 *   https://tioleobpt.com.br/js/script3.js  ->  objeto `fallbackServers`
 *
 * O site republica esse arquivo diariamente com novos minutos. O
 * `datasource.js` baixa esse arquivo e, se falhar, usa este snapshot.
 *
 * Snapshot capturado em: 2026-09-12 (script3.js?v=1789195036)
 * Estrutura: { Servidor: { Time: "minuto" } }
 * ----------------------------------------------------------------------------
 */

const FALLBACK_SERVERS = {
  Awell: { Gama: '17', Beta: '36', Alfa: '29', Delta: '17', Omega: '02', Zeta: '35' },
  Migal: { Gama: '40', Beta: '31', Alfa: '20', Delta: '17', Omega: '02', Zeta: '35' },
  Midranda: { Gama: '19', Beta: '28', Alfa: '44', Delta: '14', Omega: '02', Zeta: '35' },
  Cronus: { Gama: '15', Beta: '36', Alfa: '33', Delta: '05' },
  Idhas: { Gama: '11', Beta: '20', Alfa: '11' },
};

/** Ordem oficial dos servidores exibida no site. */
const SERVER_ORDER = ['Awell', 'Migal', 'Midranda', 'Cronus', 'Idhas'];

/** Ordem oficial dos times (usada apenas para desempate/estabilidade). */
const TEAM_ORDER = ['Omega', 'Gama', 'Delta', 'Alfa', 'Zeta', 'Beta'];

/** Data do snapshot acima (usada na mensagem de fallback). */
const FALLBACK_DATE = '2026-09-12';

module.exports = {
  FALLBACK_SERVERS,
  SERVER_ORDER,
  TEAM_ORDER,
  FALLBACK_DATE,
};
});

/* ===== datasource.js ===== */
__def('./datasource', function (module, exports, require) {
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
});

/* ===== reminders.js ===== */
__def('./reminders', function (module, exports, require) {
'use strict';

/**
 * reminders.js
 * ----------------------------------------------------------------------------
 * Cliente da Alexa Skill Reminders REST API (sem dependencias externas).
 *
 *   POST   {apiEndpoint}/v1/alerts/reminders          -> cria
 *   GET    {apiEndpoint}/v1/alerts/reminders          -> lista
 *   GET    {apiEndpoint}/v1/alerts/reminders/{token}  -> detalhe
 *   PUT    {apiEndpoint}/v1/alerts/reminders/{token}  -> atualiza
 *   DELETE {apiEndpoint}/v1/alerts/reminders/{token}  -> remove
 *
 * IMPORTANTE: a Alexa NAO aceita recorrencia por hora (so DAILY/WEEKLY/
 * MONTHLY/YEARLY). Por isso, "toda hora no minuto XX" = 24 lembretes
 * diarios, um para cada hora do dia.
 * ----------------------------------------------------------------------------
 */

const https = require('https');
const { reminderRequestTime, nextScheduledTime } = require('./timeutil');

const REMINDERS_PATH = '/v1/alerts/reminders';
const LOCALE = 'pt-BR';
const MARKER_PREFIX = 'TimeBoss';

/** Marcador deterministico guardado no texto, usado para achar nossos lembretes. */
function markerFor(time, servidor) {
  return MARKER_PREFIX + '|' + servidor + '|' + time;
}

/** Extrai {time, servidor} de um texto que contenha o marcador. */
function parseMarker(text) {
  if (!text) return null;
  // Formato: "TimeBoss|Servidor|Time - ..." (servidor/time nao tem espacos)
  const m = /TimeBoss\|([^|\s]+)\|([^|\s]+)/.exec(text);
  if (!m) return null;
  return { servidor: m[1], time: m[2] };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Texto falado/exibido do lembrete. */
function reminderTexts(time, servidor, minute) {
  const marker = markerFor(time, servidor);
  return {
    marker,
    text:
      marker + ' - É hora do time ' + time + ' no servidor ' + servidor +
      ' (minuto ' + pad2(minute) + ' de cada hora).',
    ssml:
      '<speak>Time boss! É hora do time <emphasis level="strong">' + time +
      '</emphasis> no servidor <emphasis level="strong">' + servidor +
      '</emphasis>.</speak>',
  };
}

/** Monta um ReminderRequest para uma hora especifica do dia. */
function buildReminderRequest(opts) {
  const { hour, minute, time, servidor, timeZone, now, useRrule } = opts;
  const { marker, text, ssml } = reminderTexts(time, servidor, minute);

  const trigger = {
    type: 'SCHEDULED',
    scheduledTime: nextScheduledTime(hour, minute, timeZone, now),
  };
  if (useRrule !== false) trigger.recurrence = { rrule: 'FREQ=DAILY' };
  else trigger.recurrence = { freq: 'DAILY' };

  return {
    marker,
    request: {
      requestTime: reminderRequestTime(timeZone, now),
      trigger,
      alertInfo: { spokenInfo: { content: [{ locale: LOCALE, text, ssml }] } },
      pushNotification: { status: 'DISABLED' },
    },
  };
}

/**
 * Gera 24 ReminderRequests (00:00..23:00 no minuto informado) para um time.
 */
function buildTeamReminders(opts) {
  const list = [];
  for (let hour = 0; hour < 24; hour++) {
    list.push(buildReminderRequest(Object.assign({ hour }, opts)));
  }
  return list;
}

/** Executa fn(item) com concorrencia limitada (default 8) preservando a ordem. */
async function runLimited(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  const size = Math.max(1, Math.min(limit || 8, items.length || 1));
  const workers = new Array(size).fill(0).map(async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      try {
        results[i] = { ok: true, value: await fn(items[i], i) };
      } catch (e) {
        results[i] = { ok: false, error: e };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

/** Chamada REST crua a API da Alexa (usa o apiAccessToken da sessao). */
function restRequest(method, apiEndpoint, token, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const url = new URL((apiEndpoint || 'https://api.amazonalexa.com') + path);
    const headers = {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      'User-Agent': 'TimeBossAlexaSkill/1.0',
    };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    let settled = false;
    const req = https.request(
      { hostname: url.hostname, path: url.pathname + url.search, method, headers },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (settled) return;
          settled = true;
          let json = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch (e) {
            /* resposta sem corpo JSON */
          }
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(json || {});
          else {
            const code = (json && (json.code || json.message)) || 'HTTP ' + res.statusCode;
            reject(new Error(String(code)));
          }
        });
      }
    );
    req.setTimeout(6000, () => {
      if (settled) return;
      settled = true;
      req.destroy(new Error('timeout na Reminders API'));
    });
    req.on('error', (e) => {
      if (settled) return;
      settled = true;
      reject(e);
    });
    if (payload) req.write(payload);
    req.end();
  });
}

/** Lista todos os lembretes criados por esta skill para este usuario. */
async function listReminders(ctx) {
  const res = await restRequest('GET', ctx.apiEndpoint, ctx.token, REMINDERS_PATH);
  return (res && res.alerts) || [];
}

async function deleteReminder(ctx, alertToken) {
  return restRequest('DELETE', ctx.apiEndpoint, ctx.token, REMINDERS_PATH + '/' + alertToken);
}

/**
 * Cria um lembrete. Tenta primeiro a recorrencia nova (rrule) e, se a API
 * rejeitar a recorrencia, cai para o formato antigo (freq).
 */
async function createReminder(ctx, built) {
  try {
    return await restRequest('POST', ctx.apiEndpoint, ctx.token, REMINDERS_PATH, built.request);
  } catch (e) {
    const msg = String(e.message || e);
    if (/RECURRENCE/i.test(msg)) {
      const fallback = {
        requestTime: built.request.requestTime,
        trigger: Object.assign({}, built.request.trigger, { recurrence: { freq: 'DAILY' } }),
        alertInfo: built.request.alertInfo,
        pushNotification: built.request.pushNotification,
      };
      return restRequest('POST', ctx.apiEndpoint, ctx.token, REMINDERS_PATH, fallback);
    }
    throw e;
  }
}

/** Encontra os lembretes pertencentes a um (time, servidor). */
function filterByTeam(alerts, time, servidor) {
  const marker = markerFor(time, servidor);
  return alerts.filter((a) => {
    const content = a && a.alertInfo && a.alertInfo.spokenInfo && a.alertInfo.spokenInfo.content;
    if (!Array.isArray(content)) return false;
    return content.some((c) => (c.text || '').includes(marker));
  });
}

/**
 * Sincroniza (recria) os 24 lembretes diarios de um time/servidor.
 * Remove os antigos daquele time antes de criar os novos.
 */
async function syncTeam(opts) {
  const ctx = { apiEndpoint: opts.apiEndpoint, token: opts.token };
  const built = buildTeamReminders({
    minute: opts.minute,
    time: opts.time,
    servidor: opts.servidor,
    timeZone: opts.timeZone,
    now: opts.now,
  });

  let removed = 0;
  try {
    const alerts = await listReminders(ctx);
    const old = filterByTeam(alerts, opts.time, opts.servidor);
    const delRes = await runLimited(old, 6, (a) => deleteReminder(ctx, a.alertToken));
    removed = delRes.filter((r) => r.ok).length;
  } catch (e) {
    /* se nao conseguir listar/remover, seguimos criando os novos */
  }

  const createRes = await runLimited(built, 8, (b) => createReminder(ctx, b));
  const created = createRes.filter((r) => r.ok).length;
  const errors = createRes
    .filter((r) => !r.ok)
    .map((r) => String((r.error && r.error.message) || r.error));

  return { created, removed, total: built.length, errors: errors.slice(0, 3) };
}

/** Remove todos os lembretes de time boss (de um servidor ou todos). */
async function removeTeam(opts) {
  const ctx = { apiEndpoint: opts.apiEndpoint, token: opts.token };
  const alerts = await listReminders(ctx);
  let target = alerts;
  if (opts.time && opts.servidor) {
    target = filterByTeam(alerts, opts.time, opts.servidor);
  } else if (opts.servidor) {
    target = alerts.filter((a) => {
      const c = a && a.alertInfo && a.alertInfo.spokenInfo && a.alertInfo.spokenInfo.content;
      return Array.isArray(c) && c.some((x) => (x.text || '').includes(MARKER_PREFIX + '|' + opts.servidor + '|'));
    });
  }
  const res = await runLimited(target, 6, (a) => deleteReminder(ctx, a.alertToken));
  return { removed: res.filter((r) => r.ok).length, total: target.length };
}

/** Resume os times que possuem lembretes ativos: [{servidor, time}] unicos. */
function summarizeTeams(alerts) {
  const seen = {};
  for (const a of alerts) {
    const c = a && a.alertInfo && a.alertInfo.spokenInfo && a.alertInfo.spokenInfo.content;
    if (!Array.isArray(c)) continue;
    for (const item of c) {
      const parsed = parseMarker(item.text);
      if (parsed) seen[parsed.servidor + '|' + parsed.time] = parsed;
    }
  }
  return Object.values(seen);
}

module.exports = {
  REMINDERS_PATH,
  LOCALE,
  MARKER_PREFIX,
  markerFor,
  parseMarker,
  reminderTexts,
  buildReminderRequest,
  buildTeamReminders,
  runLimited,
  listReminders,
  deleteReminder,
  createReminder,
  filterByTeam,
  syncTeam,
  removeTeam,
  summarizeTeams,
};
});

/* ===== index.js ===== */
__def('./index', function (module, exports, require) {
'use strict';

/**
 * index.js - Skill da Alexa "Time Boss Tio Leo"
 * ----------------------------------------------------------------------------
 * Duas funcionalidades:
 *   1) CONSULTA  - fala os times boss de cada servidor (dados do tioleobpt.com.br)
 *   2) LEMBRETES - cria lembretes no minuto de cada time (toda hora)
 *
 * Os times mudam TODO DIA, entao a skill le o script3.js do site a cada
 * chamada (com cache de 30 min) - ver datasource.js.
 * ----------------------------------------------------------------------------
 */

const Alexa = require('ask-sdk-core');
const ds = require('./datasource');
const R = require('./reminders');
const { DEFAULT_TIMEZONE, minutesUntil, nextHourOccurrence, pad } = require('./timeutil');

const SKILL_NAME = 'Time Boss Tio Leo';
const REMINDERS_SCOPE = 'alexa::alerts:reminders:skill:readwrite';

/* ============================ HELPERS ============================ */

function t(handlerInput, name) {
  const value = Alexa.getSlotValue(handlerInput.requestEnvelope, name);
  return value ? value.trim() : null;
}

function timeZoneOf(handlerInput) {
  const user = handlerInput.requestEnvelope.context.System.user || {};
  return user.timeZone || DEFAULT_TIMEZONE;
}

function ctxOf(handlerInput) {
  const system = handlerInput.requestEnvelope.context.System;
  return {
    token: system.apiAccessToken,
    apiEndpoint: system.apiEndpoint || 'https://api.amazonalexa.com',
  };
}

function joinPt(items) {
  if (!items || items.length === 0) return '';
  if (items.length === 1) return items[0];
  return items.slice(0, -1).join(', ') + ' e ' + items[items.length - 1];
}

function say(handlerInput, text, reprompt) {
  const builder = handlerInput.responseBuilder.speak(text).withSimpleCard(SKILL_NAME, text);
  if (reprompt) builder.reprompt(reprompt);
  return builder.getResponse();
}

function hasRemindersPermission(handlerInput) {
  const user = handlerInput.requestEnvelope.context.System.user || {};
  const scopes = (user.permissions && user.permissions.scopes) || {};
  return !!(scopes[REMINDERS_SCOPE] && scopes[REMINDERS_SCOPE].status === 'GRANTED');
}

function askForRemindersPermission(handlerInput, intro) {
  return handlerInput.responseBuilder
    .speak(
      (intro ? intro + ' ' : '') +
        'Para eu criar lembretes preciso da sua permissão. ' +
        'Enviei um cartão no aplicativo da Alexa: é só abrir e permitir o acesso a lembretes.'
    )
    .withAskForPermissionsConsentCard([REMINDERS_SCOPE])
    .getResponse();
}

/* ============================ LAUNCH ============================ */

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  async handle(handlerInput) {
    const { servers } = await ds.getServers();
    const lista = joinPt(ds.orderedServers(servers));
    if (!lista) {
      return say(
        handlerInput,
        'Bem-vindo ao ' + SKILL_NAME + '! Estou sem a tabela de times agora. Tente de novo em instantes.',
        'Tente de novo em instantes.'
      );
    }
    return say(
      handlerInput,
      'Bem-vindo ao ' + SKILL_NAME + '! ' +
        'Você pode dizer: times boss do Awell, ou me lembra do time Gama do Awell. ' +
        'Os servidores disponíveis são: ' + lista + '.',
      'Diga: times boss do Awell, ou me lembra do time Gama do Awell.'
    );
  },
};

/* ===================== CONSULTA: TIMES POR SERVIDOR ===================== */

const ConsultarTimesIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'ConsultarTimesIntent'
    );
  },
  async handle(handlerInput) {
    const { servers } = await ds.getServers();
    const disponiveis = joinPt(ds.orderedServers(servers));
    const valor = t(handlerInput, 'servidor');

    if (!valor) {
      return say(handlerInput, 'Times boss de qual servidor? Os disponíveis são: ' + disponiveis + '.', 'Qual servidor?');
    }
    const servidor = ds.resolveServer(servers, valor);
    if (!servidor) {
      return say(handlerInput, 'Não encontrei o servidor ' + valor + '. Os servidores disponíveis são: ' + disponiveis + '.');
    }

    const teams = ds.sortedTeams(servers[servidor]);
    if (!teams.length) {
      return say(handlerInput, 'Ainda não tenho os times do ' + servidor + ' hoje.');
    }
    const partes = teams.map((x) => x.time + ' no minuto ' + x.minute);
    return say(
      handlerInput,
      'No servidor ' + servidor + ', os times boss de hoje são: ' + joinPt(partes) +
        '. Isso se repete a cada hora.'
    );
  },
};

/* ===================== CONSULTA: HORARIO DE UM TIME ===================== */

const ConsultarTimeIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'ConsultarTimeIntent'
    );
  },
  async handle(handlerInput) {
    const { servers } = await ds.getServers();
    const valorTime = t(handlerInput, 'time');
    const valorServidor = t(handlerInput, 'servidor');
    const tz = timeZoneOf(handlerInput);

    if (!valorTime) {
      return say(handlerInput, 'Qual time você quer saber? Omega, Gama, Delta, Alfa, Zeta ou Beta.', 'Qual time?');
    }
    if (valorServidor && !ds.resolveServer(servers, valorServidor)) {
      return say(handlerInput, 'Não encontrei o servidor ' + valorServidor + '.');
    }

    if (valorServidor) {
      const servidor = ds.resolveServer(servers, valorServidor);
      const time = ds.resolveTeam(servers[servidor], valorTime);
      if (!time) {
        const hoje = joinPt(ds.sortedTeams(servers[servidor]).map((x) => x.time));
        return say(handlerInput, 'O time ' + valorTime + ' não está no servidor ' + servidor + ' hoje. Os times de hoje são: ' + hoje + '.');
      }
      const minuto = parseInt(servers[servidor][time], 10);
      const restante = minutesUntil(minuto, tz);
      return say(
        handlerInput,
        'O time ' + time + ' no servidor ' + servidor + ' é no minuto ' + minuto +
          ' de cada hora. Faltam ' + restante.minutes + ' minutos.'
      );
    }

    const linhas = ds
      .orderedServers(servers)
      .map((s) => {
        const time = ds.resolveTeam(servers[s], valorTime);
        return time ? s + ' no minuto ' + servers[s][time] : null;
      })
      .filter(Boolean);

    if (!linhas.length) {
      return say(handlerInput, 'Não encontrei o time ' + valorTime + ' em nenhum servidor hoje.');
    }
    return say(handlerInput, 'O time ' + valorTime + ' acontece assim hoje: ' + joinPt(linhas) + '.');
  },
};

/* ===================== LISTAR SERVIDORES ===================== */

const ListarServidoresIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'ListarServidoresIntent'
    );
  },
  async handle(handlerInput) {
    const { servers } = await ds.getServers();
    return say(
      handlerInput,
      'Os servidores disponíveis são: ' + joinPt(ds.orderedServers(servers)) + '. De qual você quer os times boss?',
      'Times boss de qual servidor?'
    );
  },
};

/* ===================== PROXIMOS BOSSES ===================== */

const ProximosBossesIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'ProximosBossesIntent'
    );
  },
  async handle(handlerInput) {
    const { servers } = await ds.getServers();
    const valor = t(handlerInput, 'servidor');
    const tz = timeZoneOf(handlerInput);

    if (!valor) {
      return say(handlerInput, 'Próximos bosses de qual servidor? Os disponíveis são: ' + joinPt(ds.orderedServers(servers)) + '.', 'Qual servidor?');
    }
    const servidor = ds.resolveServer(servers, valor);
    if (!servidor) {
      return say(handlerInput, 'Não encontrei o servidor ' + valor + '.');
    }

    const data = await ds.getBosses();
    if (!data || !data.bosses) {
      return say(handlerInput, 'Não consegui buscar os próximos bosses agora. Tente de novo em instantes.');
    }

    const proximos = [];
    for (const boss of data.bosses) {
      const listaServidores = Array.isArray(boss.servers) ? boss.servers : Object.keys(servers);
      if (!listaServidores.includes(servidor)) continue;
      if (!Array.isArray(boss.horarios) || !boss.horarios.length) continue;
      const occ = nextHourOccurrence(boss.horarios, tz);
      if (occ) proximos.push({ nome: boss.name, minutos: occ.minutes, hora: occ.label });
    }
    if (!proximos.length) {
      return say(handlerInput, 'Não encontrei bosses para o servidor ' + servidor + '.');
    }
    proximos.sort((a, b) => a.minutos - b.minutos);
    const partes = proximos.slice(0, 5).map((p) => p.nome + ' em ' + p.minutos + ' minutos (' + p.hora + ')');
    return say(handlerInput, 'Próximos bosses no ' + servidor + ': ' + joinPt(partes) + '.');
  },
};

/* ===================== LEMBRETES: CRIAR ===================== */

function resolveTeamForServer(servers, servidorValue, timeValue) {
  const servidor = ds.resolveServer(servers, servidorValue);
  if (!servidor) return { error: 'server' };
  const time = ds.resolveTeam(servers[servidor], timeValue);
  if (!time) return { error: 'team', servidor };
  return { servidor, time, minute: parseInt(servers[servidor][time], 10) };
}

const CriarLembreteIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'CriarLembreteIntent'
    );
  },
  async handle(handlerInput) {
    const valorTime = t(handlerInput, 'time');
    const valorServidor = t(handlerInput, 'servidor');

    if (!valorTime || !valorServidor) {
      return say(
        handlerInput,
        'Para criar o lembrete, me diga o time e o servidor. Por exemplo: me lembra do time Gama do Awell.',
        'Diga: me lembra do time Gama do Awell.'
      );
    }

    const { servers } = await ds.getServers();
    const found = resolveTeamForServer(servers, valorServidor, valorTime);

    if (found.error === 'server') {
      return say(handlerInput, 'Não encontrei o servidor ' + valorServidor + '. Os disponíveis são: ' + joinPt(ds.orderedServers(servers)) + '.');
    }
    if (found.error === 'team') {
      const hoje = joinPt(ds.sortedTeams(servers[found.servidor]).map((x) => x.time));
      return say(handlerInput, 'Hoje o time ' + valorTime + ' não está no servidor ' + found.servidor + '. Os times de hoje são: ' + hoje + '.');
    }

    if (!hasRemindersPermission(handlerInput)) {
      return askForRemindersPermission(
        handlerInput,
        'Hoje o time ' + found.time + ' no ' + found.servidor + ' é no minuto ' + found.minute + '.'
      );
    }

    const ctx = ctxOf(handlerInput);
    const res = await R.syncTeam({
      minute: found.minute,
      time: found.time,
      servidor: found.servidor,
      timeZone: timeZoneOf(handlerInput),
      now: new Date(),
      apiEndpoint: ctx.apiEndpoint,
      token: ctx.token,
    });

    let msg =
      'Pronto! Vou te avisar do time ' + found.time + ' no servidor ' + found.servidor +
      ' a cada hora, no minuto ' + pad(found.minute) + '.';
    if (res.created < res.total) {
      msg +=
        ' Consegui criar ' + res.created + ' de ' + res.total + ' lembretes' +
        (res.errors.length ? '. Erro: ' + res.errors[0] : '') + '.';
    } else {
      msg += ' Foram ' + res.created + ' lembretes criados.';
    }
    return say(handlerInput, msg);
  },
};

/* ===================== LEMBRETES: ATUALIZAR ===================== */

const AtualizarLembretesIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'AtualizarLembretesIntent'
    );
  },
  async handle(handlerInput) {
    if (!hasRemindersPermission(handlerInput)) {
      return askForRemindersPermission(handlerInput, 'Preciso da permissão para atualizar seus lembretes de time boss.');
    }
    const ctx = ctxOf(handlerInput);
    const alerts = await R.listReminders({ apiEndpoint: ctx.apiEndpoint, token: ctx.token });
    const teams = R.summarizeTeams(alerts);
    if (!teams.length) {
      return say(handlerInput, 'Você ainda não tem lembretes de time boss. Diga: me lembra do time Gama do Awell.');
    }

    const { servers } = await ds.getServers();
    const tz = timeZoneOf(handlerInput);
    const now = new Date();
    let atualizados = 0;
    const faltando = [];

    for (const item of teams) {
      const servidor = ds.resolveServer(servers, item.servidor);
      if (!servidor) {
        faltando.push(item.time + ' no ' + item.servidor);
        continue;
      }
      const time = ds.resolveTeam(servers[servidor], item.time);
      if (!time) {
        faltando.push(item.time + ' no ' + servidor);
        continue;
      }
      await R.syncTeam({
        minute: parseInt(servers[servidor][time], 10),
        time,
        servidor,
        timeZone: tz,
        now,
        apiEndpoint: ctx.apiEndpoint,
        token: ctx.token,
      });
      atualizados++;
    }

    let msg =
      atualizados > 0
        ? 'Atualizei os lembretes de ' + atualizados + ' time' + (atualizados > 1 ? 's' : '') + ' com os horários de hoje.'
        : 'Não consegui atualizar nenhum lembrete.';
    if (faltando.length) msg += ' Não encontrei hoje: ' + joinPt(faltando) + '.';
    return say(handlerInput, msg);
  },
};

/* ===================== LEMBRETES: LISTAR ===================== */

const ListarLembretesIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'ListarLembretesIntent'
    );
  },
  async handle(handlerInput) {
    if (!hasRemindersPermission(handlerInput)) {
      return askForRemindersPermission(handlerInput, 'Preciso da permissão para ver seus lembretes de time boss.');
    }
    const ctx = ctxOf(handlerInput);
    const alerts = await R.listReminders({ apiEndpoint: ctx.apiEndpoint, token: ctx.token });
    const teams = R.summarizeTeams(alerts);
    if (!teams.length) {
      return say(handlerInput, 'Você não tem lembretes de time boss ativos. Diga: me lembra do time Gama do Awell.');
    }
    const partes = teams.map((x) => 'time ' + x.time + ' no ' + x.servidor);
    return say(handlerInput, 'Você tem lembretes de time boss para: ' + joinPt(partes) + '.');
  },
};

/* ===================== LEMBRETES: REMOVER ===================== */

const RemoverLembreteIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'RemoverLembreteIntent'
    );
  },
  async handle(handlerInput) {
    if (!hasRemindersPermission(handlerInput)) {
      return askForRemindersPermission(handlerInput, 'Preciso da permissão para remover lembretes de time boss.');
    }
    const valorTime = t(handlerInput, 'time');
    const valorServidor = t(handlerInput, 'servidor');
    const { servers } = await ds.getServers();

    if (valorTime && !valorServidor) {
      return say(handlerInput, 'De qual servidor você quer remover o lembrete do time ' + valorTime + '?', 'Qual servidor?');
    }

    const ctx = ctxOf(handlerInput);
    const opts = { apiEndpoint: ctx.apiEndpoint, token: ctx.token };
    if (valorServidor) {
      opts.servidor = ds.resolveServer(servers, valorServidor) || valorServidor;
    }
    if (valorTime && opts.servidor) {
      opts.time = ds.resolveTeam(servers[opts.servidor] || {}, valorTime) || valorTime;
    }

    const res = await R.removeTeam(opts);
    if (!res.total) {
      return say(handlerInput, 'Não encontrei lembretes de time boss para remover.');
    }
    return say(handlerInput, 'Removi ' + res.removed + ' lembretes de time boss.');
  },
};

/* ===================== INTENTS PADRAO ===================== */

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent'
    );
  },
  async handle(handlerInput) {
    return say(
      handlerInput,
      'Eu mostro os times boss do Priston Tale Brasil e crio lembretes. ' +
        'Você pode dizer: times boss do Awell; que horas é o time Gama no Awell; ' +
        'me lembra do time Gama do Awell; ou atualiza os lembretes.',
      'O que você quer fazer?'
    );
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    const type = Alexa.getRequestType(handlerInput.requestEnvelope);
    if (type !== 'IntentRequest') return false;
    const name = Alexa.getIntentName(handlerInput.requestEnvelope);
    return name === 'AMAZON.CancelIntent' || name === 'AMAZON.StopIntent';
  },
  async handle(handlerInput) {
    return say(handlerInput, 'Até a próxima! Bons bosses.');
  },
};

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent'
    );
  },
  async handle(handlerInput) {
    return say(
      handlerInput,
      'Não entendi. Tente: times boss do Awell, ou me lembra do time Gama do Awell.',
      'Diga: times boss do Awell.'
    );
  },
};

const YesNoIntentHandler = {
  canHandle(handlerInput) {
    if (Alexa.getRequestType(handlerInput.requestEnvelope) !== 'IntentRequest') return false;
    const name = Alexa.getIntentName(handlerInput.requestEnvelope);
    return name === 'AMAZON.YesIntent' || name === 'AMAZON.NoIntent';
  },
  async handle(handlerInput) {
    return say(
      handlerInput,
      'Certo! Você pode dizer: times boss do Awell, ou me lembra do time Gama do Awell.',
      'Times boss de qual servidor?'
    );
  },
};

/** Resposta do fluxo de consentimento (permissão de lembretes). */
const ConnectionsResponseHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'Connections.Response';
  },
  async handle(handlerInput) {
    const status = handlerInput.requestEnvelope.request.status;
    const code = handlerInput.requestEnvelope.request.payload && handlerInput.requestEnvelope.request.payload.status;
    if (status && status.code === '200' && code === 'ACCEPTED') {
      return say(handlerInput, 'Permissão concedida! Agora diga: me lembra do time Gama do Awell.', 'Me lembra do time Gama do Awell.');
    }
    return say(handlerInput, 'Tudo bem. Se mudar de ideia, diga: me lembra do time Gama do Awell.');
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.getResponse();
  },
};

/**
 * Erros que significam "faltou colar um arquivo no editor do Console": o Node
 * carrega o arquivo vazio sem reclamar, mas a funcao chamada nao existe.
 */
const CODIGO_INCOMPLETO = /is not a function|Cannot find module|MODULE_NOT_FOUND/;

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    const tipo = Alexa.getRequestType(handlerInput.requestEnvelope) || 'desconhecido';
    const detalhe = String((error && error.message) || error || '');
    console.error('ERRO NA SKILL [' + tipo + ']:', error && (error.stack || error.message || error));

    if (CODIGO_INCOMPLETO.test(detalhe)) {
      return handlerInput.responseBuilder
        .speak(
          'O código não está completo na aba Code do console da Alexa. ' +
            'Confira os arquivos auxiliares e clique em Deploy.'
        )
        .withSimpleCard(
          SKILL_NAME + ' - código incompleto',
          'O Lambda não encontrou: ' + detalhe + '. ' +
            'Na aba Code, confira se estes arquivos existem e estão completos: ' +
            'datasource.js, reminders.js, timeutil.js e schedule.js. ' +
            'Cole o conteúdo deles e clique em Deploy.'
        )
        .getResponse();
    }

    return handlerInput.responseBuilder
      .speak('Tive um problema para acessar os dados do time boss. Tente de novo em instantes.')
      .getResponse();
  },
};

/* ===================== BOOTSTRAP DO LAMBDA ===================== */

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    ConsultarTimesIntentHandler,
    ConsultarTimeIntentHandler,
    ListarServidoresIntentHandler,
    ProximosBossesIntentHandler,
    CriarLembreteIntentHandler,
    AtualizarLembretesIntentHandler,
    ListarLembretesIntentHandler,
    RemoverLembreteIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    YesNoIntentHandler,
    FallbackIntentHandler,
    ConnectionsResponseHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withCustomUserAgent('timeboss-skill/v1.0')
  .lambda();
});

/* ===== handler exigido pelo Lambda ===== */
exports.handler = __req('./index').handler;

/* ===== FIM DO ARQUIVO: se esta linha nao aparece na aba Code, o Ctrl+V cortou ===== */

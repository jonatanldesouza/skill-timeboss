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

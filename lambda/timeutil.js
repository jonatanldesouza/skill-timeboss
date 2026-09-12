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

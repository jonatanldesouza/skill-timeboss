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

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error('ERRO NA SKILL:', error && (error.stack || error.message || error));
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

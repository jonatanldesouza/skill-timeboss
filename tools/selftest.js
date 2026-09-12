'use strict';

/**
 * selftest.js - valida a skill localmente, sem precisar da Alexa.
 *
 * Uso:
 *   node tools/selftest.js
 *
 * Checa:
 *   1. JSONs (skill.json / pt-BR.json)
 *   2. Parse do objeto fallbackServers do script3.js
 *   3. Leitura real de https://tioleobpt.com.br/js/script3.js (se houver rede)
 *   4. Funcoes de data/hora (fuso America/Sao_Paulo)
 *   5. Montagem dos 24 lembretes diarios
 *   6. Simulacao de requisicoes no Lambda (se ask-sdk-core estiver instalado)
 */

const path = require('path');
const fs = require('fs');

const LAMBDA = path.join(__dirname, '..', 'lambda');
const ds = require(path.join(LAMBDA, 'datasource'));
const timeutil = require(path.join(LAMBDA, 'timeutil'));
const R = require(path.join(LAMBDA, 'reminders'));

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
  if (cond) {
    pass++;
    console.log('  [OK]    ' + name);
  } else {
    fail++;
    console.log('  [FALHA] ' + name + (extra ? '  -> ' + extra : ''));
  }
}

function envelope(type, intentName, slots) {
  return {
    version: '1.0',
    session: { new: true, sessionId: 'sess', attributes: {}, user: { userId: 'user-1' } },
    context: {
      System: {
        apiAccessToken: 'fake-api-access-token',
        apiEndpoint: 'https://api.amazonalexa.com',
        device: { deviceId: 'dev', supportedInterfaces: {} },
        application: { applicationId: 'amzn1.ask.skill.teste' },
        user: { userId: 'user-1', timeZone: 'America/Sao_Paulo' }
      }
    },
    request:
      type === 'LaunchRequest'
        ? { type: 'LaunchRequest', requestId: 'r1', timestamp: new Date().toISOString(), locale: 'pt-BR' }
        : {
            type: 'IntentRequest',
            requestId: 'r1',
            timestamp: new Date().toISOString(),
            locale: 'pt-BR',
            intent: { name: intentName, confirmationStatus: 'NONE', slots: slots || {} },
          },
  };
}

function slotObj(map) {
  const out = {};
  Object.keys(map || {}).forEach((k) => {
    out[k] = { name: k, value: map[k], confirmationStatus: 'NONE' };
  });
  return out;
}

(async () => {
  console.log('== 1) JSONs ==');
  ['skill-package/skill.json', 'skill-package/interactionModels/custom/pt-BR.json'].forEach((rel) => {
    const file = path.join(__dirname, '..', rel);
    try {
      JSON.parse(fs.readFileSync(file, 'utf8'));
      ok('JSON valido: ' + rel, true);
    } catch (e) {
      ok('JSON valido: ' + rel, false, e.message);
    }
  });

  console.log('== 2) Parse do fallbackServers (amostra) ==');
  const amostra =
    'const fallbackServers = {\n  "Awell": {\n    "Gama": "17",\n    "Omega": "02"\n  },\n  "Idhas": { "Gama": "11" }\n};';
  const parsed = ds.extractServersFromScript(amostra);
  ok('extrai servidores da amostra', !!parsed && parsed.Awell.Gama === '17', JSON.stringify(parsed));

  console.log('== 3) Leitura real do site (tioleobpt.com.br) ==');
  const { servers, source } = await ds.getServers();
  console.log('  fonte dos dados: ' + source);
  const nomes = Object.keys(servers);
  ok('obteve servidores', nomes.length >= 3, nomes.join(', '));
  const awell = ds.resolveServer(servers, 'awell');
  ok('resolve "awell" -> nome canonico', !!awell, String(awell));
  if (awell) {
    const teams = ds.sortedTeams(servers[awell]);
    ok(
      'times do ' + awell + ' em ordem crescente de minuto',
      teams.every((x, i, a) => i === 0 || a[i - 1].minute <= x.minute),
      teams.map((x) => x.time + '=' + x.minute).join(', ')
    );
    console.log('  > ' + awell + ': ' + teams.map((x) => x.time + ' min ' + x.minute).join(', '));
  }
  ok('resolve "GAMA" (caixa alta)', !!ds.resolveTeam(servers[awell] || {}, 'GAMA'));

  console.log('== 4) Data/hora ==');
  const tz = 'America/Sao_Paulo';
  const st = timeutil.nextScheduledTime(17, 17, tz, new Date());
  ok('scheduledTime no formato aceito', /^\d{4}-\d{2}-\d{2}T17:17:00$/.test(st), st);
  const rt = timeutil.reminderRequestTime(tz, new Date());
  ok('requestTime com offset', /[+-]\d{2}:\d{2}$/.test(rt), rt);
  const until = timeutil.minutesUntil(17, tz, new Date());
  ok('minutesUntil entre 0 e 59', until.minutes >= 0 && until.minutes < 60, JSON.stringify(until));
  console.log('  > agora: ' + rt + ' | lembrete: ' + st + ' | faltam ' + until.minutes + ' min');

  console.log('== 5) Lembretes ==');
  const built = R.buildTeamReminders({ minute: 17, time: 'Gama', servidor: 'Awell', timeZone: tz, now: new Date() });
  ok('gera 24 lembretes', built.length === 24, String(built.length));
  ok(
    'cobre as horas 00..23 no minuto 17',
    built.every((b, i) => b.request.trigger.scheduledTime.slice(11, 16) === String(i).padStart(2, '0') + ':17')
  );
  ok('recorrencia diaria', built[0].request.trigger.recurrence.rrule === 'FREQ=DAILY');
  ok('locale pt-BR', built[0].request.alertInfo.spokenInfo.content[0].locale === 'pt-BR');
  ok('marcador reconhecivel', (R.parseMarker(built[0].request.alertInfo.spokenInfo.content[0].text) || {}).time === 'Gama');
  console.log('  > texto: ' + built[0].request.alertInfo.spokenInfo.content[0].text);

  console.log('== 6) Simulacao da skill (Lambda) ==');
  let handler = null;
  try {
    handler = require(path.join(LAMBDA, 'index')).handler;
  } catch (e) {
    console.log('  (ask-sdk-core ainda nao instalado - rode "npm install" dentro de lambda/)');
  }
  if (handler) {
    const invoke = (event) =>
      new Promise((resolve, reject) => {
        handler(event, {}, (err, result) => (err ? reject(err) : resolve(result)));
      });
    const fala = (res) => {
      const out = res && res.response && res.response.outputSpeech;
      if (out && out.text) return out.text;
      if (out && out.ssml) return out.ssml.replace(/<[^>]+>/g, '');
      return JSON.stringify(res);
    };

    let res = await invoke(envelope('LaunchRequest'));
    ok('LaunchRequest responde', /Bem-vindo/.test(fala(res)), fala(res));

    res = await invoke(envelope('IntentRequest', 'ConsultarTimesIntent', slotObj({ servidor: 'awell' })));
    ok('ConsultarTimesIntent fala o Awell', /Awell/.test(fala(res)) && /minuto/.test(fala(res)), fala(res));
    console.log('  > ' + fala(res));

    res = await invoke(envelope('IntentRequest', 'ConsultarTimeIntent', slotObj({ time: 'gama', servidor: 'awell' })));
    ok('ConsultarTimeIntent acha o minuto', /minuto/.test(fala(res)), fala(res));
    console.log('  > ' + fala(res));

    res = await invoke(envelope('IntentRequest', 'ListarServidoresIntent', slotObj({})));
    ok('ListarServidoresIntent lista servidores', /Idhas/.test(fala(res)), fala(res));

    res = await invoke(envelope('IntentRequest', 'CriarLembreteIntent', slotObj({ time: 'gama', servidor: 'awell' })));
    const card = res && res.card;
    ok(
      'CriarLembreteIntent pede permissao (sem consentimento)',
      (card && card.type === 'AskForPermissionsConsent') || /permiss/i.test(fala(res)),
      JSON.stringify(card || fala(res))
    );

    res = await invoke(envelope('IntentRequest', 'AMAZON.HelpIntent', slotObj({})));
    ok('HelpIntent responde', /times boss/i.test(fala(res)), fala(res));
  }

  console.log('== 7) Pre-publicacao (assets, manifest e modelo) ==');
  const rootDir = path.join(__dirname, '..');

  [['assets/icons/icon-108.png', 108], ['assets/icons/icon-512.png', 512]].forEach(([rel, size]) => {
    const file = path.join(rootDir, rel);
    try {
      const buf = fs.readFileSync(file);
      const isPng = buf.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      ok('icone ' + rel + ' (' + w + 'x' + h + ')', isPng && w === size && h === size);
    } catch (e) {
      ok('icone ' + rel, false, e.message);
    }
  });

  ['docs/privacy-policy.html', 'docs/terms-of-use.html'].forEach((rel) => {
    let tamanho = 0;
    try {
      tamanho = fs.statSync(path.join(rootDir, rel)).size;
    } catch (e) {
      /* arquivo ausente */
    }
    ok('pagina legal presente: ' + rel, tamanho > 500);
  });

  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'skill-package/skill.json'), 'utf8')).manifest;
  const model = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'skill-package/interactionModels/custom/pt-BR.json'), 'utf8')
  ).interactionModel.languageModel;
  const srcIndex = fs.readFileSync(path.join(LAMBDA, 'index.js'), 'utf8');

  const customs = model.intents.map((i) => i.name).filter((n) => n.indexOf('AMAZON.') !== 0);
  const semHandler = customs.filter((n) => srcIndex.indexOf("'" + n + "'") < 0);
  ok('todo intent do modelo tem handler no index.js', semHandler.length === 0, semHandler.join(', '));

  const tipos = model.types.map((x) => x.name);
  const usados = [];
  model.intents.forEach((i) => (i.slots || []).forEach((s) => usados.push(s.type)));
  const tiposFaltando = usados.filter((x) => tipos.indexOf(x) < 0);
  ok('todo slot usa um tipo declarado', tiposFaltando.length === 0, tiposFaltando.join(', '));

  ok(
    'manifest pede a permissao de lembretes',
    (manifest.permissions || []).map((p) => p.name).indexOf('alexa::alerts:reminders:skill:readwrite') >= 0
  );
  ok(
    'manifest tem o locale pt-BR',
    !!(manifest.publishingInformation.locales && manifest.publishingInformation.locales['pt-BR'])
  );

  const pol = manifest.privacyAndCompliance.locales['pt-BR'];
  const pendentes = [];
  if (/SEU-USUARIO|exemplo\.com/i.test(pol.privacyPolicyUrl)) pendentes.push('privacyPolicyUrl');
  if (/SEU-USUARIO|exemplo\.com/i.test(pol.termsOfUseUrl)) pendentes.push('termsOfUseUrl');
  if (pendentes.length) {
    console.log('  [AVISO] troque antes de publicar: ' + pendentes.join(', ') + ' (veja o README)');
  } else {
    ok('URLs de privacidade/termos preenchidas', true);
  }

  console.log('\n===== RESULTADO: ' + pass + ' ok, ' + fail + ' falha(s) =====');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('ERRO NO TESTE:', e);
  process.exit(1);
});

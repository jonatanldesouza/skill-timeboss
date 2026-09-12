'use strict';

/**
 * check-deploy.js - confere o que voce colou na aba "Code" do Console da Alexa.
 * ----------------------------------------------------------------------------
 * O Lambda da skill Alexa-hosted e alimentado a mao (copiar e colar no editor
 * do Console). Um arquivo que ficou vazio ou incompleto derruba a skill com
 * *"Tive um problema para acessar os dados do time boss"* - porque o Node
 * carrega o arquivo sem erro, mas a funcao que a skill chama nao existe.
 *
 * Uso:
 *   node tools\check-deploy.js
 *
 * Confere, para os arquivos da pasta lambda\:
 *   1. existe, nao esta vazio e o numero de linhas (para comparar com o Console)
 *   2. exporta tudo o que o index.js usa
 *   3. responde a invocacao "abrir time boss" (LaunchRequest)
 *   4. de onde vieram os dados (site, cache ou snapshot) e se o snapshot serve
 */

const path = require('path');
const fs = require('fs');

const LAMBDA = path.join(__dirname, '..', 'lambda');

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

/** Arquivos que precisam estar na aba Code + o que cada um precisa exportar. */
const ARQUIVOS = [
  { nome: 'index.js', usados: ['handler'] },
  {
    nome: 'datasource.js',
    usados: ['getServers', 'getBosses', 'resolveServer', 'resolveTeam', 'sortedTeams', 'orderedServers'],
  },
  { nome: 'reminders.js', usados: ['listReminders', 'createReminder', 'syncTeam', 'removeTeam', 'summarizeTeams'] },
  { nome: 'timeutil.js', usados: ['DEFAULT_TIMEZONE', 'pad', 'minutesUntil', 'nextHourOccurrence', 'nextScheduledTime'] },
  { nome: 'schedule.js', usados: ['FALLBACK_SERVERS', 'SERVER_ORDER', 'FALLBACK_DATE'] },
];

function ler(arquivo) {
  try {
    return fs.readFileSync(path.join(LAMBDA, arquivo), 'utf8');
  } catch (e) {
    return '';
  }
}

function carregar(arquivo) {
  try {
    return { mod: require(path.join(LAMBDA, arquivo)), erro: null };
  } catch (e) {
    return { mod: null, erro: (e && e.message) || String(e) };
  }
}

function envelopeLaunch() {
  return {
    version: '1.0',
    session: { new: true, sessionId: 'sess', attributes: {}, user: { userId: 'user-1' } },
    context: {
      System: {
        apiAccessToken: 'fake-api-access-token',
        apiEndpoint: 'https://api.amazonalexa.com',
        device: { deviceId: 'dev', supportedInterfaces: {} },
        application: { applicationId: 'amzn1.ask.skill.teste' },
        user: { userId: 'user-1', timeZone: 'America/Sao_Paulo' },
      },
    },
    request: { type: 'LaunchRequest', requestId: 'r1', timestamp: new Date().toISOString(), locale: 'pt-BR' },
  };
}

function fala(res) {
  const out = res && res.response && res.response.outputSpeech;
  if (out && out.text) return out.text;
  if (out && out.ssml) return out.ssml.replace(/<[^>]+>/g, '');
  return JSON.stringify(res);
}

(async () => {
  console.log('== 1) Arquivos que voce cola na aba Code (Console da Alexa) ==');
  for (const item of ARQUIVOS) {
    const src = ler(item.nome);
    const linhas = src ? src.split(/\r?\n/).length : 0;
    ok(
      item.nome + '  (' + linhas + ' linhas)',
      linhas > 1,
      src ? 'arquivo vazio' : 'arquivo ausente em lambda\\' + item.nome
    );
  }

  console.log('== 2) Cada arquivo exporta o que o index.js usa ==');
  const modulos = {};
  for (const item of ARQUIVOS) {
    const { mod, erro } = carregar(item.nome);
    modulos[item.nome] = mod;
    if (erro) {
      console.log('  [AVISO] ' + item.nome + ' nao carregou: ' + erro);
      if (item.nome === 'index.js' && /Cannot find module 'ask-sdk-core'/.test(erro)) {
        console.log('          (rode "npm.cmd install" dentro da pasta lambda\\ e repita)');
      }
      continue;
    }
    const faltando = item.usados.filter((nome) => mod[nome] === undefined);
    ok(item.nome + ' -> ' + item.usados.join(', '), faltando.length === 0, 'faltando: ' + faltando.join(', '));
  }

  const ds = modulos['datasource.js'];
  const schedule = modulos['schedule.js'];

  console.log('== 3) Snapshot de emergencia (lambda\\schedule.js) ==');
  const doSnapshot = Object.keys((schedule && schedule.FALLBACK_SERVERS) || {});
  ok('snapshot tem os servidores do site', doSnapshot.length >= 3, doSnapshot.join(', '));
  console.log('  > ' + (doSnapshot.join(', ') || '(vazio)'));

  console.log('== 4) De onde vem a tabela do dia ==');
  if (ds && typeof ds.getServers === 'function') {
    const { servers, source } = await ds.getServers();
    const nomes = Object.keys(servers || {});
    ok('obteve a tabela de times (fonte: ' + source + ')', nomes.length >= 3, nomes.join(', '));
    console.log('  > servidores: ' + (nomes.join(', ') || '(vazio)'));
    if (source !== 'remoto') {
      console.log('  [AVISO] o site nao respondeu agora - a skill usou o snapshot de schedule.js');
    }
  }

  console.log('== 5) A invocacao "abrir time boss" responde? ==');
  const handler = modulos['index.js'] && modulos['index.js'].handler;
  if (typeof handler !== 'function') {
    console.log('  [AVISO] sem handler (ask-sdk-core instalado?) - teste de simulacao pulado');
  } else {
    const resposta = await new Promise((resolve, reject) => {
      handler(envelopeLaunch(), {}, (err, result) => (err ? reject(err) : resolve(result)));
    });
    ok('LaunchRequest responde "Bem-vindo"', /Bem-vindo/.test(fala(resposta)), fala(resposta));
    console.log('  > ' + fala(resposta));
  }

  console.log('\n===== RESULTADO: ' + pass + ' ok, ' + fail + ' falha(s) =====');
  if (fail === 0) {
    console.log(
      'Este conjunto de arquivos esta pronto. Se o simulador ainda responder\n' +
        '"Tive um problema para acessar os dados do time boss", o problema esta no que\n' +
        'esta colado na nuvem: abra a aba Code, compare o numero de linhas de cada\n' +
        'arquivo com a lista acima, cole de novo o que estiver diferente e clique em Deploy.'
    );
  }
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('ERRO NO CHECK:', e);
  process.exit(1);
});

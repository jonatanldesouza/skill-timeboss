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
 *   1. existe, nao esta vazio, o numero de linhas e a ULTIMA LINHA de cada um
 *      (para comparar com o que esta colado na aba Code do Console)
 *   2. exporta tudo o que o index.js usa
 *   3. responde a invocacao "abrir time boss" (LaunchRequest)
 *   4. de onde vieram os dados (site, cache ou snapshot) e se o snapshot serve
 *   5. o arquivo unico (lambda\bundle\index.js) sobe sozinho, sem os auxiliares
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const bundle = require('./bundle-hosted');

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

/** Ultima linha com conteudo: e o que voce deve ver no fim do arquivo no Console. */
function ultimaLinha(src) {
  return bundle.ultimaLinha(src);
}

/**
 * Script jogado numa pasta VAZIA ao lado do arquivo unico: e a simulacao mais
 * fiel da nuvem (um index.js sozinho, sem os 4 auxiliares).
 */
function sonda() {
  return [
    "'use strict';",
    "const handler = require('./index').handler;",
    'const envelope = ' + JSON.stringify(envelopeLaunch(), null, 2) + ';',
    'handler(envelope, {}, (err, res) => {',
    "  if (err) { console.error('ERRO: ' + ((err && err.stack) || err)); process.exit(2); }",
    "  const out = (res.response && res.response.outputSpeech) || {};",
    "  console.log(String(out.ssml || out.text || JSON.stringify(res)).replace(/<[^>]+>/g, ''));",
    '});',
    '',
  ].join('\n');
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
    console.log('  > ultima linha: ' + ultimaLinha(src));
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

  console.log('== 6) Arquivo unico (lambda\\bundle\\index.js): cole so ele em index.js ==');
  const bundleSrc = bundle.atual();
  const bundleLinhas = bundle.contarLinhas(bundleSrc);
  ok(
    'lambda\\bundle\\index.js existe  (' + bundleLinhas + ' linhas)',
    bundleLinhas > 1,
    'rode "node tools\\bundle-hosted.js"'
  );
  ok('bundle em sincronia com os 5 fontes', bundleSrc === bundle.gerar(), 'rode "node tools\\bundle-hosted.js"');
  if (bundleLinhas > 1) console.log('  > ultima linha: ' + ultimaLinha(bundleSrc));

  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-bundle-'));
  try {
    fs.writeFileSync(path.join(pasta, 'index.js'), bundleSrc, 'utf8');
    fs.writeFileSync(path.join(pasta, 'sonda.js'), sonda(), 'utf8');
    const r = spawnSync(process.execPath, ['sonda.js'], {
      cwd: pasta,
      encoding: 'utf8',
      env: Object.assign({}, process.env, { NODE_PATH: path.join(LAMBDA, 'node_modules') }),
    });
    const saida = String(r.stdout || '').trim();
    const detalhe = String(r.stderr || '').trim().split('\n')[0] || saida;
    ok('so o arquivo unico (sem os auxiliares) responde "Bem-vindo"', r.status === 0 && /Bem-vindo/.test(saida), detalhe);
    if (saida) console.log('  > ' + saida.split('\n').filter(Boolean).pop());
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }

  console.log('\n===== RESULTADO: ' + pass + ' ok, ' + fail + ' falha(s) =====');
  if (fail === 0) {
    console.log(
      'Tudo pronto.\n' +
        'No Console, o caminho mais seguro e colar SO o lambda\\bundle\\index.js em index.js:\n' +
        'e um arquivo unico, entao nao ha auxiliar para ficar vazio. Se preferir manter os 5\n' +
        'arquivos, compare as linhas (e a ultima linha) de cada um com a lista acima e cole\n' +
        'de novo o que estiver diferente.'
    );
  }
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('ERRO NO CHECK:', e);
  process.exit(1);
});

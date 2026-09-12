'use strict';

/**
 * bundle-hosted.js - gera a versao de ARQUIVO UNICO para a aba Code do Console.
 * ----------------------------------------------------------------------------
 * Na skill Alexa-hosted o codigo e colado A MAO no editor do Console. Criar
 * varios arquivos e o ponto fragil: se um deles fica vazio ou cortado, a skill
 * sobe e quebra na hora do teste ("ds.getServers is not a function").
 *
 * Este gerador junta os 5 arquivos em UM UNICO `lambda\bundle\index.js`.
 * Voce cola esse arquivo em index.js na aba Code e pronto - nao precisa criar
 * datasource.js, reminders.js, timeutil.js nem schedule.js.
 *
 * Uso:
 *   node tools\bundle-hosted.js           # gera lambda\bundle\index.js
 *   node tools\bundle-hosted.js --check   # so diz se o arquivo esta atualizado
 *
 * Como funciona: cada fonte original entra INTACTA dentro de uma funcao
 * `function (module, exports, require)`, e o `require('./x')` e resolvido por
 * um registro interno; pacotes do npm (ask-sdk-core) vao para o require do Node.
 */

const fs = require('fs');
const path = require('path');

const LAMBDA = path.join(__dirname, '..', 'lambda');
const SAIDA = path.join(LAMBDA, 'bundle', 'index.js');

/** Ordem = quem depende vem depois. */
const MODULOS = [
  ['./timeutil', 'timeutil.js'],
  ['./schedule', 'schedule.js'],
  ['./datasource', 'datasource.js'],
  ['./reminders', 'reminders.js'],
  ['./index', 'index.js'],
];

const MARCA_FIM =
  '/* ===== FIM DO ARQUIVO: se esta linha nao aparece na aba Code, o Ctrl+V cortou ===== */';

const CABECALHO = `'use strict';

/**
 * Time Boss Tio Leo - Lambda em ARQUIVO UNICO (skill Alexa-hosted).
 * GERADO POR tools/bundle-hosted.js - nao edite aqui: edite os arquivos soltos
 * da pasta lambda\\ e rode "node tools\\bundle-hosted.js".
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
}`;

/** Le um fonte da pasta lambda\ normalizado em LF e sem espacos no fim. */
function ler(arquivo) {
  return fs
    .readFileSync(path.join(LAMBDA, arquivo), 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+$/, '');
}

/** Monta o conteudo do arquivo unico (nao escreve nada em disco). */
function gerar() {
  const partes = [CABECALHO];
  for (const [id, arquivo] of MODULOS) {
    partes.push('/* ===== ' + arquivo + ' ===== */');
    partes.push("__def('" + id + "', function (module, exports, require) {");
    partes.push(ler(arquivo));
    partes.push('});');
    partes.push('');
  }
  partes.push('/* ===== handler exigido pelo Lambda ===== */');
  partes.push("exports.handler = __req('./index').handler;");
  partes.push('');
  partes.push(MARCA_FIM);
  partes.push('');
  return partes.join('\n');
}

/** Conteudo que esta hoje em lambda\bundle\index.js, normalizado em LF ('' se nao existe). */
function atual() {
  try {
    return fs.readFileSync(SAIDA, 'utf8').replace(/\r\n/g, '\n');
  } catch (e) {
    return '';
  }
}

/** Ultima linha com conteudo - serve para conferir se o Ctrl+V chegou ate o fim. */
function ultimaLinha(src) {
  const linhas = String(src || '')
    .split('\n')
    .filter((l) => l.trim());
  return linhas.length ? linhas[linhas.length - 1].trim() : '(vazio)';
}

const contarLinhas = (s) => String(s || '').split('\n').length;

function main() {
  const src = gerar();
  const igual = atual() === src;

  if (process.argv.includes('--check')) {
    console.log('  [' + (igual ? 'OK' : 'FALHA') + ']   lambda\\bundle\\index.js ' + (igual ? 'atualizado' : 'desatualizado - rode "node tools\\bundle-hosted.js"'));
    process.exit(igual ? 0 : 1);
  }

  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  // CRLF igual ao resto do repositorio (Windows); o Node/Lambda aceita os dois.
  fs.writeFileSync(SAIDA, src.replace(/\n/g, '\r\n'), 'utf8');

  console.log('== Arquivo unico gerado para a aba Code ==');
  for (const [, arquivo] of MODULOS) {
    console.log('  + ' + arquivo.padEnd(14) + ' (' + contarLinhas(ler(arquivo)) + ' linhas)');
  }
  console.log('');
  console.log('  = lambda\\bundle\\index.js   (' + contarLinhas(src) + ' linhas, ' + (Buffer.byteLength(src) / 1024).toFixed(1) + ' KB)');
  console.log('  > ultima linha: ' + ultimaLinha(src));
  console.log('');
  console.log('Proximo passo, no Console da Alexa: aba Code -> index.js -> Ctrl+A -> Delete');
  console.log('-> Ctrl+V com TODO o conteudo de lambda\\bundle\\index.js -> Deploy.');
  console.log('(Se preferir os 5 arquivos soltos, ignore este bundle e use o check-deploy.)');
  process.exit(0);
}

if (require.main === module) main();

module.exports = { gerar, atual, ultimaLinha, contarLinhas, SAIDA, MARCA_FIM, MODULOS };

'use strict';

/**
 * publish-setup.js - preenche (ou restaura) os dados finais de publicacao.
 *
 * Uso:
 *   node tools/publish-setup.js --user joaosilva --email joao@mail.com
 *   node tools/publish-setup.js --user joaosilva --repo time-boss --email joao@mail.com
 *   node tools/publish-setup.js --user joaosilva --email joao@mail.com --url https://meusite.com
 *   node tools/publish-setup.js --reset      (volta tudo para os placeholders)
 *
 * Atualiza:
 *   - skill-package/skill.json  -> privacyPolicyUrl e termsOfUseUrl
 *   - docs/*.html               -> e-mail de contato
 *
 * No final roda o selftest para confirmar que nao sobrou placeholder.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MANIFEST = path.join(ROOT, 'skill-package', 'skill.json');
const DOCS = ['privacy-policy.html', 'terms-of-use.html'].map((f) => path.join(ROOT, 'docs', f));

const USER_PH = 'SEU-USUARIO';
const MAIL_PH = 'SEU-EMAIL@EXEMPLO.COM';

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return v && v.indexOf('--') !== 0 ? v : true;
}

const reset = !!arg('reset', false);
const noTest = !!arg('no-test', false);
const user = arg('user', null);
const repo = String(arg('repo', 'skill-timeboss'));
const email = arg('email', null);
const url = arg('url', null);

const mudancas = [];

function trocar(file, de, para, rotulo) {
  const antes = fs.readFileSync(file, 'utf8');
  if (antes.indexOf(de) < 0) return;
  fs.writeFileSync(file, antes.split(de).join(para));
  mudancas.push(rotulo + ': ' + de + ' -> ' + para);
}

/* ----------------------------- validacoes ----------------------------- */

if (!reset) {
  const erros = [];
  if (!user || user === true) erros.push('falta --user SEU-USUARIO-DO-GITHUB');
  else if (!/^[A-Za-z0-9]([A-Za-z0-9-]{0,38})$/.test(user)) erros.push('--user invalido (use letras, numeros e hifen)');
  if (!email || email === true) erros.push('falta --email seu@email.com');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.push('--email invalido');
  if (!/^[A-Za-z0-9._-]+$/.test(repo)) erros.push('--repo invalido');
  if (erros.length) {
    console.error('ERRO: ' + erros.join('\n       '));
    console.error('\nExemplo: node tools/publish-setup.js --user joaosilva --email joao@mail.com');
    process.exit(2);
  }
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Troca qualquer e-mail presente no arquivo pelo novo valor. */
function definirEmail(file, novo, rotulo) {
  const atuais = new Set(fs.readFileSync(file, 'utf8').match(EMAIL_RE) || []);
  if (!atuais.size) {
    console.log('  ! ' + rotulo + ': nenhum e-mail encontrado em ' + path.basename(file));
    return;
  }
  for (const atual of atuais) if (atual !== novo) trocar(file, atual, novo, rotulo);
}

/* ------------------------------ execucao ------------------------------ */

const correio = reset ? MAIL_PH : email;
const base = reset ? 'https://' + USER_PH + '.github.io/' + repo : String(url || 'https://' + user + '.github.io/' + repo).replace(/\/+$/, '');

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const pol = manifest.manifest.privacyAndCompliance.locales['pt-BR'];
const antesPol = pol.privacyPolicyUrl;

pol.privacyPolicyUrl = base + '/privacy-policy.html';
pol.termsOfUseUrl = base + '/terms-of-use.html';
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
if (antesPol !== pol.privacyPolicyUrl) {
  mudancas.push('skill.json  privacyPolicyUrl: ' + antesPol + ' -> ' + pol.privacyPolicyUrl);
  mudancas.push('skill.json  termsOfUseUrl:   -> ' + pol.termsOfUseUrl);
}

for (const file of DOCS) definirEmail(file, correio, path.basename(file) + ' contato');

console.log(reset ? '== Placeholders restaurados ==' : '== Configuracao de publicacao aplicada ==');
console.log('  URLs base: ' + base);
console.log('  E-mail de contato: ' + correio);
console.log('');
if (mudancas.length) mudancas.forEach((m) => console.log('  * ' + m));
else console.log('  (nada mudou - os valores ja estavam assim)');

if (!reset && !noTest) {
  console.log('\n== Rodando o selftest ==');
  const r = spawnSync(process.execPath, [path.join(__dirname, 'selftest.js')], { stdio: 'inherit' });
  process.exit(r.status === 0 ? 0 : 1);
}

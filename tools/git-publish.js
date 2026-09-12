'use strict';

/**
 * git-publish.js - faz a publicacao no GitHub com um unico comando.
 *
 * Uso:
 *   node tools/git-publish.js --user SEU-USUARIO-GITHUB --email seu@email.com
 *   node tools/git-publish.js --user joao --email joao@mail.com --name "Joao Silva"
 *   node tools/git-publish.js --user joao --email joao@mail.com --push   (tenta enviar)
 *   node tools/git-publish.js --user joao --email joao@mail.com --skip-setup
 *
 * O que ele faz, na ordem:
 *   1. roda o publish-setup.js (grava as URLs de privacidade/termos e o e-mail)
 *   2. roda o selftest (precisa dar 0 falhas)
 *   3. git init (se preciso) + identidade + add + commit + branch main
 *   4. configura o remote origin
 *   5. com --push, envia para o GitHub; sem --push, mostra o comando (o Git
 *      Credential Manager abre o navegador na primeira vez)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return v && v.indexOf('--') !== 0 ? v : true;
}

const user = arg('user', null);
const email = arg('email', null);
const repo = String(arg('repo', 'skill-timeboss'));
const nome = String(arg('name', process.env.USERNAME || 'Alexa Developer'));
const skipSetup = !!arg('skip-setup', false);
const push = !!arg('push', false);

if (!user || user === true || !/^[A-Za-z0-9]([A-Za-z0-9-]{0,38})$/.test(user)) {
  console.error('ERRO: informe --user SEU-USUARIO-DO-GITHUB (exato, ele entra nas URLs).');
  console.error('Exemplo: node tools/git-publish.js --user jonatanlsouza --email jonatanl.souza@gmail.com');
  process.exit(2);
}
if (!email || email === true || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('ERRO: informe --email seu@email.com (usado como contato das paginas e autor dos commits).');
  process.exit(2);
}

/* --------------------------- localiza o git --------------------------- */
function acharGit() {
  const candidatos = ['git', 'C:\\Program Files\\Git\\cmd\\git.exe', 'C:\\Program Files (x86)\\Git\\cmd\\git.exe'];
  for (const bin of candidatos) {
    try {
      const r = spawnSync(bin, ['--version'], { encoding: 'utf8' });
      if (r.status === 0) return bin;
    } catch (e) { /* tenta o proximo */ }
  }
  console.error('ERRO: nao encontrei o git. Instale em https://git-scm.com/download/win e reabra o terminal.');
  process.exit(2);
}
const GIT = acharGit();

function git(args, opts) {
  const o = Object.assign({ cwd: ROOT, encoding: 'utf8' }, opts);
  const r = spawnSync(GIT, args, o);
  if (opts && opts.capture) return (r.stdout || '').trim();
  return r.status;
}
function gitRun(args) {
  console.log('> git ' + args.join(' '));
  return git(args, { stdio: 'inherit' });
}

/* --------------------------- 1) publish-setup -------------------------- */
if (!skipSetup) {
  console.log('== 1) Gravando as URLs e o e-mail de contato ==');
  const args = [path.join(__dirname, 'publish-setup.js'), '--user', user, '--email', email, '--repo', repo, '--no-test'];
  const r = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0) { console.error('Falhou o publish-setup.'); process.exit(1); }
  console.log('\n== 2) Rodando o selftest ==');
  const t = spawnSync(process.execPath, [path.join(__dirname, 'selftest.js')], { stdio: 'inherit', cwd: ROOT });
  if (t.status !== 0) { console.error('Selftest com falhas - corrija antes de publicar.'); process.exit(1); }
}

/* ------------------------------ 3) commit ------------------------------ */
console.log('\n== 3) Repositorio git ==');
if (!fs.existsSync(path.join(ROOT, '.git'))) {
  gitRun(['init']);
} else {
  console.log('> (repositorio git ja existe)');
}
gitRun(['config', '--local', 'user.name', nome]);
gitRun(['config', '--local', 'user.email', email]);
gitRun(['add', '-A']);

const jaTemCommit = git(['rev-parse', '--verify', 'HEAD'], { capture: true, stdio: 'pipe' });
const staged = git(['diff', '--cached', '--name-only'], { capture: true, stdio: 'pipe' });
if (staged || !jaTemCommit) {
  const msg = 'Skill Time Boss Tio Leo: codigo, modelo, icones e paginas legais';
  console.log('> git commit -m "' + msg + '"');
  git(['commit', '-m', msg], { stdio: 'inherit' });
} else {
  console.log('> (nada novo para commitar)');
}
gitRun(['branch', '-M', 'main']);

/* ------------------------------ 4) remote ------------------------------ */
const url = 'https://github.com/' + user + '/' + repo + '.git';
console.log('\n== 4) Remote origin ==');
const remotos = git(['remote'], { capture: true, stdio: 'pipe' });
if (remotos.split(/\s+/).indexOf('origin') >= 0) {
  gitRun(['remote', 'set-url', 'origin', url]);
} else {
  gitRun(['remote', 'add', 'origin', url]);
}

/* ------------------------------- 5) push ------------------------------- */
console.log('\n== 5) Envio para o GitHub ==');
if (push) {
  gitRun(['push', '-u', 'origin', 'main']);
} else {
  console.log('> (push nao executado - use --push ou rode o comando abaixo)');
}

console.log('\n== Proximos passos ==');
console.log('1. Se ainda nao existe, crie o repositorio publico ' + repo + ' em:');
console.log('   https://github.com/new   (nao marque nenhuma opcao, apenas Create repository)');
console.log('2. Envie o projeto:');
console.log('   git push -u origin main');
console.log('3. GitHub: Settings -> Pages -> branch main + pasta /docs -> Save');
console.log('4. Suas URLs serao:');
console.log('   https://' + user + '.github.io/' + repo + '/privacy-policy.html');
console.log('   https://' + user + '.github.io/' + repo + '/terms-of-use.html');

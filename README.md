# Time Boss Tio Leo — Skill da Alexa

Skill (não oficial) da Alexa para os **times boss do Priston Tale Brasil**, com dados
públicos do site [tioleobpt.com.br](https://tioleobpt.com.br).

Ela faz duas coisas:

1. **Consulta** — fala os times boss de cada servidor, em ordem de horário.
2. **Lembretes** — avisa você no minuto de cada time, a cada hora, todos os dias.

> ⚠️ Os times **mudam todos os dias**. A skill lê a tabela do dia direto do site
> (`js/script3.js`, objeto `fallbackServers`) e guarda em cache por 30 minutos.
> Se a tabela mudar, diga **"atualiza os lembretes"** para ressincronizar.

> 📣 **Vai publicar na sua Alexa agora?** Siga o **[PUBLICAR.md](PUBLICAR.md)** — guia
> passo a passo (site no GitHub Pages + Alexa Developer Console), já com os textos prontos
> para copiar e colar.

---

## Como o usuário fala com a skill

| O que dizer (depois de abrir a skill) | O que acontece |
|---|---|
| `times boss do Awell` | Lista os times do Awell em ordem: Omega min 2, Gama min 17, Delta min 17, Alfa min 29, Zeta min 35, Beta min 36 |
| `que horas é o time Gama no Awell` | Diz o minuto e quantos minutos faltam |
| `horário do Gama` | Mostra o Gama em todos os servidores |
| `quais os servidores` | Lista Awell, Migal, Midranda, Cronus e Idhas |
| `próximos bosses no Awell` | Próximos bosses (usa `api/bosses.php`) |
| `me lembra do time Gama do Awell` | Cria os lembretes do Gama (a cada hora, no minuto 17) |
| `atualiza os lembretes` | Relê a tabela do dia e recria os lembretes |
| `quais lembretes eu tenho` | Lista seus lembretes de time boss |
| `remove os lembretes do Awell` | Apaga os lembretes daquele servidor |

Nome de invocação: **"time boss"** (ex.: *"Alexa, abrir time boss"*).
Para trocar, edite `invocationName` em `skill-package/interactionModels/custom/pt-BR.json`.

---

## Fontes de dados (engenharia reversa do site)

| Dado | Endpoint | Observação |
|---|---|---|
| Times por servidor | `https://tioleobpt.com.br/js/script3.js` | Objeto `fallbackServers` = `{ "Awell": { "Gama": "17", ... } }`. **Republicado todo dia** (o `?v=` muda). |
| Horários dos bosses | `https://tioleobpt.com.br/api/bosses.php` | Retorna `{bosses, sponsors}`. **Exige** o header `X-Requested-With: XMLHttpRequest` (sem ele → 404). |
| — | `https://tioleobpt.com.br/api/timeboss.php` | Existe mas responde sempre **403**. Não é usável. |

O `datasource.js` faz o parse do `fallbackServers` com um *brace matcher*
(não usa regex frágil) e, se a rede falhar, mantém o último dado bom ou usa o
snapshot embutido em `lambda/schedule.js`.

---

## Estrutura do projeto

```
skill-timeboss/
├── skill-package/
│   ├── skill.json                              # manifest (permissão de lembretes, categoria, etc.)
│   └── interactionModels/custom/pt-BR.json     # intents, slots e falas de exemplo
├── lambda/
│   ├── index.js          # handlers da skill (consulta + lembretes)
│   ├── datasource.js     # baixa e faz parse dos dados do site (cache 30 min)
│   ├── reminders.js      # cliente da Alexa Reminders REST API
│   ├── timeutil.js       # data/hora no fuso do usuário (Intl)
│   ├── schedule.js       # snapshot de emergência dos times
│   └── package.json
├── assets/icons/         # ícones 108x108 e 512x512 (exigidos na publicação)
├── docs/                 # política de privacidade + termos de uso (GitHub Pages)
├── tools/
│   ├── make-icons.js     # gera os ícones em PNG (sem dependências)
│   └── selftest.js       # testes locais (sem Alexa)
├── .gitignore
└── README.md
```

---

## 🚨 Limitação importante: "toda hora no minuto XX"

A Alexa **não aceita recorrência por hora** na Reminders API — só
`DAILY`, `WEEKLY`, `MONTHLY` e `YEARLY`. Além disso, no pt-BR o intervalo
mínimo entre recorrências é de **4 horas**
(`UNSUPPORTED_TRIGGER_RECURRENCE_INTERVAL`).

Solução adotada: **24 lembretes diários**, um para cada hora do dia
(`00:17`, `01:17`, ..., `23:17`), cada um com `recurrence: { rrule: "FREQ=DAILY" }`.
O `reminders.js` cria/atualiza/remove tudo isso em paralelo (concorrência 8)
para caber na janela de 8 segundos que a Alexa dá para a skill responder.

Se a API rejeitar a recorrência nova, o código cai automaticamente para o
formato antigo `{ freq: "DAILY" }`.

Outras observações:
* O usuário precisa **conceder a permissão** (`alexa::alerts:reminders:skill:readwrite`).
  A skill envia o card de consentimento na primeira vez.
* Lembretes só podem ser **criados dentro de uma sessão** da skill (`NOT_IN_SESSION`).
* Limite do dispositivo: ~500 lembretes (24 por time → dá ~20 times).
* A skill só enxerga lembretes que **ela mesma** criou (a API restringe por skill).

---

## Testar localmente

```powershell
cd skill-timeboss\lambda
npm install                     # instala ask-sdk-core / ask-sdk-model

cd ..
node tools\selftest.js          # roda a bateria de testes (29 checagens)
node tools\make-icons.js        # (re)gera assets/icons/icon-108.png e icon-512.png
```

O `selftest.js` valida os JSONs, faz o parse real do `script3.js`, testa as
funções de fuso horário, monta os 24 lembretes e **simula requisições na skill**
(LaunchRequest, ConsultarTimesIntent, etc.), imprimindo as falas geradas.
Na última seção ele ainda confere o **pacote de publicação**: ícones com as
dimensões certas, páginas legais, permissão de lembretes no manifest, locale
`pt-BR` e se todo intent/slot do modelo tem handler no código.

> Observação: no Windows o `npm` em PowerShell pode ser bloqueado por
> *Execution Policy*. Use `npm.cmd install`.

---

## Publicar na Alexa

### Opção A — Skill hospedada (mais fácil, sem AWS manual)

1. Crie a skill no [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask)
   → **Create Skill** → nome *Time Boss Tio Leo* → idioma **Português (BR)** →
   modelo **Custom** → hospedagem **Alexa-hosted (Node.js)** → template **Start from scratch**.
   > Se o menu **Code** mostrar *"The code editor only works with an Alexa-hosted skill"*, a
   > skill foi criada como *Provision your own*: clique em **Convert to Alexa-hosted** e
   > escolha a região **US East (N. Virginia)** (recomendada para pt-BR) — veja a *Opção 0* da
   > Parte 6 do `PUBLICAR.md`.
2. Em **Build → Interaction Model → JSON Editor**, cole o conteúdo de
   `skill-package/interactionModels/custom/pt-BR.json` e clique **Save Model → Build Model**.
3. Em **TOOLS → Permissions**, ligue **Reminders**.
4. Em **Code**, substitua o conteúdo de `lambda/` pelos arquivos deste projeto
   (mantenha o `package.json`), e clique **Deploy**.
5. Em **Test**, habilite o teste em *Development* e experimente as falas da tabela acima.
6. Em **Distribution → Images**, envie os dois ícones já gerados:
   `assets/icons/icon-108.png` (pequeno) e `assets/icons/icon-512.png` (grande).
   Para refazer o desenho, rode `node tools\make-icons.js`.
7. Em **Distribution → Privacy & Compliance**, informe as URLs das páginas de
   `docs/` (veja abaixo) e responda o questionário (não coleta dados pessoais,
   não é para crianças, sem compras e sem anúncios).
8. Teste tudo no **Test (Development)** e clique em **Submit for Review**.

### Publicar a política de privacidade e os termos (grátis, via GitHub Pages)

A Alexa exige URLs públicas de **política de privacidade** e **termos de uso**.
As duas páginas já estão prontas em `docs/`:

| Arquivo | URL depois de publicar |
|---|---|
| `docs/privacy-policy.html` | `https://jonatanldesouza.github.io/skill-timeboss/privacy-policy.html` |
| `docs/terms-of-use.html` | `https://jonatanldesouza.github.io/skill-timeboss/terms-of-use.html` |

1. Crie um repositório **público** `skill-timeboss` no GitHub e envie este projeto
   (pela página, arrastando, ou com `git push` — veja o `PUBLICAR.md`).
2. Em **Settings → Pages**: *Source* = *Deploy from a branch*, *Branch* = `main`,
   pasta = **`/ (root)`** se você subiu os arquivos soltos, ou **`/docs`** se enviou o
   projeto inteiro → **Save**.
3. Em ~1 minuto as URLs ficam no ar. Antes disso, rode
   `node tools\publish-setup.js --user jonatanldesouza --email jonatanl.souza@gmail.com` para gravar as
   URLs e trocar o `SEU-EMAIL@EXEMPLO.COM` das páginas de uma vez.
4. Confirme que `privacyPolicyUrl` e `termsOfUseUrl` no `skill-package/skill.json` ficaram
   corretos e informe as mesmas URLs em **Distribution → Privacy & Compliance**.

> Qualquer host serve (Netlify, Vercel, S3...). O `skill.json` só precisa apontar
> para a URL final — e o `selftest.js` avisa enquanto ela estiver com placeholder.

### Checklist de publicação

- [ ] `node tools\selftest.js` → **0 falhas** (30 ok com as URLs já preenchidas)
- [ ] Ícones em `assets/icons/` (108×108 e 512×512) gerados
- [ ] Páginas de privacidade/termos no ar (sem nenhum placeholder)
- [ ] `privacyPolicyUrl` / `termsOfUseUrl` no `skill.json` apontando para as URLs públicas
- [ ] *Build Model* compilou o interaction model sem erros
- [ ] Permissão **Reminders** ligada em *Tools → Permissions*
- [ ] Lambda enviado e publicado (**Deploy**)
- [ ] `Name`, `Summary`, `Description` e `Example Phrases` revisados em *Distribution*
- [ ] Testado no device/app: criar lembrete, ouvir o aviso e pedir “atualiza os lembretes”

### Opção B — ASK CLI

```powershell
npm.cmd install -g ask-cli
ask configure
cd skill-timeboss
ask deploy          # faz upload do manifest, do interaction model e do Lambda
ask deploy -t skill # só skill/interaction model
```

O `skill.json` já usa `apis.custom.endpoint.sourceDir = "lambda"`, que é o
formato esperado pelo ASK CLI para skill hospedada.

---

## Como ajustar / evoluir

| Quero... | Onde mexer |
|---|---|
| Trocar o nome de invocação | `invocationName` no `pt-BR.json` |
| Novos sinônimos de servidor/time | `types` no `pt-BR.json` |
| Mudar as falas | `lambda/index.js` |
| Trocar o tempo de cache | `CACHE_TTL_MS` em `lambda/datasource.js` |
| Atualizar o snapshot de emergência | `lambda/schedule.js` |
| Mudar quantos lembretes por time | `buildTeamReminders()` em `lambda/reminders.js` |

### Ideias de melhoria

* **Ressincronizar sozinho**: detectar mudança na versão (`?v=`) do `script3.js`
  e avisar "a tabela mudou, quer que eu atualize os lembretes?".
* **Lembrete "faltam 5 minutos"**: criar também um aviso antecipado.
* **APL**: mostrar a grade de times na tela do Echo Show.
* **Confirmar antes de apagar**: usar `AMAZON.YesIntent`/`NoIntent` com
  `sessionAttributes` para confirmar remoções em massa.

---

## Aviso

Projeto não oficial, feito pela comunidade. Os dados pertencem ao
[TioLeoBPT](https://tioleobpt.com.br) e à Zenit Games. A skill apenas lê as
informações públicas do site.

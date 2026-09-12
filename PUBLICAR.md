# 🚀 Publicar a skill "Time Boss Tio Leo" na sua Alexa — passo a passo

Guia na ordem, sem pular etapas. Tempo estimado: **40–60 minutos** de configuração
+ **1 a 3 dias úteis** de análise da Amazon.

## O que você vai precisar

| Item | Onde conseguir | Custo |
|---|---|---|
| Conta Amazon | a mesma que você usa no Echo / app Alexa | grátis |
| Conta de desenvolvedor | developer.amazon.com/alexa/console/ask (aceita os termos) | grátis |
| Conta GitHub | github.com/signup | grátis |
| Node.js no PC | você **já tem** (o selftest roda) | — |

> **Sobre o Git:** o **Git 2.55 já está instalado** no seu PC (em `C:\Program Files\Git`).
> A Parte 1 traz dois caminhos: o **A** (arrastar e soltar no GitHub, sem usar terminal) e o
> **B** (com Git, mandando o projeto inteiro de uma vez).

### Visão geral

```
[ github.com ]  hospeda as paginas legais  ->  https://jonatanldesouza.github.io/skill-timeboss/...
       |
       |  2 URLs publicas (privacidade + termos) que a Amazon exige
       v
[ developer.amazon.com ]  skill + modelo + codigo + icones
       |
       v
[ app Alexa / Echo ]  "Alexa, abrir time boss"
```

---

## PARTE 1 — O "site": hospedar privacidade e termos (GitHub Pages)

A Amazon **não aprova** a skill sem 2 URLs públicas (política de privacidade e termos de
uso). As páginas já estão prontas na pasta `docs/` do projeto.

### Caminho A — pela página do GitHub (sem usar o terminal)

### 1.1 Criar a conta no GitHub
1. Abra https://github.com/signup
2. Preencha e-mail e senha e **escolha um username** — anote, ele entra nas URLs.
3. Confirme o e-mail.

### 1.2 Criar o repositório
1. Já logado, clique no **`+`** (canto superior direito) → **New repository**.
2. **Repository name:** `skill-timeboss`
3. Visibilidade: **Public** (obrigatório no Pages grátis).
4. **Não** marque "Add a README file".
5. Clique **Create repository**.

### 1.3 Subir as 3 páginas (arrastando)
1. Abra a pasta `docs` no Explorer — cole isto na barra de endereço:
   ```
   %USERPROFILE%\OneDrive\Documentos\TesteIA\skill-timeboss\docs
   ```
2. Na página do repositório vazio, clique no link **"uploading an existing file"**.
3. Selecione e **arraste os 3 arquivos** (não a pasta!) para a área de upload:
   `index.html`, `privacy-policy.html`, `terms-of-use.html`
   > Arraste os **arquivos**, não a pasta `docs`. Assim eles ficam na raiz e a URL vira
   > `https://jonatanldesouza.github.io/skill-timeboss/privacy-policy.html` — exatamente o
   > formato que o `skill.json` espera.
4. Em *Commit changes*, escreva `paginas legais` → **Commit changes**.

### 1.4 Ligar o GitHub Pages
1. Aba **Settings** do repositório → menu lateral **Pages**.
2. Em *Build and deployment → Source*, deixe **Deploy from a branch**.
3. Em *Branch*: **`main`** + pasta **`/ (root)`** → **Save**.
4. Espere 1–2 min e recarregue: aparece
   *"Your site is live at https://jonatanldesouza.github.io/skill-timeboss/"*.
5. Teste no navegador:
   - `https://jonatanldesouza.github.io/skill-timeboss/`
   - `https://jonatanldesouza.github.io/skill-timeboss/privacy-policy.html`
   - `https://jonatanldesouza.github.io/skill-timeboss/terms-of-use.html`

> **Deu 404?** Espere mais 2 minutos; confira se os nomes estão em minúsculas com hífen e
> se a pasta do Pages é `/ (root)`.

### Caminho B — com Git (✅ o Git 2.55 já está instalado no seu PC)

> ⚡ **Atalho:** os passos 1–3 e 5 daqui podem ser feitos de uma vez com **um comando**
> (ele grava as URLs, roda o selftest, cria o commit, define o `origin` e, com `--push`,
> envia):
> ```powershell
> cd 'c:\Users\Pichau\OneDrive\Documentos\TesteIA\skill-timeboss'
> node tools\git-publish.js --user jonatanldesouza --email jonatanl.souza@gmail.com
> ```
> Depois é só criar o repositório (passo 4), rodar `git push -u origin main` e ligar o
> Pages (passo 6). Os passos numerados abaixo ficam como referência do que ele faz.

Se preferir mandar o **projeto inteiro** para o GitHub (recomendado: versiona tudo e o Pages
sai direto da pasta `docs/`):

1. **Habilite o Git na sessão atual do PowerShell** (não precisa reiniciar o PC):
   ```powershell
   $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
   git --version
   ```
   Se aparecer `git version 2.55.0.windows.5`, está funcionando.

2. **Configure sua identidade** (só na primeira vez — o Git não deixa commitar sem isso):
   ```powershell
   git config --global user.name "Joni"
   git config --global user.email "jonatanl.souza@gmail.com"
   ```

3. **Faça o commit** (o repositório local **já está inicializado** nesta pasta, com os arquivos
   adicionados e o `node_modules/` ignorado pelo `.gitignore`):
   ```powershell
   cd 'c:\Users\Pichau\OneDrive\Documentos\TesteIA\skill-timeboss'
   git add -A
   git commit -m "Skill Time Boss Tio Leo: codigo, modelo, icones e paginas legais"
   ```

4. **Crie o repositório no GitHub** (a "casca", sem README):
   github.com → **`+`** → **New repository** → nome `skill-timeboss` → **Public** →
   **Create repository**.

5. **Envie o projeto** (o `origin` já ficou configurado pelo `git-publish.js`):
   ```powershell
   git push -u origin main
   ```
   Se precisar recriar o remote:
   `git remote set-url origin https://github.com/jonatanldesouza/skill-timeboss.git`
   Na primeira vez abre uma janela do **Git Credential Manager** → *Sign in with your browser*
   → autorize no navegador.

6. **Ligue o Pages apontando para a pasta `docs`**:
   **Settings → Pages** → branch `main` + pasta **`/docs`** → **Save**.
   > O Pages publica o **conteúdo** de `docs/` na raiz do site, então as URLs continuam as
   > mesmas: `https://jonatanldesouza.github.io/skill-timeboss/privacy-policy.html`.

Depois, para atualizar o site é só:
```powershell
git add -A; git commit -m "ajustes"; git push
```

---

## PARTE 2 — Gravar seus dados nos arquivos do projeto

Troque pelos seus dados e rode:

```powershell
cd 'c:\Users\Pichau\OneDrive\Documentos\TesteIA\skill-timeboss'
node tools\publish-setup.js --user jonatanldesouza --email jonatanl.souza@gmail.com
```

O script:
* grava as URLs `.../privacy-policy.html` e `.../terms-of-use.html` em `skill-package/skill.json`;
* troca `SEU-EMAIL@EXEMPLO.COM` pelas páginas de `docs/`;
* roda o selftest no fim — resultado esperado: **`30 ok, 0 falha(s)`** e **nenhum `[AVISO]`**.

Se hospedar as páginas em outro serviço (Netlify, domínio próprio...):

```powershell
node tools\publish-setup.js --user x --email seu@email.com --url https://meudominio.com/skill
```

Para voltar atrás: `node tools\publish-setup.js --reset`

---
## PARTE 3 — Criar a skill no Alexa Developer Console

1. Abra https://developer.amazon.com/alexa/console/ask e faça **Sign In** com a
   **mesma conta Amazon do seu Echo / app Alexa** — é o que permite testar a skill no
   seu aparelho antes de publicar.
   * Primeira vez: aceite o contrato de desenvolvedor e preencha o perfil (nome, país).
2. Clique em **Create Skill**.
3. Preencha:
   * **Skill name:** `Time Boss Tio Leo` (é o nome exibido na loja)
   * **Choose a primary locale:** marque **Portuguese (BR)**
   * **Next**
4. **Choose a type of experience:** **Other** → **Custom** → **Next**
5. **Choose a method to host your skill's backend resources:**
   **Alexa-hosted (Node.js)** → **Next**
   * Se pedir a região da hospedagem, use a padrão (**US East / N. Virginia**).
6. **Choose a template:** **Start from scratch** → **Create Skill**
7. Aguarde o "Preparing your skill…" (uns 30 s).

> ⚠️ O nome de invocação (o que você fala) é **"time boss"** e está no modelo. O
> `Skill name` é só o rótulo da loja. Não precisa ser igual.

---

## PARTE 4 — Colar o modelo de interação (as falas)

1. Menu de cima: **Build** → **Interaction Model** → **JSON Editor**.
2. No editor: **Ctrl+A**, **Delete** (apaga o modelo de exemplo).
3. Abra `skill-package\interactionModels\custom\pt-BR.json`, **Ctrl+A**, **Ctrl+C** e cole
   no editor do Console.
4. **Save Model** → aguarde *"Success! Your model was saved"*.
5. **Build Model** (topo da página) → aguarde **"Build successful"** (1–2 min; pode
   atualizar a página).

> Erro de *"Invalid JSON"* = o conteúdo foi copiado pela metade. Copie de novo, inteiro.

---

## PARTE 5 — Ligar a permissão de Lembretes

1. No menu lateral abra **TOOLS** (canto inferior; em algumas versões é
   **Build → Tools**) → **Permissions**.
2. Localize **Reminders** e **ligue** o botão.
3. Clique **Save** (aparece *"Your permissions have been saved"*).

Isso permite que a skill crie/edite/apague lembretes. O **consentimento do usuário** é
pedido pela Alexa na primeira vez que ele usar o recurso (Parte 7, item 4).

---
## PARTE 6 — Colar o código da skill (Lambda)

### Opção 1 — pelo editor do Console (recomendada, sem instalar nada)

1. Menu de cima: **Code**.
2. À esquerda aparecem os arquivos do template: `index.js`, `util.js`, `package.json`.
3. **package.json** → em geral **não precisa mexer**: o template da Alexa-hosted já traz
   `ask-sdk-core` e `ask-sdk-model`, e o projeto não usa nenhuma outra dependência
   (`datasource.js` e `reminders.js` usam só o `https` nativo do Node).
   Cole o conteúdo abaixo **apenas** se quiser fixar exatamente estas versões
   (⚠️ não cole o `package.json` da pasta `lambda\` do projeto: ele tem *scripts* que
   apontam para `../tools`, que não existem na nuvem):

```json
{
  "name": "timeboss-alexa-skill",
  "version": "1.0.0",
  "description": "Times boss do Priston Tale Brasil com lembretes na Alexa",
  "main": "index.js",
  "dependencies": {
    "ask-sdk-core": "^2.14.0",
    "ask-sdk-model": "^1.86.0"
  }
}
```

4. **index.js** → clique, **Ctrl+A**, **Delete** e cole todo o conteúdo de
   `lambda\index.js` deste projeto.
5. Crie os 4 arquivos novos com o botão **New File** (ícone de **+** na lista de arquivos;
   se não achar, clique com o botão direito na lista → **New File**). Digite o nome e cole
   o conteúdo do arquivo correspondente de `lambda\`:
   * `datasource.js`
   * `reminders.js`
   * `timeutil.js`
   * `schedule.js`
6. O `util.js` do template não é usado — pode apagar (botão direito → **Delete**) ou deixar.
7. Clique em **Deploy** (canto superior direito) → aguarde **"Deployment successful"**.

### Opção 2 — pelo ASK CLI (avançado)

```powershell
npm.cmd install -g ask-cli
ask.cmd configure     # login com a mesma conta Amazon
cd 'c:\Users\Pichau\OneDrive\Documentos\TesteIA\skill-timeboss'
ask.cmd deploy        # envia skill-package/ + lambda/ de uma vez
```

> O `ask deploy` precisa do **Skill ID** da skill criada no Console (o Console mostra em
> *Build* ou na URL do editor) configurado no `.ask/config`. Para o seu caso, a Opção 1 é
> mais simples.

---

## PARTE 7 — Testar antes de publicar

1. Aba **Test** (menu de cima).
2. Se aparecer *"Test is disabled for this skill"*, mude o dropdown **Off → Development**.
3. Digite/fale na caixa do simulador:

| Você diz | Resposta esperada |
|---|---|
| `abrir time boss` | Abertura da skill + pedido do servidor |
| `times boss do awell` | Omega min 2, Gama min 17, Delta min 17, Alfa min 29, Zeta min 35, Beta min 36 |
| `que horas é o time gama no awell` | O minuto do Gama e quantos minutos faltam |
| `quais os servidores` | Awell, Migal, Midranda, Cronus, Idhas |
| `próximos bosses no awell` | Os próximos bosses do servidor |
| `me lembra do time gama do awell` | Confirma os lembretes "a cada hora, no minuto 17" |
| `quais lembretes eu tenho` | Lista os lembretes criados |
| `atualiza os lembretes` | Relê a tabela do dia e recria os 24 lembretes do time |
| `remove os lembretes do awell` | Apaga os lembretes daquele servidor |

4. **Permissão de lembretes:** no primeiro "me lembra…" a Alexa pede autorização e envia um
   card; ele aparece na aba **Home** do próprio simulador (ou no app Alexa). Sem autorizar,
   o lembrete **não** é criado.
5. **Conferir:** no app Alexa do celular → ícone de **Lembretes e alarmes** → devem aparecer
   os lembretes "Time Gama - Awell" (um para cada hora, no minuto 17).

> Como os times mudam todos os dias, diga **"atualiza os lembretes"** para sincronizar com
> a tabela do dia.

---
## PARTE 8 — Preencher a ficha da loja (Distribution)

Menu de cima → **Distribution**.

### 8.1 Skill preview (textos — copie e cole)

* **Skill name:** `Time Boss Tio Leo`
* **Summary:** `Veja os times boss do Priston Tale Brasil e receba lembretes no minuto de cada time.`
* **Description:**

```text
Skill nao oficial que mostra os horarios dos times boss dos servidores Awell, Migal, Midranda, Cronus e Idhas, usando como base os dados publicos do site tioleobpt.com.br.

Pergunte por voz: "times boss do Awell" e ouça a lista completa dos times em ordem. Pergunte "que horas e o time Gama no Awell" para saber o minuto exato.

Voce tambem pode criar lembretes: "me lembra do time Gama do Awell" e a Alexa avisa a cada hora, no minuto do time. Como os times mudam todos os dias, diga "atualiza os lembretes" para sincronizar com a tabela do dia.
```

* **Example phrases:**
  1. `Alexa, abrir time boss`
  2. `times boss do Awell`
  3. `me lembra do time Gama do Awell`
* **Keywords:** `priston tale`, `time boss`, `boss`, `servidor`, `tio leo`

### 8.2 Images (ícones — obrigatórios)

| Campo | Arquivo |
|---|---|
| Small skill icon (108×108) | `assets\icons\icon-108.png` |
| Large skill icon (512×512) | `assets\icons\icon-512.png` |

Se o Console reclamar do arquivo, rode `node tools\make-icons.js` para gerar de novo.

### 8.3 Privacy & Compliance

* **Privacy Policy URL:**
  `https://jonatanldesouza.github.io/skill-timeboss/privacy-policy.html`
* **Terms of Use URL:**
  `https://jonatanldesouza.github.io/skill-timeboss/terms-of-use.html`
  (use exatamente as URLs que o `publish-setup.js` gravou no `skill.json`)
* Questionário:

| Pergunta | Resposta |
|---|---|
| Do you use personal information? | **No** |
| Do you allow users to make purchases? | **No** |
| Does it contain advertising? | **No** |
| Is it directed to children under 13? | **No** |
| Export compliance / usa criptografia? | **Yes** (apenas HTTPS) |

* **Availability / Distribution countries:** **Brazil** (o `skill.json` já tem `["BR"]`).
* **Testing instructions** (usadas pelo certificador) já estão prontas no `skill.json`:
  *"Diga: abrir time boss. Depois tente: times boss do Awell. Para lembretes: me lembra do
  time Gama do Awell. Para atualizar os horarios do dia: atualiza os lembretes."*

---

## PARTE 9 — Enviar para certificação

1. Na página **Distribution**, confira se **nenhum** campo aparece com aviso (⚠): Name,
   Summary, Description, Example phrases, ícones, Privacy Policy, Terms of Use,
   Availability e Export compliance precisam estar completos.
2. Clique em **Submit for Review** (em algumas versões: aba **Certification** →
   *Submit for review*).
3. Marque as declarações ("testei a skill", "as informações são verdadeiras") e confirme.
4. A Amazon responde em **1 a 3 dias úteis** no e-mail da conta. Enquanto isso, sua skill
   continua funcionando **para você** no modo Development.
5. **Se reprovar:** o e-mail diz o motivo. Corrija, faça *Build Model* / *Deploy* de novo e
   reenvie. Motivos mais comuns:
   * URL de privacidade/termos fora do ar (teste antes no navegador);
   * ícone com tamanho errado;
   * fala de exemplo que não existe no modelo de interação.

---
## PARTE 10 — Usar no seu Echo / celular

### Antes de publicar (modo Development)
1. Abra o **app Alexa** no celular (logado na **mesma conta** do Console).
2. **Mais → Skills e Jogos → Suas Skills → aba "Dev"**.
3. Toque em **Time Boss Tio Leo → Usar/Habilitar** e aceite a permissão de lembretes.
4. Fale:
   * *"Alexa, abrir time boss"*
   * *"times boss do awell"*
   * *"me lembra do time gama do awell"*
5. Para ouvir o lembrete de verdade, espere chegar o minuto do time — a Alexa avisa no
   aparelho, como qualquer lembrete.

### Depois de aprovada
A skill passa a aparecer na busca normal da loja Alexa (Brasil) e outras pessoas podem
habilitar. Você não precisa fazer nada além de esperar o e-mail de aprovação.

---

## Comandos úteis do projeto

Na pasta `c:\Users\Pichau\OneDrive\Documentos\TesteIA\skill-timeboss`:

| Comando | Para que serve |
|---|---|
| `node tools\selftest.js` | Roda os 30 testes (inclui as checagens de publicação) |
| `node tools\publish-setup.js --user X --email Y` | Grava as URLs e o e-mail de contato |
| `node tools\git-publish.js --user X --email Y` | Faz tudo do git: URLs + commit + remote (+ `--push`) |
| `node tools\publish-setup.js --reset` | Volta aos placeholders |
| `node tools\make-icons.js` | Regera os ícones 108×108 e 512×512 |

---

## Problemas comuns

| Sintoma | Causa | Solução |
|---|---|---|
| A skill não aparece no app | está em *Development* | app → Skills e Jogos → Suas Skills → **Dev** |
| "Não entendi a fala" | a frase não está no modelo | use uma das falas da Parte 7 ou adicione o `sample` no JSON e *Build Model* |
| Lembrete não é criado | permissão negada ou fora de sessão | aceite o card de permissão; sempre fale dentro da sessão da skill |
| Horários desatualizados | cache de 30 min dos dados do site | *"Alexa, pede pra atualizar os lembretes"* |
| "Tive um problema para acessar os dados" | erro na Lambda (site fora do ar, etc.) | **Code → Logs** no Console (CloudWatch) para ver o erro |
| Build do modelo falha | JSON copiado incompleto | cole o `pt-BR.json` inteiro novamente |
| A página do GitHub dá 404 | Pages não publicado ou pasta errada | Settings → Pages: branch `main` + pasta **`/docs`**; espere 2 min |

---

## Checklist final

- [ ] Páginas publicadas: `privacy-policy.html` e `terms-of-use.html` abrindo no navegador
- [ ] `node tools\publish-setup.js --user ... --email ...` executado → **30 ok, 0 falhas**, sem `[AVISO]`
- [ ] Skill criada (Custom / **pt-BR** / Alexa-hosted Node.js)
- [ ] `pt-BR.json` colado → **Save Model** → **Build successful**
- [ ] **Permissions → Reminders** ligado
- [ ] `index.js`, `datasource.js`, `reminders.js`, `timeutil.js`, `schedule.js` no editor → **Deploy** ok
- [ ] Testado no simulador: consulta de times ✔ / lembrete criado ✔
- [ ] Ícones 108 e 512 enviados em **Distribution → Images**
- [ ] URLs de privacidade/termos preenchidas em **Distribution → Privacy & Compliance**
- [ ] **Submit for Review** enviado

> Este guia cobre o caminho completo. O outro arquivo de referência técnica do projeto é o
> `README.md` (arquitetura, limitações da API de lembretes e como rodar os testes).





# 🚀 Publicar a skill "Time Boss Tio Leo" na sua Alexa — passo a passo

Guia na ordem, sem pular etapas. Tempo estimado: **40–60 minutos** de configuração
+ **1 a 3 dias úteis** de análise da Amazon.

> Interface conferida na **versão atual do Console** (menu superior
> **Build / Code / Test / Distribution / Certification / Analytics**).

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

### Mapa do Console (interface atual)

O Console trocou o menu lateral por um **menu de cima** dentro da skill:

| Menu de cima | Para que serve | Neste guia |
|---|---|---|
| **Build** | modelo de interação, permissões e endpoint | Partes 4 e 5 |
| **Code** | editor + **Deploy** do backend (só em skill *Alexa-hosted*) | Parte 6 |
| **Test** | simulador (*Development* ou *Live*) | Parte 7 |
| **Distribution** | ficha da loja, ícones, privacidade e países | Parte 8 |
| **Certification** | testes de validação e **Submit for review** | Parte 9 |
| **Analytics** | métricas de uso (só se movimentam depois de publicada) | — |

* Na **lista de skills** (tela inicial): **SKILL NAME**, **STATUS** e o dropdown **ACTIONS**
  (com **Test**, **Distribute**…). Clique no **nome** para abrir a skill.
* Dentro da skill, a **barra lateral esquerda do Build** tem os grupos **CUSTOM** (modelo,
  `JSON Editor`, *Assets*) e **TOOLS** (**Permissions**, *Language settings*).

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
2. Na tela **Skills** (a lista inicial) clique em **Create Skill** (canto superior direito).
   * A lista traz **SKILL NAME**, **STATUS** (Development / Live) e o dropdown **ACTIONS**
     (com **Test**, **Distribute**…). Para reabrir uma skill, clique no **nome** dela.
3. Preencha:
   * **Skill name:** `Time Boss Tio Leo` (é o nome exibido na loja)
   * **Choose a primary locale:** marque **Portuguese (BR)**
   * **Next**
4. **Choose a type of experience:** **Other** → **Custom** → **Next**
5. **Choose a method to host your skill's backend resources:**
   **Alexa-hosted (Node.js)** → **Next**
   * Se pedir a região da hospedagem, use a padrão (**US East / N. Virginia**) — é a
     recomendada para **Portuguese (BR)**.
   * ⚠️ **Escolha "Alexa-hosted (Node.js)", não "Provision your own".** Só a Alexa-hosted tem
     o editor de código dentro do Console (Parte 6). Se você já criou a skill como
     *Provision your own*, **não recrie**: use a **Opção 0** da Parte 6 para converter.
6. **Choose a template:** **Start from scratch** → **Create Skill**
7. Aguarde o "Preparing your skill…" (uns 30 s). No fim o Console abre a skill já na
   página **Build** — é daqui que saem as Partes 4 e 5 (veja o *Mapa do Console*).

> ⚠️ O nome de invocação (o que você fala) é **"time boss"** e está no modelo. O
> `Skill name` é só o rótulo da loja. Não precisa ser igual.

---

## PARTE 4 — Colar o modelo de interação (as falas)

1. No **menu de cima** entre em **Build**.
2. Na **barra lateral esquerda**, abra **CUSTOM → Interaction Model → JSON Editor**
   (em algumas versões o **JSON Editor** aparece direto dentro de **CUSTOM**).
3. No editor: **Ctrl+A**, **Delete** (apaga o modelo de exemplo).
4. Abra `skill-package\interactionModels\custom\pt-BR.json`, **Ctrl+A**, **Ctrl+C** e cole
   no editor do Console.
5. Clique em **Save Model** → aguarde *"Success! Your model was saved"*.
6. Clique em **Build Model** (ao lado de *Save Model*; em versões novas aparece como
   **Build skill**) → aguarde **"Build successful"** (1–2 min; pode atualizar a página).

> Erro de *"Invalid JSON"* = o conteúdo foi copiado pela metade. Copie de novo, inteiro.
> Enquanto o build não termina, o Console avisa *"Interaction model is out of date"* — normal.

---

## PARTE 5 — Ligar a permissão de Lembretes

1. Em **Build**, na barra lateral esquerda, abra **TOOLS → Permissions**
   (em versões novas o item aparece direto como **PERMISSIONS**).
2. Localize **Reminders** e **ligue** o botão (o toggle fica verde).
3. Clique em **Save** (aparece *"Your permissions have been saved"*).

> Nessa mesma tela ficam **Timers**, **Lists** e o *Alexa Skill Messaging* (que só libera
> Client Id/Secret — esta skill não usa).

Isso permite que a skill crie/edite/apague lembretes (a permissão
`alexa::alerts:reminders:skill:readwrite` já está no `skill.json` do projeto).
O **consentimento** do usuário é
pedido pela Alexa na primeira vez que ele usar o recurso (Parte 7, item 4).

---
## PARTE 6 — Colar o código da skill (Lambda)

### Opção 0 — se o menu **Code** mostrar *"only works with an Alexa-hosted skill"*

Essa mensagem (com o botão azul **Convert to Alexa-hosted**) significa que a skill foi criada
como **Provision your own** (backend próprio) em vez de **Alexa-hosted**. **Não precisa recriar
a skill**: o Console converte.

1. Na própria página **Code**, clique em **Convert to Alexa-hosted**.
2. Escolha a região **US East (N. Virginia)** — é a recomendada para **Portuguese (BR)**.
3. Confirme a conversão e aguarde ~2 min (*"Preparing your skill…"*).
4. O que acontece: a Amazon cria a hospedagem (Lambda + S3 + repositório) na sua conta de
   desenvolvedor e passa o endpoint da skill a apontar para ela. O **modelo de interação
   (Build)** e a **ficha da loja (Distribution)** continuam intactos — só o backend muda.
5. Se você já tinha uma Lambda sua (AWS), o ARN antigo é substituído — anote-o se precisar
   voltar depois. É reversível: **Code → Use Alexa hosted endpoint** reativa a hospedagem da
   Amazon, e você pode informar o ARN antigo novamente no endpoint da skill.
6. Recarregue a página (**Ctrl+F5**; se ainda não aparecer o editor, saia e entre de novo no
   Console — a conversão leva alguns minutos para propagar). Agora aparecem `index.js`,
   `util.js` e `package.json` → siga a **Opção 1** abaixo.

### Opção 1 — pelo editor do Console (recomendada, sem instalar nada)

1. No **menu de cima** entre em **Code** (essa página só oferece editor para skills
   **custom** hospedadas na Amazon — *Alexa-hosted*).
2. À esquerda aparecem os arquivos do template: `index.js`, `util.js`, `package.json`.
   * O editor é no estilo VS Code: lista de arquivos à esquerda, código no meio e o botão
     **Deploy** no topo à direita.
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
   * A aba **Logs** (parte de baixo da página) mostra o log do CloudWatch da função — é onde
     você procura o erro quando a Alexa diz *"Tive um problema para acessar os dados"*.

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

1. No **menu de cima** entre em **Test**.
2. Se aparecer *"Test is disabled for this skill"*, mude o dropdown
   **Skill testing is enabled in:** para **Development** (o mesmo ajuste aparece em
   **lista de skills → ACTIONS → Test**).
3. Digite ou fale na caixa do **Alexa Simulator**:

> ⚠️ **A primeira frase precisa invocar a skill.** Digite **`abrir time boss`** primeiro
> (isso gera o **LaunchRequest**) e depois vá dizendo as frases da tabela **na mesma sessão**.
> * As frases da tabela são **sample utterances** do modelo (`pt-BR.json`), não comandos de
>   abertura: se você digitar `times boss do awell` **sem** abrir a skill antes, o pedido não
>   entra na skill e quem responde é a própria Alexa. No teste real do projeto apareceu uma
>   resposta do **Amazon Music** (*"Não consegui encontrar essa música…"*), porque a frase
>   foi entendida como pedido de música.
> * Cuidado com o singular: o nome de invocação é **`time boss`** (sem "s"). Digitando
>   `times boss …` a Alexa não encontra a skill.
> * **Nunca cole** JSON, trecho de anotação ou nome de intent na caixa do simulador: ela só
>   aceita o que uma pessoa **fala**. Num teste do projeto foi colado um texto terminando em
>   *"consultartimesintent sample da linha quinze do modelo"* e a Alexa respondeu
>   *"Não sei como posso ajudar."* — o pedido não entrou na skill.
> * **Como saber se o pedido entrou na skill:** a abertura responde *"Bem-vindo ao Time Boss!…"*
>   e um erro dentro da skill responde *"Não entendi. Tente: times boss do Awell…"* (`index.js`).
>   Se aparecer *"Não sei como posso ajudar."*, é fala da própria Alexa: a skill **não abriu**.
> * Formato *one-shot* (tudo em uma frase), se quiser testar:
>   `pergunte ao time boss os times do awell` (verbo de invocação + uma das falas do modelo).
>   Se o simulador não aceitar, volte ao caminho seguro: abrir a skill primeiro.

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

### Roteiro de teste (copie e cole uma linha por vez)

```text
abrir time boss
times boss do awell
que horas e o time gama no awell
quais os servidores
me lembra do time gama do awell
quais lembretes eu tenho
remove os lembretes do awell
parar
```

* Espere a resposta de cada linha antes de digitar a próxima — é assim que a sessão continua aberta.
* As falas do modelo (`pt-BR.json`) estão **sem acento** (`que horas e o time {time}`); a Alexa
  normaliza o acento, mas se alguma frase falhar, digite exatamente como está acima.
* Se a **primeira** linha (*`abrir time boss`*) não responder *"Bem-vindo ao Time Boss!…"*, o
  modelo não está compilado no Console — use a linha *"Ao abrir, a Alexa não conhece a skill"*
  em **Problemas comuns**.
* Tire uma foto do painel **Skill I/O** se algo der errado: ali aparece o JSON do `LaunchRequest`
  e do `IntentRequest`, provando se o pedido chegou na Lambda.

* No painel da direita ligue **Skill I/O** (JSON de entrada/saída), **Device Display** (a tela
  do aparelho) e **Device Log** — é o que ajuda a achar o motivo quando a Alexa responde errado.


4. **Permissão de lembretes:** no primeiro "me lembra…" a Alexa pede autorização e envia um
   **card de permissão** (no painel **Skill I/O** dá para ver o card no JSON da resposta);
   quem autoriza é o **app Alexa** (aba **Home**, no celular). Sem autorizar, o lembrete
   **não** é criado.
5. **Conferir:** no app Alexa do celular → ícone de **Lembretes e alarmes** → devem aparecer
   os lembretes "Time Gama - Awell" (um para cada hora, no minuto 17).

> Como os times mudam todos os dias, diga **"atualiza os lembretes"** para sincronizar com
> a tabela do dia.

---
## PARTE 8 — Preencher a ficha da loja (Distribution)

No **menu de cima** entre em **Distribution**. A página tem um **menu no topo esquerdo**
para trocar de seção, e cada seção tem o seu próprio botão **Save**:

| Seção (topo esquerdo) | O que preencher | Neste guia |
|---|---|---|
| **Skill Preview** | idioma da ficha (**Portuguese (BR)**) | — |
| **Primary Details** | nome, resumo, descrição, frases de exemplo, palavras-chave, categoria | 8.1 |
| **Media Details** | ícones 108 e 512 (+ imagens/vídeo opcionais) | 8.2 |
| **Privacy & Compliance** | URLs de privacidade e termos, questionário e instruções de teste | 8.3 |
| **Availability** | países em que a skill fica disponível (**Brazil**) | 8.3 |

> O **nome** da skill não pode ser alterado depois de publicada (nem o nome de invocação):
> confira tudo antes de enviar para certificação.

### 8.1 Primary Details (textos — copie e cole)

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

### 8.2 Media Details (ícones — obrigatórios)

| Campo | Arquivo |
|---|---|
| Small skill icon (108×108) | `assets\icons\icon-108.png` |
| Large skill icon (512×512) | `assets\icons\icon-512.png` |

Se o Console reclamar do arquivo, rode `node tools\make-icons.js` para gerar de novo.

### 8.3 Privacy & Compliance + Availability

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

1. No **menu de cima** entre em **Certification** e abra a aba **Submission**.
2. Clique no botão de validação (**Run validation tests** / seção *Validate your skill*) e
   espere o resultado: ele acusa erro de modelo, endpoint, ícone ou ficha antes de a Amazon
   olhar.
3. Revise o **submission checklist** — são os mesmos itens que o time de certificação testa.
4. Confira que **nenhum** campo de **Distribution** está com aviso (⚠): nome, resumo,
   descrição, frases de exemplo, ícones, Privacy Policy, Terms of Use, Availability e
   Export compliance.
5. Em **Publishing preference** escolha **Certify and publish now** (publica sozinha depois
   de aprovada) ou **Certify now and Publish Later** (você decide quando publicar).
6. Escreva uma **Version message** (ex.: `v1 - tabela de times e lembretes`) e clique em
   **Submit for review**.
7. A Amazon responde em **1 a 3 dias úteis** no e-mail da conta e o **STATUS** na lista de
   skills muda (*In Review → Certified → Live*). Enquanto isso, sua skill continua
   funcionando **para você** no modo Development.
8. **Se reprovar:** o e-mail diz o motivo. Corrija, faça *Save Model* / *Build Model* e
   *Deploy* de novo e reenvie. Motivos mais comuns:
   * URL de privacidade/termos fora do ar (teste antes no navegador);
   * ícone com tamanho errado;
   * fala de exemplo que não existe no modelo de interação.

---
## PARTE 10 — Usar no seu Echo / celular

### Antes de publicar (modo Development)
1. Abra o **app Alexa** no celular (logado na **mesma conta** do Console).
2. **Mais → Skills e Jogos → Suas Skills → aba "Dev"**.
3. Toque em **Time Boss Tio Leo → Usar/Habilitar** e aceite a permissão de lembretes.
   * Se a skill não aparecer ali, volte ao Console → **Test** e confirme o dropdown
     **Skill testing is enabled in:** = **Development**.


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
| A Alexa responde com **música / Amazon Music** em vez da skill | a frase foi dita **sem abrir a skill** antes (falta o nome de invocação) ou com typo (*times* em vez de *time*) | diga **`abrir time boss`** primeiro e só depois a fala da Parte 7, dentro da sessão |
| No simulador a Alexa diz *"Não sei como posso ajudar."* | o pedido **não entrou** na skill (faltou o nome de invocação) ou foi colado um texto que ninguém fala (JSON, anotação) | diga **`abrir time boss`**; se a resposta não for *"Bem-vindo ao Time Boss!…"*, compile o modelo (*Save Model* → *Build Model*) |
| Ao abrir, a Alexa **não conhece a skill** | o modelo não foi compilado no Console | **Build → CUSTOM → Interaction Model → JSON Editor** → **Save Model** → **Build Model** (espere *Build successful*) |
| Lembrete não é criado | permissão negada ou fora de sessão | aceite o card de permissão; sempre fale dentro da sessão da skill |
| Horários desatualizados | cache de 30 min dos dados do site | *"Alexa, pede pra atualizar os lembretes"* |
| "Tive um problema para acessar os dados" | erro na Lambda (site fora do ar, etc.) | **Code → Logs** no Console (CloudWatch) para ver o erro |
| Build do modelo falha | JSON copiado incompleto | cole o `pt-BR.json` inteiro novamente |
| A página do GitHub dá 404 | Pages não publicado ou pasta errada | Settings → Pages: branch `main` + pasta **`/docs`**; espere 2 min |
| **Code** diz *"The code editor only works with an Alexa-hosted skill"* | skill criada como *Provision your own* | clique em **Convert to Alexa-hosted** → região **US East (N. Virginia)** (veja a Opção 0 da Parte 6) |
| Depois de *Deploy* o editor volta ao template | *Deploy* sem *Save* ou conversão incompleta | confira os 5 arquivos na lista e clique **Deploy** só depois de salvar |
| Não acho o menu **Tools/Permissions** | a barra lateral mudou nas versões novas | **Build** → barra lateral esquerda → **TOOLS → Permissions** (às vezes aparece direto como **PERMISSIONS**) |
| *"Test is disabled for this skill"* | teste desligado para a skill | aba **Test** → dropdown **Skill testing is enabled in:** → **Development** |
| **Certification** não deixa enviar | falta rodar a validação ou há aviso na ficha | rode os testes na própria **Certification** e limpe os avisos em **Distribution** |
| Quero mudar o nome de invocação depois de publicado | a Amazon não permite em skill publicada | crie uma skill nova e remova a antiga |
| **Analytics** mostra tudo zerado | a skill ainda não tem clientes | normal em Development; os números vêm depois de publicada |

---

## Checklist final

- [ ] Páginas publicadas: `privacy-policy.html` e `terms-of-use.html` abrindo no navegador
- [ ] `node tools\publish-setup.js --user ... --email ...` executado → **30 ok, 0 falhas**, sem `[AVISO]`
- [ ] Skill criada (Custom / **pt-BR** / Alexa-hosted Node.js)
- [ ] Se o **Code** pedir *"Convert to Alexa-hosted"*, conversão feita (US East / N. Virginia)
- [ ] `pt-BR.json` colado em **Build → CUSTOM → Interaction Model → JSON Editor** → **Save Model** → **Build successful**
- [ ] **Build → TOOLS → Permissions → Reminders** ligado
- [ ] `index.js`, `datasource.js`, `reminders.js`, `timeutil.js`, `schedule.js` na aba **Code** → **Deploy** ok
- [ ] Testado na aba **Test** (*Skill testing is enabled in:* = **Development**): times ✔ / lembrete ✔
- [ ] No simulador, **`abrir time boss`** abre a skill **antes** das falas de consulta (elas são *sample utterances* e só valem dentro da sessão) e responde *"Bem-vindo ao Time Boss!…"* (use o roteiro da Parte 7, sem colar JSON nem anotações)
- [ ] Ícones 108 e 512 enviados em **Distribution → Media Details**
- [ ] Ficha completa em **Distribution** (Primary Details, Media Details, Privacy & Compliance, Availability)
- [ ] Validação rodada e **Submit for review** enviado em **Certification → Submission**

> Este guia cobre o caminho completo. O outro arquivo de referência técnica do projeto é o
> `README.md` (arquitetura, limitações da API de lembretes e como rodar os testes).





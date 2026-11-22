# Agenda a Dois 💞

Agenda inteligente com uma agenda **pessoal** para cada um e uma agenda **compartilhada** para o casal.

**Recursos**
- ✦ **Criar evento por texto**: escreva "jantar sexta 20h", "dentista amanhã 14:30 por 45 min", "cinema dia 25 das 19h às 21h30", "aniversário 12/12".
- 💚 **Livres em comum**: mostra quando vocês dois estão livres ao mesmo tempo, considerando também a agenda pessoal de cada um. Só os horários são cruzados: os títulos da agenda pessoal continuam privados.
- 🔔 **Notificações push**: lembrete antes de cada evento e aviso quando seu par cria algo na agenda de vocês, mesmo com o app fechado.
- 📲 **Instalável no iPhone** (PWA), sem App Store.
- 🤖 **Assistente com IA**: sugere programas a dois, organiza a semana e encaixa atividades nos horários livres.
- 💌 **Propor um programa**: sugira algo num horário livre; seu par aceita, pede outro horário ou avisa que não pode.
- ⚡ **Tempo real**: quando um cria ou edita um evento, a tela do outro atualiza sozinha.

Stack: React 18 + Vite (PWA), Supabase (Auth, Postgres com RLS, Realtime, Edge Functions, pg_cron), Web Push e a API do Claude.

---

## 1. Criar o projeto no Supabase

1. Entre em <https://supabase.com>, clique em **New project** e espere ele ficar pronto.
2. Vá em **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**. Depois faça o mesmo com `supabase/push.sql`.
3. (Opcional, para testar mais rápido) Em **Authentication → Sign In / Providers → Email**, desative **Confirm email**. Assim vocês entram direto, sem precisar confirmar o e-mail.

## 2. Rodar o app

Crie o arquivo `.env` copiando o `.env.example` (`cp .env.example .env`) e preencha com os dados de **Project Settings → API** (Project URL e a chave `anon`/publishable):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Depois rode:

```bash
npm install
npm run dev
```

Abra o endereço que aparecer (normalmente <http://localhost:5173>).

## 3. Compartilhar com seu par

1. Cada um cria a própria conta. A agenda **Pessoal** é criada sozinha no cadastro.
2. Um de vocês clica em **+ Compartilhada**, escolhe nome e cor e cria a agenda.
3. Clique no código (ex.: `K7P2QX`) para copiar e mande para o outro.
4. O outro clica em **Tenho um código** e cola o código. Pronto, a agenda passa a ser dos dois.

## 4. Ativar a IA (assistente)

A chave da API fica guardada **no servidor** (Edge Function), nunca no navegador.

1. Crie uma chave em <https://console.anthropic.com> (o uso da API é pago).
2. No terminal, dentro da pasta do projeto:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF   # o ref aparece na URL do painel
# descomente a linha ANTHROPIC_API_KEY em supabase/.env.secrets e cole sua chave
npx supabase secrets set --env-file supabase/.env.secrets
npx supabase functions deploy sugestoes
```

Opcional: `npx supabase secrets set ANTHROPIC_MODEL=claude-sonnet-5-5` para usar um modelo mais forte (o padrão é `claude-haiku-5-5`, mais barato).

## 5. App no iPhone com notificações 📲

O app é um **PWA**: no iPhone ele é instalado pelo Safari (sem App Store) e recebe notificações mesmo fechado (iOS 16.4 ou mais recente).
As notificações são enviadas pelo servidor: a cada minuto o Supabase verifica os lembretes e avisa seu par quando você cria um evento na agenda compartilhada.

**Antes de começar, crie dois arquivos com segredos** (os dois estão no `.gitignore`, então não vão para o GitHub):
- `.env`: copie o `.env.example` e preencha a URL e a chave do Supabase e a `VITE_VAPID_PUBLIC_KEY`.
- `supabase/.env.secrets`: copie `supabase/env.secrets.example` e preencha. Para gerar chaves VAPID novas: `npx web-push generate-vapid-keys`.

### Passo a passo

1. **Banco:** no SQL Editor, rode `supabase/push.sql` depois `supabase/notificacoes.sql` (preferências de cada usuário) `supabase/recorrencia.sql` (eventos que se repetem) e `supabase/propostas.sql` (propor um programa).
2. **Segredos e funções** (no terminal, na pasta do projeto):
   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_PROJECT_REF
   npx supabase secrets set --env-file supabase/.env.secrets
   npx supabase functions deploy enviar-lembretes --no-verify-jwt
   ```
3. **Agendamento:** abra `supabase/cron.sql`, troque `SEU_PROJECT_REF` e rode no SQL Editor.
4. **Publicar na internet (HTTPS é obrigatório para push):**
   - Suba o projeto no GitHub e importe na <https://vercel.com> (Framework: Vite).
   - Em *Environment Variables*, adicione `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_VAPID_PUBLIC_KEY` (os mesmos valores do `.env`).
   - No Supabase, em **Authentication → URL Configuration**, coloque o endereço da Vercel em **Site URL**.
5. **No iPhone (cada um de vocês):**
   1. Abra o endereço da Vercel no **Safari**.
   2. Toque em **Compartilhar → Adicionar à Tela de Início**.
   3. Abra o app **pelo ícone** e entre na sua conta (o app instalado tem login separado do Safari).
   4. Toque em **🔔 Ativar notificações** e permita.

**Para testar:** crie um evento para daqui a 10 minutos com lembrete de "5 min antes". Em **Edge Functions → enviar-lembretes → Logs** dá para ver cada execução.

## Estrutura

```
supabase/
  schema.sql                 tabelas, RLS, convite por código, horários ocupados
  push.sql                   tabela de inscrições push
  cron.sql                   roda os lembretes a cada minuto
  functions/sugestoes/       Edge Function que conversa com a IA
  functions/enviar-lembretes/ Edge Function que envia as notificações
src/
  lib/parser.js              transforma texto em evento ("jantar sexta 20h")
  lib/freeTime.js            calcula horários livres em comum
  lib/layout.js              posiciona eventos sobrepostos na grade
  lib/dates.js               utilitários de data (pt-BR)
  hooks/useCalendars.js      agendas, membros, criar/entrar/sair
  hooks/useEvents.js         eventos + tempo real
  hooks/useReminders.js      aviso de lembrete dentro do app
  lib/push.js                inscrição nas notificações push
public/
  manifest.webmanifest, sw.js, icons/   o que torna o app instalável
  components/
    Agenda.jsx               tela principal com as abas (Dia, Semana, Juntos, Assistente)
    DayView.jsx              o dia: número grande, faixa do casal e lista de eventos
    CoupleStrip.jsx          faixa do casal (horários ocupados e livres dos dois)
    WeekStrip.jsx            faixa com os 7 dias no topo
    WeekList.jsx             semana em lista contínua (celular)
    WeekGrid.jsx             semana em grade com horários (computador)
    InlineAdd.jsx            escrita rápida na tela inicial
    QuickAdd.jsx             folha do botão + (novo evento)
    EventModal.jsx           janela de detalhes do evento
    TogetherView.jsx         aba Juntos (convite, horários livres, agendas)
    AccountSheet.jsx         conta: notificações, trocar senha, sair
    PushButton.jsx           sino de notificações / instalar no iPhone
    Auth.jsx                 entrar, cadastrar e "esqueci minha senha"
    NewPassword.jsx          criar senha nova pelo link do e-mail
    PasswordField.jsx        campo de senha com o olhinho
```

## Como funciona a privacidade

- **RLS (Row Level Security)**: cada pessoa só lê e edita eventos das agendas de que é membro.
- A função `horarios_ocupados` devolve **só início e fim** dos eventos de cada membro, sem título. É assim que dá para calcular os "livres em comum" sem expor a agenda pessoal do outro.
- A IA só recebe os eventos que o próprio usuário já pode ver.

## Limitações e próximos passos

- No iPhone, as notificações só funcionam com o app instalado pela Tela de Início (exigência da Apple).
- Ainda não há eventos que se repetem (ex.: "academia toda segunda").
- Só existe a visão semanal; uma visão mensal seria uma boa adição.

# Life OS

Un sistema operativo personale AI-first: qualsiasi cosa della tua vita entra in
linguaggio naturale — da Telegram o dal web — e il sistema capisce da solo cosa
farne.

> «Ho speso 35 euro al supermercato»
> → transazione registrata, categoria risolta, saldo aggiornato.

> «Domani devo andare dal commercialista alle 10 e ricordarmi i documenti»
> → evento in calendario, task collegato, promemoria.

Uso personale, singolo utente, costo **€0/mese**.

---

## Come è fatto

```
WEB APP (Next.js)          TELEGRAM BOT
`keeps_history`      │                         │
       └───────┬─────────────────┘
               ▼
        INTERFACE ADAPTERS          risolvono l'identità utente
               ▼
          AI SERVICE                contesto → provider → tool loop → log
               ▼
        TOOL REGISTRY               32 tool tipizzati con zod
               ▼
       BUSINESS LOGIC               lib/services — unico punto che scrive
               ▼
        DATA ACCESS                 lib/db/repositories — userId obbligatorio
               ▼
     SUPABASE POSTGRES + RLS
```

Telegram e web **non** sono due sistemi: divergono solo nel primo livello. Dallo
`AI SERVICE` in giù eseguono lo stesso identico codice, sullo stesso database.

Tre regole che spiegano quasi tutte le scelte di questo repo:

1. **L'AI non è il database.** Il modello emette solo nomi di tool e argomenti
   JSON. Non vede SQL, non ha un client Supabase, non riceve mai la service role
   key. Ogni handler riceve `userId` dal server, mai dal modello.
2. **Il database è la fonte di verità.** La memoria dell'AI non sostituisce i
   dati strutturati: se sono in disaccordo, vincono le tabelle.
3. **Le date non le calcola il modello.** Riceve l'istante corrente in
   `Europe/Rome` e deve restituire un valore ISO assoluto; `lib/utils/date.ts`
   valida e converte. Se è ambiguo si chiede, non si indovina.

## Stack

| Livello | Scelta | Perché |
|---|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4, shadcn/ui | — |
| Backend | Route Handlers + Server Actions | niente server separato da mantenere |
| Database | Supabase Postgres + RLS | free tier, auth inclusa |
| Auth | Supabase Auth (email + password) | utente singolo, registrazione chiusa |
| AI | interfaccia `AIProvider`, default Gemini Flash | intercambiabile via env var |
| Bot | Telegram Bot API via webhook | gratis, già sul telefono |
| Hosting | Vercel Hobby | — |
| Scheduler | **GitHub Actions**, non Vercel Cron | Vercel Hobby esegue i cron 1 volta al giorno: inutilizzabile per i promemoria |

## Requisiti

- Node.js 20+
- Un progetto Supabase
- Un bot Telegram (@BotFather)
- Una API key Google Gemini (free tier)

## Sviluppo locale

```bash
npm install
cp .env.example .env.local   # poi compila i valori
npm run dev
```

### Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Server di sviluppo |
| `npm run build` | Build di produzione |
| `npm run typecheck` | TypeScript strict, senza emettere |
| `npm run lint` | ESLint |
| `npm test` | Test unitari e di integrazione (vitest) |
| `npm run test:e2e` | Test end-to-end (playwright) |

## Configurazione

### Supabase

1. Crea un progetto (regione europea, per la latenza).
2. Applica **tutte** le migration in `supabase/migrations/`, in ordine numerico.
   Creano 29 tabelle, gli enum, gli indici, i trigger, la RLS su tutte le
   tabelle, l'hardening delle funzioni e il bootstrap del nuovo utente (2 conti
   e 27 categorie italiane, così il sistema è usabile dal primo minuto).
   L'ordine è vincolante: la `0006` applica la RLS per introspezione su ciò che
   esiste già, e le migration successive correggono vincoli create prima.
3. Genera i tipi:
   ```bash
   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
   ```
4. Crea il tuo utente da **Authentication → Users**, poi **disabilita la
   registrazione** in Authentication → Providers: il sistema è mono-utente.
5. Copia URL, anon key e service role key in `.env.local`.

### Telegram

1. Crea il bot con [@BotFather](https://t.me/botfather) e prendi il token.
2. Genera un `TELEGRAM_WEBHOOK_SECRET` casuale e lungo.
3. Dopo il deploy, registra il webhook:
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" -d "url=https://<app>.vercel.app/api/telegram/webhook" -d "secret_token=<SECRET>"
   ```
4. Dal web, in Impostazioni, genera il codice di collegamento e mandalo al bot
   con `/link CODICE`. L'associazione usa l'id numerico Telegram, mai lo
   username, che è falsificabile.

### AI

```env
AI_PROVIDER=gemini
AI_API_KEY=...
AI_MODEL=gemini-3.5-flash-lite
```

Cambiare modello o fornitore è una modifica di ambiente, non di codice:
`AI_PROVIDER=openai-compatible` più `AI_BASE_URL` copre Groq, OpenRouter e
Ollama in locale.

### Scheduler

Il sistema espone un solo endpoint, `POST /api/cron/tick`, protetto da
`Authorization: Bearer $CRON_SECRET`. Chi lo chiama è deliberatamente
sostituibile, ed è stato sostituito una volta.

**Chi lo chiama davvero: [cron-job.org](https://cron-job.org)**, ogni 5 minuti,
con il metodo POST e l'header `Authorization`. Gratuito, e puntuale: misurato in
produzione, un promemoria previsto per le 21:05:00 è partito alle 21:05:16.

**GitHub Actions** (`.github/workflows/cron-tick.yml`) resta come rete di
sicurezza, con i secret `APP_URL` e `CRON_SECRET`. Era la scelta iniziale, ed è
stata la scelta sbagliata: i suoi cron sono dichiaratamente "best effort" e su
un repository tranquillo vengono diradati fino a **una esecuzione ogni tre ore**
invece delle dodici l'ora richieste. Per un sistema il cui senso è ricordarti le
cose all'ora giusta, non è un dettaglio. Chiamare il tick due volte non fa
danni, quindi i due convivono.

L'endpoint è idempotente e lavora su ciò che è **scaduto**, guardando sei ore
indietro oltre che quarantotto avanti: un tick saltato o in ritardo non perde
nulla.

## Liste

Da spuntare: la spesa, cosa mettere in valigia, i film da vedere. Il valore non
è la schermata ma la frase detta camminando: **«aggiungi latte, pane e caffè
alla spesa»**. Se la lista non esiste la crea, e lo dice — creare un contenitore
vuoto non è inventare un dato, ma deve restare visibile, perché è l'unico modo
di accorgersi di un nome capito male.

**Due tabelle e non una**: le voci non sono un campo di testo dentro la lista.
Con un blocco unico, spuntare una riga vorrebbe dire riscrivere tutta la lista,
e da telefono è il modo di perdere pezzi. Una voce registra **quando** è stata
spuntata, non se: costa uguale e conserva quello che un booleano butta via.

 `keeps_history` è il carattere della lista, deciso quando la crei. La spesa si
**svuota** e si riusa; i film visti **tengono lo storico**, e l'azione «svuota
le spuntate» lì non compare nemmeno: quelle voci sono il contenuto della lista,
non il suo scarto.

Il nome è unico senza distinzione di maiuscole. Quando l'assistente risolve
«alla spesa» non devono esistere una «Spesa» e una «spesa» fra cui indovinare.

## Vocali e foto

Un vocale o una foto diventano **parole** prima di toccare qualsiasi altra cosa: il
file viene scaricato da Telegram, il modello lo legge, e da quel punto in poi il
sistema non sa più da dove arrivava il messaggio — stessi strumenti, stessa
memoria, stesso log.

Sono due passaggi invece di uno, e non per caso. Google documenta l'audio
inline (OGG/Opus compreso, 32 token al secondo) ma **non** dice se audio e
chiamata di strumenti possano viaggiare insieme; e soprattutto: quello che il
modello ha capito viene **mostrato prima** di agire. Una trascrizione che vedi
solo sotto all'azione è una trascrizione che non fai in tempo a correggere, e
«quaranta» al posto di «quattordici» diventa una spesa sbagliata.

Per le foto il prompt copre scontrini (importo, esercente, data), scrittura a
mano e documenti; la didascalia che scrivi vale come istruzione. Niente viene
conservato: il file passa, se ne ricava del testo, e i byte finiscono lì.

Quello che il bot non sa gestire — adesivi, video, allegati — riceve una
risposta che lo dice. Un bot che tace è indistinguibile da un bot rotto.

## Cercare, e portarsi via i dati

**⌘K / Ctrl+K** apre una sola casella che fa due cose: cerca in tutto ciò che hai
registrato — task, progetti, obiettivi, appuntamenti, movimenti, persone,
appunti — e porta a una schermata. La ricerca è una funzione SQL,
`global_search()`, che fa l'unione delle tabelle e le ordina per somiglianza:
otto liste ordinate separatamente in JavaScript sarebbero più lente e
ordinerebbero peggio. Scegliendo un risultato non si atterra sulla schermata ma
**sulla riga**, che viene evidenziata per due secondi.

Il tema segue il dispositivo, con la scelta esplicita in Impostazioni.

I dati si scaricano da Impostazioni, in due formati che rispondono a due
domande diverse: **JSON** è la copia completa con i valori esatti, per un
backup; **CSV** serve ad aprire una tabella nel foglio di calcolo, quindi è
separato da `;` con la virgola decimale e il BOM, che è come Excel in italiano
si aspetta di leggere un file — con la virgola come separatore gli importi
finirebbero letti come date.

## Deploy su Vercel

1. Collega il repository.
2. Inserisci tutte le variabili di `.env.example` (nessuna eccezione: la build
   passa anche senza, ma l'app fallisce con un errore esplicito al primo uso).
3. Imposta `NEXT_PUBLIC_APP_URL` sull'URL di produzione.
4. Registra il webhook Telegram su quell'URL.

## Sicurezza

- RLS attiva su tutte le tabelle, policy uniforme `user_id = auth.uid()`.
- Le chiavi esterne sono **composite** `(id, user_id)`: il database rifiuta di
  collegare fra loro record di utenti diversi anche quando la RLS è scavalcata.
- **Telegram e cron girano con la service role key, che bypassa la RLS.** Su
  quei percorsi la garanzia non è la RLS ma la disciplina del layer repository:
  `userId` è un argomento obbligatorio di ogni funzione. Il client service-role
  vive solo in `src/lib/db/admin.ts`, protetto da `import 'server-only'`.
- Il webhook verifica `X-Telegram-Bot-Api-Secret-Token` e deduplica gli
  `update_id`, così un retry di Telegram non registra due volte la stessa spesa.
- Nessun segreto nei log, nessun analytics di terze parti, nessun tracking.
- Header su ogni risposta (`next.config.ts`): `X-Frame-Options: DENY` e
  `frame-ancestors 'none'` — nessuno deve poter incorniciare questa app e
  rubare un click su un pulsante di conferma — più `nosniff`,
  `strict-origin-when-cross-origin` e una `Permissions-Policy` che spegne
  fotocamera, microfono, posizione e pagamenti.
- L'export è dietro la sessione: senza cookie `/api/export` risponde 307 verso
  il login, e usa il client con la anon key, quindi la RLS vale anche lì.

Il linter di sicurezza di Supabase è pulito, con due voci lasciate aperte di
proposito e una che tocca a te:

- `telegram_updates` ha la RLS attiva **e nessuna policy**: la scrive solo il
  webhook con la service role e nessuna sessione deve leggerla. È il
  comportamento voluto, annotato come commento sulla tabella nella `0015`.
- Le chiavi esterne composite risultano «senza indice di copertura». Il linter
  ragiona su un database multi-tenant; qui ogni tabella conterrà centinaia di
  righe, e trenta indici in più costerebbero scritture e spazio senza cambiare
  nulla in lettura.
- **La protezione password compromesse va accesa a mano** in Authentication →
  Providers: è un interruttore del pannello, non una migration.

L'isolamento non è un'affermazione ma un test: `tests/integration/rls-isolation.test.ts`
crea due utenti usa-e-getta, dà dati a uno e verifica che l'altro non riesca a
leggerli, scriverli, modificarli o cancellarli su tutte le 28 tabelle con
proprietario — inclusa la prova che un task non può essere agganciato al
progetto di un altro utente **nemmeno con la service role key**. Si salta da
solo se manca `.env.local`, così `npm test` gira anche offline.

## Struttura

```
src/
  app/            route: (app) autenticato, login, api
  components/     ui (shadcn), layout, dashboard
  lib/
    ai/           provider abstraction, tool registry, context builder
    services/     business logic per dominio
    db/           client, server, admin, repositories
    telegram/     webhook, auth, comandi, notifiche
    automation/   tick, briefing, review, insights
    utils/        date (Europe/Rome), valuta, ricorrenze
  hooks/          valori che esistono solo nel browser
supabase/migrations/
tests/            unit, integration, e2e
```

Il confine da non superare: i componenti React chiamano i servizi, i servizi
chiamano i repository, e nessuna query Supabase vive fuori da `lib/db`.

## Stato

| Milestone | Stato |
|---|---|
| M1 Foundation | completato — schema applicato, RLS verificata, login funzionante |
| M2 Core dati (Inbox, Task, Progetti, Obiettivi, Finanze) | completato |
| M3 Motore AI + Command Bar | completato — verificato con Gemini reale |
| M4 Telegram | completato — **fine MVP**; manca solo il token del bot per la prova dal telefono |
| M5 Calendario, Abitudini, Diario, Persone, Tempo | completato |
| M6 Automazioni, review, insight | completato |
| M7 Rifinitura, ⌘K, ricerca globale, export | completato — tema, palette, focus sul risultato, export, pagine di errore, header di sicurezza |

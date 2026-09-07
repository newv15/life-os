# Liste — design

Data: 2026-09-07 · Stato: approvato

## Contesto

Serve un dodicesimo modulo: liste di cose da spuntare. La spesa, i libri da
leggere, i film da vedere, cosa mettere in valigia.

Il valore principale non è la schermata ma la frase detta al bot mentre
cammini: «aggiungi latte, pane e caffè alla spesa». La schermata serve a
guardarle da fermo — tipicamente in piedi, al supermercato, con una mano sola.

### Cosa è stato chiesto, esattamente

Due domande poste, due risposte che restringono il progetto:

1. **Solo spuntare voci.** Niente valutazioni, autori, registi, anni. Una voce è
   testo, e o è spuntata o non lo è. «Dune, Villeneuve, 8/10» resterà una
   stringa: il sistema non saprà rispondere a «che film ho visto sopra il 7», e
   va bene così. Si può aggiungere dopo; toglierlo dopo, no.
2. **Il comportamento dipende dalla lista.** La spesa si svuota e si riusa; i
   film tengono lo storico. Deciso alla creazione della lista, non per voce.

## Decisioni

### Due tabelle, non una

Le voci non sono un campo di testo dentro la lista. Con un blocco unico,
spuntare una riga significa riscrivere tutta la lista — e da telefono, con due
persone che aggiungono cose in momenti diversi, è il modo di perdere pezzi.

### Un istante, non un booleano

Una voce spuntata registra **quando** (`checked_at`), non *se*. Costa lo stesso
e conserva un'informazione che un `boolean` butta via per sempre: quando è stata
fatta la spesa, in che ordine sono state prese le cose.

### Il nome della lista è unico, senza maiuscole

`unique (user_id, lower(name))`. Quando dici «aggiungi alla spesa» non devono
esistere una «Spesa» e una «spesa» fra cui il modello deve indovinare — e non
deve poterne creare una seconda per errore di battitura.

### Il modello può creare una lista, non un dato

Regola generale del sistema: l'AI non inventa mai dati, e se non risolve un
riferimento contro dati reali, chiede. Una lista è l'eccezione motivata: non è
un dato ma un contenitore vuoto, la creazione è visibile nell'eco della risposta
(«Ho creato la lista Regali e ci ho messo tre cose») ed è banalmente
reversibile.

C'è anche una ragione pratica: il piano gratuito di Gemini conta le richieste,
e ogni domanda al modello costa un giro. Una lista nuova non vale un giro.

### Scartate

- **Riusare i task.** «Latte» non è una cosa da fare. Un task porta priorità,
  scadenza, sei stati e i promemoria del tick: tutto peso che una voce di lista
  non vuole, e un modello che combatte l'uso.
- **Riusare `notes`.** La tabella esiste, è vuota e non è collegata a niente,
  ma una nota è titolo più corpo — un'altra forma. Resta dov'è, per quando
  serviranno gli appunti veri.

## Schema (migration 0016)

```
lists
  id, user_id
  name           text not null
  keeps_history  boolean not null default false   -- false = si svuota
  archived_at    timestamptz
  position       integer
  created_via, created_at, updated_at
  unique (user_id, lower(name))
  unique (id, user_id)        -- per la FK composita delle voci

list_items
  id, user_id
  list_id     uuid not null
  text        text not null
  checked_at  timestamptz
  position    integer
  created_via, created_at, updated_at
  foreign key (list_id, user_id) references lists (id, user_id) on delete cascade
```

La chiave esterna è **composita** come tutte le altre del progetto: il database
rifiuta di attaccare la voce di un utente alla lista di un altro anche quando la
RLS è scavalcata dalla service role. `on delete cascade` perché una voce senza
la sua lista non significa niente.

RLS attiva su entrambe con la policy uniforme `user_id = auth.uid()`.

## Strumenti AI (4 nuovi, totale 32)

| Strumento | A cosa serve |
|---|---|
| `add_to_list` | Aggiunge una o più voci. Crea la lista se non esiste, dicendolo. |
| `check_list_item` | Spunta una voce, risolta per testo contro le voci reali. |
| `show_list` | Legge una lista, o l'elenco delle liste se non ne nomini una. |
| `clear_checked` | Toglie le voci spuntate. Solo per le liste che si svuotano. |

`check_list_item` risolve il testo contro le voci esistenti con lo stesso
meccanismo già usato per categorie e progetti: se non risolve, chiede — perché lì
un errore spunterebbe la cosa sbagliata.

## Schermata `/liste`

Elenco delle liste; dentro ciascuna, le voci con le caselle e in cima un campo
per aggiungere — l'unica cosa che si fa davvero da fermi. Le spuntate scivolano
in fondo, barrate. Per le liste che si svuotano, un pulsante «Svuota le
spuntate».

Navigazione: gruppo **Giornata** nella barra laterale, dietro «Altro» sul
telefono. La barra in basso ha quattro posti già occupati e non se ne toglie uno
a scatola chiusa: se la lista della spesa si rivelerà la schermata più aperta in
piedi, si promuove allora.

## Verifica

- Test di isolamento estesi alle due tabelle nuove: l'utente A non legge, non
  scrive e non modifica le liste di B, **nemmeno con la service role**, e una
  voce non può essere agganciata alla lista di un altro.
- Test dei servizi: creazione, aggiunta multipla, spunta, svuotamento; e che
  `clear_checked` non tocchi una lista che tiene lo storico.
- Test degli strumenti AI: la lista creata al volo, la voce risolta per testo,
  il rifiuto quando il testo non risolve.
- Prova reale dal telefono: creo una lista, aggiungo tre voci, ne spunto una, la
  svuoto.

## Fuori perimetro

Valutazioni, autori, generi, anni. Liste condivise con altre persone. Ordinamento
manuale trascinando (la posizione c'è nello schema, l'interfaccia per cambiarla
no). Promemoria legati a una lista.

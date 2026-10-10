# Spiral

Due pagine indipendenti, stessa idea: il contenuto corrente genera le keyword per
scegliere quello successivo. Schermo pieno, nessun controllo visibile di default.

- Video Internet Archive: `index.html` (alias `idex.html`).
- Immagini Wikimedia Commons: `commons.html`.

## Avvio

Dal repository: `python3 spiral/server.py`.

Apri http://127.0.0.1:8080/ per i video oppure
http://127.0.0.1:8080/commons.html per le immagini.

Mac: doppio clic su `Avvia Spiral.command`; Windows: `Avvia Spiral.bat`.
Servono Python 3.10+ e Internet, senza pacchetti aggiuntivi o chiavi API.
Il launcher apre la pagina video; la variante immagini è all'indirizzo sopra.
Tieni aperto il terminale; Ctrl+C ferma il server. `--port 8090` cambia porta,
`--open` apre il browser. Non aprire direttamente l'HTML come file://.

## Tastiera

- **I**: pannello diagnostico, nascosto di default. Oggetti → query → contenuto,
  esito del collegamento, parola evidenziata nel campo realmente corrispondente,
  tentativi, query in corso, modello, fonte, licenza, titolo e file.
- **W**: solo parole riconosciute, nascosto di default. Helvetica bianco 20 pt,
  interlinea 108%, zero animazioni. Appaiono istantaneamente; scompaiono una alla
  volta dopo circa 4,8 / 5,7 / 6,6 secondi. Nuove parole a ogni nuova analisi.
- I e W si escludono a vicenda. Il clic sul contenuto richiede il fullscreen.
- Video: il clic abilita anche l'audio; M alterna l'audio. Esc esce dal fullscreen.

## Catena verificata

1. Solo il primo contenuto è casuale.
2. MobileViT Small q8, via Transformers.js/WASM in un Worker, riconosce un
   fotogramma del video oppure l'intera immagine Commons. I pixel restano locali.
3. Usa le etichette con score almeno 6%, i loro sinonimi e alcune famiglie più
   ampie. Fino a 16 keyword per analisi. Non sono descrizioni certe dell'immagine.
4. Video: poche keyword, una query per keyword su titolo/descrizione/soggetti
   insieme, tutto il catalogo video pubblico, prima pagina per rilevanza. Tra
   le corrispondenze verificate preferisce titolo, descrizione, soggetti.
   Commons: tutte le keyword nel titolo, poi descrizione, poi categorie.
5. Prima di caricare un candidato verifica la keyword come parola/frase completa
   nel campo richiesto. Un risultato del motore senza prova letterale è scartato.
6. Solo un candidato con corrispondenza verificata e caricamento riuscito sostituisce
   il corrente. Il pannello conserva la query che l'ha scelto, anche durante la
   ricerca successiva, ed evidenzia il testo con `<mark>` senza markup remoto.
7. Video: se il correlato non è pronto entro 60 secondi, cambia al filmato
   di riserva in memoria, dichiarandolo senza fingere una correlazione.
   Commons: la stessa immagine resta visibile e si riprova.

La scelta tra i risultati della ricerca resta casuale. Si campiona una pagina per
query, con fino a 20 candidati e ultimi 40 contenuti esclusi: non è una scansione
esaustiva del catalogo. Un match testuale verificato non garantisce equivalenza
semantica (washer può essere una rondella o una lavatrice). Nei video non prova
che l'oggetto sia visibile proprio al punto casuale riprodotto. Nessun catalogo
può garantire che ogni keyword produca una successione infinita di risultati.

## Video / Internet Archive

Ricerca e seme casuale nel catalogo video pubblico completo. Advanced Search
seleziona identificatori; Metadata API risolve MP4 e metadati. Priorità alle
corrispondenze nel titolo, poi descrizione e soggetti. Scarta file privati,
video sotto 4 secondi e file oltre 80 MiB (`config.js`). Per il primo filmato
e la riserva casuale seleziona file sotto 12 MiB e almeno 30 secondi.

Ogni MP4 è scaricato interamente in un Blob prima del cambio. Il primo avvio
attende un solo download. Una nuova riserva casuale viene preparata in parallelo;
non si torna al video precedente. La ricerca correlata analizza altri fotogrammi
se necessario, fino a 120 secondi. Se manca il correlato usa la riserva pronta;
se manca anche quella, il corrente continua in loop fino a un nuovo file pronto.

Le richieste usano direttamente gli endpoint ufficiali Archive:
`advancedsearch.php`, `/metadata/` e `/cors/`. GitHub Pages è sufficiente e non
richiede un backend. Il server Python è opzionale per aprire la pagina in locale;
il relay rimane disponibile ma non viene usato dal lettore.

## Immagini / Wikimedia Commons

Pagina separata: `commons.html`; logica in `commons.js` e `commons-api.js`.
MediaWiki Action API: generator=random per il seme iniziale, generator=search nel
namespace File con filetype:bitmap per i successivi; imageinfo/extmetadata per
miniature, descrizioni, categorie, autore e licenza. Mostra JPEG, PNG, WebP e GIF,
esclude video/SVG. Richieste dirette con origin=* e immagini crossOrigin=anonymous;
CORS verificato sulle miniature pubbliche. Nessuna modifica al proxy Archive.

L'immagine successiva è caricata e decodificata fuori schermo. La corrente resta
visibile finché la nuova è pronta; almeno 8 secondi tra i cambi. Il modello può
confondere gli oggetti e i metadati possono mancare o essere in altre lingue.
Commons rende più pratico associare un'intera immagine ai suoi metadati; non è
una garanzia di riconoscimento corretto. Fonte, autore e licenza nel pannello I.

## Diagnostica e verifica

`window.spiral` contiene stato, selezione verificata, ricerca in corso e cronologia
(limitata a 200 contenuti, solo in memoria). Ultimo errore azzerato a ogni cambio
riuscito. I file multimediali non vengono salvati su disco.

```sh
node --experimental-default-type=module --test spiral/archive.test.mjs spiral/commons-api.test.mjs spiral/shot.test.mjs
python3 -m py_compile spiral/server.py
```

Diagramma: `processo.html` / `processo-spirale.svg` (schema video).
Licenze variabili per singolo contenuto, leggibili attraverso le fonti.

## Fonti

- https://archive.org/developers/
- https://huggingface.co/Xenova/mobilevit-small
- https://github.com/huggingface/transformers.js
- https://www.mediawiki.org/wiki/API:Imageinfo
- https://commons.wikimedia.org/wiki/Commons:API/MediaWiki
- https://commons.wikimedia.org/wiki/Help:Search

## Aggiornamento: ricerca video e limite di 60 secondi

La pagina video ora cerca **tutti i filmati pubblici di Internet Archive**, non
solo le tre collezioni usate per il seme casuale iniziale. Usa al massimo sei
keyword utili (es. cash machine, atm, cellular telephone, telephone, phone),
con una sola query su titolo/descrizione/soggetti per keyword. Prende la prima
pagina per rilevanza, espone il numero totale reale dei risultati, verifica i
metadati e preferisce corrispondenze nel titolo, poi descrizione e soggetti.
Le descrizioni precedenti di ricerca campo-per-campo restano valide per Commons.

Prima di partire la versione video carica due filmati distinti. Il primo avvio
può quindi richiedere più tempo. Ogni inquadratura dura almeno 12 e al massimo
60 secondi: se un correlato arriva prima, taglia al correlato; al limite temporale
annulla la ricerca/download pendente e usa il video locale di riserva. Dopo ogni
cambio, il precedente resta in memoria come nuova riserva, già riavvolta. Senza
rete i due filmati locali possono alternarsi. Il pannello distingue esplicitamente
il cambio per scadenza da un collegamento verificato: non dichiara una correlazione
quando non c'è. I timer dipendono dalla normale esecuzione del browser (una scheda
sospesa o un dispositivo in sleep non può rispettare una scadenza in tempo reale).
Non cancella il contenuto corrente mentre aspetta il nuovo. `MAX_SHOT_SECONDS` è
in config.js. Restano limiti di durata minima, memoria e MP4 compatibili: un
risultato di ricerca può essere scartato se non è riproducibile.


Aggiornamento lettore Archive (120 secondi): ricerca su tutto il catalogo pubblico `mediatype:movies`, primi 20 risultati per rilevanza, corrispondenza letterale verificata con priorità titolo/descrizione/soggetti. Avvio con un solo filmato; riserva casuale nuova caricata in parallelo, mai il video precedente. Per avvio e riserva si preferiscono file sotto 12 MiB. Il correlato pronto entra subito (dopo un minimo di scena); dopo 120 secondi si usa la riserva se pronta. Se anche la riserva è ancora in download, il video corrente continua: 120 secondi è un obiettivo, non un limite garantito durante problemi di rete. I video brevi possono ripetersi in questa emergenza. Il pannello I mostra la ricerca in cima, tempo trascorso e stato della riserva; resta nascosto all’avvio.


### Pubblicazione statica / GitHub Pages

Carica la cartella `spiral` completa e apri `spiral/index.html` dal sito pubblicato. Non occorre avviare Python né configurare un backend: ricerca, metadati e video vengono richiesti direttamente a Internet Archive. L’endpoint video `/cors/` permette il download e l’analisi dei fotogrammi da un altro dominio; `/download/` può reindirizzare a nodi senza questi permessi. Il server Python rimane opzionale per aprire il sito in locale. Dopo aver pubblicato la correzione ricarica la pagina per scaricare il nuovo JavaScript.


## Hosting statico e video già visti

Ricerca, metadati e MP4 usano gli endpoint ufficiali Archive (`advancedsearch.php`, `/metadata/`, `/cors/`): funzionano sia via HTTP in locale sia su GitHub Pages, senza relay. Pubblica l’intera cartella. In locale puoi usare il launcher o `python3 -m http.server`; l’apertura diretta `file://` richiede invece il launcher per i moduli e il worker.

Gli identificatori incontrati vengono registrati in un insieme senza limite di 40/200 video, persistito in localStorage e condiviso tra Spiral e Dreamachine sullo stesso dominio. La lista informativa può restare limitata senza cancellare questa memoria. I risultati già visti vengono scartati e ricontrollati prima del taglio, comprese le riserve casuali. Anche ricaricando la pagina non vengono proposti di nuovo, finché non cancelli i dati del sito. Domini e dispositivi diversi hanno memorie separate; copie dello stesso film caricate su Archive con identificatori diversi non sono riconoscibili come duplicati da questo controllo. Se lo storage non è disponibile la memoria vale per la sessione corrente.

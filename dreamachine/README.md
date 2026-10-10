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
4. Prova tutte le keyword **nel titolo**, poi **nella descrizione**, poi **nei
   soggetti/categorie**. Le query composte sono frasi, non OR tra parole.
5. Prima di caricare un candidato verifica la keyword come parola/frase completa
   nel campo richiesto. Un risultato del motore senza prova letterale è scartato.
6. Solo un candidato con corrispondenza verificata e caricamento riuscito sostituisce
   il corrente. Il pannello conserva la query che l'ha scelto, anche durante la
   ricerca successiva, ed evidenzia il testo con `<mark>` senza markup remoto.
7. Se non trova una corrispondenza, il corrente continua: nessun ripiego casuale.
   Riprova dopo una pausa. I video analizzano nuovi fotogrammi e accumulano fino a
   24 keyword con la loro provenienza; le immagini riutilizzano la stessa immagine.

La scelta tra i risultati della ricerca resta casuale. Si campiona una pagina per
query, con fino a 20 candidati e ultimi 40 contenuti esclusi: non è una scansione
esaustiva del catalogo. Un match testuale verificato non garantisce equivalenza
semantica (washer può essere una rondella o una lavatrice). Nei video non prova
che l'oggetto sia visibile proprio al punto casuale riprodotto. Nessun catalogo
può garantire che ogni keyword produca una successione infinita di risultati.

## Video / Internet Archive

Collezioni: prelinger, home_movies, prelingerhomemovies. Advanced Search seleziona
identificatori; Metadata API risolve MP4 e metadati. Priorità alle derivate 512 kbps.
Scarta file privati/limitati, video sotto 4 secondi e file oltre 80 MiB: parametri in
`config.js`. Ogni MP4 è scaricato interamente in un Blob prima del cambio. Due
lettori: il corrente continua in loop durante inferenza e download. Il taglio
avviene dopo almeno 12–20 secondi e un fotogramma decodificato del nuovo video.
Solo allora libera il vecchio file. I corti partono dall'inizio; i lunghi lasciano
almeno 30 secondi dopo il punto casuale. Il primo avvio attende un download completo.

Il server Python inoltra JSON e MP4 da Archive e preserva Range/Content-Range;
serve perché i video verificati non espongono CORS per il canvas. Ascolta soltanto
su loopback. GitHub Pages da solo non basta per la variante video. Il server è
un prototipo locale, non un servizio pronto all'esposizione pubblica.

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
node --experimental-default-type=module --test spiral/archive.test.mjs spiral/commons-api.test.mjs
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


## Hosting statico e video già visti

Ricerca, metadati e MP4 usano gli endpoint ufficiali Archive (`advancedsearch.php`, `/metadata/`, `/cors/`): funzionano sia via HTTP in locale sia su GitHub Pages, senza relay. Pubblica l’intera cartella. In locale puoi usare il launcher o `python3 -m http.server`; l’apertura diretta `file://` richiede invece il launcher per i moduli e il worker.

Gli identificatori incontrati vengono registrati in un insieme senza limite di 40/200 video, persistito in localStorage e condiviso tra Spiral e Dreamachine sullo stesso dominio. La lista informativa può restare limitata senza cancellare questa memoria. I risultati già visti vengono scartati e ricontrollati prima del taglio, comprese le riserve casuali. Anche ricaricando la pagina non vengono proposti di nuovo, finché non cancelli i dati del sito. Domini e dispositivi diversi hanno memorie separate; copie dello stesso film caricate su Archive con identificatori diversi non sono riconoscibili come duplicati da questo controllo. Se lo storage non è disponibile la memoria vale per la sessione corrente.

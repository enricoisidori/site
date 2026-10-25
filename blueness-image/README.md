# Blueness image

Dal 23 ottobre: questa è la pagina fotografica, spostata da `blueness` a `blueness-image`. La versione video è ora in `../blueness/index.html`. L’SVG attivo dice VIDEOS su richiesta; la variante IMAGES resta conservata nel sorgente e commentata negli HTML generati. La prova separata con fotogrammi è stata rimossa. Le note storiche sotto descrivono anche iterazioni precedenti.

Aprire `index.html` nel browser oppure pubblicare la cartella su un server statico/GitHub Pages. La pagina contiene una piccola animazione iniziale locale; Internet serve al flusso di immagini nuove.

Immagini casuali di Internet Archive, verificate sul blu con lo stesso rilevatore di Blueness: zoom e posizionamento mantengono il quadrato fisso al centro. Nessuna dissolvenza. L’SVG appare sopra una breve sequenza locale già verificata, con il blu inquadrato sotto il quadrato; poi prosegue il flusso delle immagini selezionate live; durante una carenza rimane l’ultima immagine. Target 4 immagini/s, regolabile fino a 10; il ritmo reale dipende da rete e percentuale di immagini compatibili. Miniature Archive già leggere, senza originali; analisi a massimo 160 px di default, 8 preparazioni simultanee, fino a 12 immagini pronte. I caricamenti delle immagini oltre 4 secondi vengono annullati per liberare le corsie. Esclusioni politiche/USA nella query sul server; anti-ripetizione persistente condivisa con le altre varianti Blueness.

La ricerca live viene avviata prima della costruzione dei controlli e dello SVG e prima della decodifica della raffica. La prima query richiede candidati Archive con `subject:blue`, mantenendo i filtri e la successiva verifica dei pixel; poi continua il flusso generale con il consueto recupero colore. Nessuna lista di fotografie viene caricata o usata per le prime due immagini: il primo fotogramma dopo la raffica è un risultato remoto della ricerca corrente. Entra appena scaricato, decodificato e verificato, senza timer minimo, senza aspettare un secondo risultato e con anti-ripetizione attiva. In parallelo compare la raffica a20/s da un unico JPEG locale con67 inquadrature: resta separata dalla coda live e termina al primo risultato oppure al massimo5s; allo scadere senza risultati viene cancellata, evitando una falsa foto live ferma. SVG via sul primo risultato Images, bordo bianco presente. La ricerca usa una query per volta e fino a8 download simultanei, massimo12 fra pronti e preparazioni. `blueStartupTiming` espone ricerca (`searchAt`), risposta (`resultsAt`), prima decodifica (`loadedAt`), primo pronto (`readyAt`) e primo disegno (`paintedAt`). Nessun encoder è attivo durante la visione.

C: controlli di colore, dimensioni/zoom, velocità, qualità, archivi e doppio schermo. Spazio: pausa/riprendi; frecce: cronologia; clic/tocco sull’immagine: nessun salto; F: schermo intero. `?dual=1` simula due schermi; `?source=commons` e `?source=both` cambiano la sorgente (anche da C). La fonte dell'immagine corrente è collegata nei controlli.

Confronto del 23 ottobre 2026: due prove da 30 s per fonte, contesti browser nuovi e paralleli, senza catalogo iniziale, stessi parametri. Dopo aver evitato il riuso dello stesso batch casuale Commons: Archive 47 e 39 immagini mostrate; Commons 12 e 7. Primo elemento: Archive 9,20 e 2,85 s; Commons 10,25 e 11,44 s. Scelta predefinita: Archive. Campione piccolo e variabile, non una garanzia di prestazioni. I risultati completi sono in `tools/blueness-stills-benchmark.json`. Le miniature mancanti o scadute vengono scartate.

Per rigenerare solo questa pagina: `node tools/build-blue.mjs base` (non riscrive Wiki né Movements). I sorgenti condivisi sono in `tools/blue-flow.js`. L’avvio live è documentato sotto.

## MP4 della sessione · G

G scarica `blueness.mp4` a 1080×1440 px, senza audio, con tutte le immagini effettivamente mostrate nella sessione, in ordine di prima apparizione. Tornare indietro nella cronologia non duplica un'immagine. Nessuna selezione né taglio. La porzione centrale in 3:4 mantiene il posizionamento mostrato, compreso il quadrato; i controlli sono esclusi. Ogni immagine dura 0,1 s; in C → esportazione MP4, lo slider varia da 1/60 s (circa 0,017 s) a 2 s, in passi di un fotogramma su una griglia di 60 fps (0,1 s = 6 fotogrammi). La preferenza resta nel browser. Lo stato mostra numero immagini, durata prevista e avanzamento dell'esportazione.

Si conservano in memoria una copia JPEG della sorgente già caricata e il suo posizionamento, senza nuovi download. Il montaggio e la codifica avvengono solo su richiesta: la visione si mette temporaneamente in pausa e riprende alla fine se era in corso. Q annulla l'elaborazione. Esportare non svuota la sessione: un successivo G comprende anche le nuove immagini; ricaricare la pagina comincia una sessione nuova.

Riduzione dati: le immagini Archive arrivano come miniature native, senza scaricare gli originali né i loro metadati. Su Commons vengono richieste miniature della larghezza scelta senza metadati estesi. La riduzione a 160 px nel browser non riduce i byte di una miniatura Archive già scaricata: serve soprattutto a risparmiare analisi e memoria. Per scoprire il blu occorre comunque ricevere almeno i pixel della miniatura; l’animazione iniziale è disponibile senza rete; le immagini nuove dipendono dalla risposta di Archive.

## Esclusioni a monte

Blueness immagini applica nella ricerca server, su entrambe le fonti, esclusioni per Trump, MAGA, campagne elettorali, politica, partiti, elezioni, presidenza e altri riferimenti politici. I termini geografici USA/United States/US sono limitati ai campi descrittivi pertinenti: su Archive titolo, soggetti e autore; su Commons titoli e categorie dirette, senza scansionare le licenze nel browser. Su Archive sono esclusi anche identificativi `usgov*`. Le diciture di copyright USA, da sole, non devono eliminare immagini estranee a quel paese. Nessun download aggiuntivo di metadati e nessuna classificazione testuale dopo il download delle immagini. Le query possono comunque avere costi diversi sul server; un filtro testuale non riconosce immagini prive di indicazioni utili.

Nessuna collezione/uploader è favorito esplicitamente. Il campionamento Archive usa prefisso casuale dell'identificativo, batch ordinati e, dopo aver conosciuto il totale, pagine casuali entro la finestra di 10.000 risultati: non è un campionamento uniforme di tutti gli item. I batch possono raggruppare molti elementi di un singolo uploader; anche l'accettazione del blu introduce una selezione visiva. Commons usa ricerca filtrata con ordinamento casuale, perché il generatore casuale puro non supporta le esclusioni testuali.

Le parole politiche sono elencate esplicitamente, con varianti plurali, per evitare l'effetto restrittivo dei wildcard negativi osservato su Commons. Verifica live della query finale su Commons: oltre 120 milioni di immagini candidate al momento della prova. Non è una garanzia che ogni immagine politica venga riconosciuta dai metadati, né di tempi server identici alla ricerca senza filtro.

## Diagnostica e coda

In C sono visibili il tempo medio dei caricamenti riusciti, il tempo medio del controllo blu, i timeout accumulati e il numero di ricerche di recupero tramite tag colore. “0/12 pronti” può significare che ogni immagine compatibile viene immediatamente consumata dalla riproduzione: i contatori “in preparazione” e “analisi” indicano il lavoro in background. L’ultimo errore di caricamento viene cancellato dopo un nuovo caricamento riuscito, mentre i contatori degli errori rimangono visibili.

Per le immagini Archive non si richiedono metadati o originali neppure aumentando il parametro qualità: si resta sulle miniature. L’analisi disegna direttamente la miniatura al livello di dettaglio richiesto, senza un giro di conversione JPEG/rilettura. Si ferma al primo quadrato che supera le stesse soglie di colore e copertura, invece di valutare tutti i quadrati validi per scegliere quello col punteggio massimo. La maggior parte dei batch rimane generale; quelli di recupero hanno priorità temporanea quando non c'è una riserva pronta.

Una misura live prima di questi interventi: 145 immagini analizzate in 25 s, 6 compatibili, media caricamento circa 1077 ms contro circa 0,65 ms di analisi blu. Sono dati diagnostici di una singola sessione, non un confronto controllato o una promessa di velocità.

## Variante Commons e alta risoluzione

`blueness-wiki.html`, nella radice del sito, è una pagina autonoma con le stesse funzioni, ricerca Commons predefinita e miniature iniziali da 120 px. Ha preferenze di qualità separate dalla versione Archive. `node tools/build-blue.mjs stills` rigenera entrambe.

Su entrambe: tenere A e premere G esporta il montaggio con sorgenti di qualità maggiore, sempre a 1080×1440 e con la durata corrente. G da solo usa le miniature già viste. A+G richiede le immagini grandi esclusivamente durante il montaggio (Commons: variante richiesta a 1920 px; Archive: originale raster identificabile della stessa miniatura, fino a 32 MB). Scarica e decodifica una sorgente alla volta, mantenendo il ritaglio e la posizione registrati. Stato di caricamento e montaggio visibile in alto e in C. Q annulla. Il file è `blueness-hq.mp4` oppure `blueness-wiki-hq.mp4`.

L'originale viene verificato confrontando proporzioni e una piccola impronta visiva con la miniatura. Se non è identificabile con certezza, non è più grande, differisce dalla miniatura o non è raggiungibile, si conserva la miniatura: il riepilogo distingue immagini HD e miniature mantenute. Non è un aumento artificiale della risoluzione. Il codice dedicato è in `tools/blueness-highres.js`, incluso come sole funzioni dormienti per mantenere gli HTML apribili anche da file. Durante la visione non effettua richieste aggiuntive e conserva soltanto pochi riferimenti alla sorgente per ogni immagine già catturata.


## Avvio live e ripetizioni · versione base

La pagina incorpora un solo JPEG di avvio di circa148KiB più le coordinate della raffica. `blueness/startup.jpg` e `blueness/startup.json` sono preparati offline da `tools/build-blueness-startup.mjs`:67 dei99 originali restano validi dopo compressione. L’HTML non incorpora il catalogo99, non richiede file `.image.js` e non carica fotografie locali nella coda live. L’unico bitmap della raffica viene rilasciato all’avvio live; la pool dell’intro può ripetersi fra aperture in ordini diversi, mentre il live mantiene la memoria anti-ripetizione. La raccolta JSON da C contiene i nuovi match della sessione, senza fotogrammi della sigla.

Oltre all’indirizzo, si registra una piccola impronta dei pixel normalizzati della miniatura. Impedisce che la stessa miniatura entri due volte nella coda con indirizzi diversi; non richiede altri download né confronti fra tutte le immagini. L’impronta non riconosce necessariamente ritagli o versioni ricompresse/modificate della stessa fotografia. La cronologia persiste nel browser; salvataggi incrementali evitano di serializzare una lista crescente quattro volte al secondo. Cancellare i dati del browser elimina anche questa memoria; la cronologia manuale con le frecce resta consultabile.

Il clic/tocco sull’immagine non salta più alla successiva. Restano le frecce e i controlli in C. Alle esclusioni server si aggiungono “Capitol Attack” e “Capitol Hill”, solo nella versione base. I metadati mancanti possono comunque non segnalare un soggetto politico.

C permette di scaricare la raccolta verificata come JSON, compresi i nuovi candidati trovati nella sessione. `tools/collect-blueness-images.mjs` aggiorna separatamente `tools/catalogs/blueness-images.json`: nessuna scansione extra parte nel sito. Non si ricaricano i candidati della vecchia cache browser.

Se presente, `blueness/intro.svg` viene incorporato e appare su sfondo trasparente sopra la sequenza locale. Dopo la sigla resta sopra la prima immagine live. La prima immagine viene disegnata senza bordo bianco, per evitare sovrapposizioni con il quadrato dell’SVG. L’SVG si rimuove nel medesimo frame in cui viene disegnata la seconda, con il bordo normale ripristinato e senza timer di uscita. Il clic/tocco può chiuderlo manualmente senza saltare immagini. Nessun cambio della pausa manuale o salto alla chiusura. Non viene dipinto un segnaposto nero/quadrato blu prima delle immagini nella versione base.

Su telefoni/tablet con puntatore touch compare una piccola “c” per aprire i controlli senza tastiera. Il rendering resta alla dimensione dello schermo in pixel CSS, senza moltiplicare il carico per la densità del display.

Esclusione esplicita nella versione base: `AND NOT subject:"January 6 Capitol Attack"`. Verifica separata della riserva: rimossi 21 item su 120, restano 99 candidati verificati. SVG fornito dall’utente copiato in `intro.svg` e incorporato nell’HTML.

L’intro attuale usa l’SVG `here.svg` fornito dall’utente, copiato in `blueness/intro.svg`. Il rettangolo `data-blue-anchor` ne definisce il quadrato di riferimento: il runtime scala e posiziona tutta la grafica affinché quel quadrato coincida con il centro e la dimensione del quadrato della scena. Il quadrato resta fermo e segue soltanto la dimensione impostata. Testo e freccia hanno gruppi separati, adattati allo spazio libero della pagina con margini laterali e superiori. La punta rimane a 16 px dal bordo superiore del quadrato; anche la distanza testo-freccia è fissa a 16 px. Il layout segue resize e primo schermo nel doppio layout, senza font esterni. Lo stesso layout viene usato nel video, adattato al formato 1080×1440.

## Export con intro · V

- **V**: stesso montaggio di G, preceduto dalla sigla effettivamente vista (ordine, tempi rapidi e attesa iniziale); SVG anche sulla prima immagine live, assente dalla seconda. File `blueness-intro.mp4`.
- **V+A**: stessa versione con recupero HD delle immagini della sigla e del live, con i controlli di equivalenza e i fallback già usati da A+G. File `blueness-intro-hq.mp4`.
- **V+L**: soltanto la sigla estesa, tutta la pool di 67 immagini mescolate, 0,1 s per immagine: 6,7 s totali, sempre con SVG. File `blueness-intro-long.mp4`.
- **V+L+A**: sigla estesa con recupero HD. File `blueness-intro-long-hq.mp4`.

Le combinazioni V funzionano in qualunque ordine tenendo premuti i tasti e rilasciando V. A e L vengono memorizzati per quella combinazione anche se rilasciati prima. G/A+G restano invariati. C contiene anche i pulsanti degli export V. Tutti i file restano 1080×1440, senza audio; Q annulla e lo stato precedente di pausa viene conservato. La durata delle immagini live in V segue lo slider di G; la sigla normale conserva il proprio tempo, quella estesa usa 10 immagini/s.

Durante la visione si aggiungono solo piccoli record di inquadratura/tempo per ricordare la sigla e un flag per lo SVG sulla prima immagine live. Rasterizzazione dello SVG, estrazione dei fotogrammi dal JPEG, encoder e recuperi HD avvengono esclusivamente su richiesta. `tools/blueness-intro-layout.js` gestisce geometria comune; `tools/blueness-intro-export.js` gestisce i video con durate variabili e sovrapposizione vettoriale. I metadati del foglio includono l’area originale dell’immagine prima delle bande nere, così il recupero HD confronta proporzioni e pixels della fotografia corretta.

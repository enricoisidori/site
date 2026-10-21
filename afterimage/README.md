# afterimage

Cerca nell’intero indice dei film Internet Archive, senza ordinamento per popolarità.

Questa cartella è la versione per GitHub Pages e Live Server. Per l'apertura diretta senza server usare ../afterimage-local/index.html. Le copie locali sono generate dagli stessi sorgenti e non hanno pulsanti di avvio.

Descrizione locale del fotogramma → keyword → ricerca nel titolo → video. Limite assoluto 30 s; il successore della query parte appena pronto, anche prima. Nessun loop. Streaming nativo con riserve precaricate.

C apre informazioni e catena (I resta un alias). ← / → navigano nella cronologia; dopo l’ultimo video → riprende il flusso. M audio, F fullscreen, fit/fill dal pannello C, S JSON fuori dalla registrazione, E montaggio dai sorgenti, G screen MP4, P PDF. Excel dal pannello C. Dal pannello si può anche copiare la catena e scegliere PDF verticale o quadrato, senza frecce e con due frame per pagina.

Avvio con immagini leggere di Internet Archive in sequenza, senza ripetizioni, e SVG nero. Quando il video è pronto, fondo bianco e SVG sfumano insieme direttamente sul video per 6 secondi, senza intervallo bianco. Buffer iniziale ridotto; il modello parte dopo il primo video. Serve Internet; il modello viene eseguito sul dispositivo.

La catena conserva fino a 2.000 video con link, metadati, keyword e query. I frame già catturati per il modello sono salvati separatamente in IndexedDB, senza ulteriori analisi. PDF ed Excel vengono generati solo su richiesta; la libreria Excel viene scaricata solo al momento dell’esportazione. Excel include immagini incorporate e link alle fonti. I record storici senza frame restano consultabili.

In informazioni si possono disattivare i filtri e selezionare collezioni da escludere. Le scelte persistono nel browser. «scarica default per il sito» produce filter-defaults.js: sostituire il file omonimo in questa cartella per applicare le scelte a tutti, poi rigenerare la copia locale con `node tools/build-local.mjs afterimage`. La pagina non può modificare autonomamente i file pubblicati su GitHub.

Istruzioni complete e limiti della verifica in [VERSIONI-VIDEO.md](../VERSIONI-VIDEO.md). Controllo integrato HTTP e file:// superato con risposte remote simulate; verificate separatamente query reali e importazione reale della libreria. Le vecchie verifiche in VERIFICA.md sono cronologia di sviluppo, non una certificazione di questa revisione.

Backup v2 storico: ../relay-backups/relay-v2-20261012-190105.zip.

Ricerca globale con esclusioni complete su trailer, promozioni, videogiochi, pubblicità, news, podcast, tutorial, compilation e social, applicate a tutti i campi indicizzati. Nessun filtro remoto sui formati. I derivati leggeri riproducibili sono verificati nei metadati.

L’HTML locale occupa tutto il viewport; il fullscreen reale richiede F perché il browser vieta l’attivazione automatica senza interazione.

Un controllo locale di titolo, soggetti e descrizione scarta ulteriori trailer/spot e frasi promozionali prima di caricare il video, senza nuove richieste o modelli.

I video appartenenti a Prelinger partono a metà della durata, anche come primo video, per saltare i titoli iniziali.

Verifica revisione: 10 test unitari superati; avvio HTTP e file://, cronologia, PDF e Excel verificati nel browser con sorgenti e inferenza simulate. PDF renderizzato e controllato, immagini incorporate in XLSX verificate. Questi controlli non misurano la latenza dei server Archive reali.

Gli export afterimage.pdf, afterimage.xlsx e afterimage.json includono solo video mostrati collegati da una keyword effettivamente comune fra descrizione e titolo. Nel PDF servono entrambi i frame; i testi sono selezionabili (Helvetica con caratteri occidentali), le keyword sottolineate. Tentativi di query e passaggi casuali non sono esportati come collegamenti.

Registrazione selettiva: R avvia la sessione; S seleziona la clip corrente includendo la parte già registrata dall’inizio della clip (o dalla pressione di R per la prima); X, dopo S, chiude quella clip nel montaggio senza interrompere la visione. Un secondo R esporta le sole clip selezionate, in ordine, in MP4. Indicatore e pannelli non entrano nella registrazione. S fuori dalla modalità R conserva l’export JSON. Dimensioni impostabili in C, default 1080×1440 px; 25 fps, codifica H.264 nativa; audio AAC originale, anche con pagina muta. Serve un browser con encoder WebCodecs compatibile; in assenza viene mostrato un messaggio, senza falsi file MP4. Ricomposizione locale senza secondo passaggio di codifica.

C → registrazione MP4: larghezza e altezza si conservano nel browser e si applicano alla prossima sessione R. Il contatore in alto indica i video selezionati e si aggiorna immediatamente con S; pressioni ripetute sulla stessa clip non aumentano il numero.

La registrazione conserva sempre l’audio originale dei video, indipendentemente da M, mute o volume della pagina. La sola sorgente audio è la traccia del video: nessun accesso al microfono, alla webcam o ai suoni esterni.

Durante R, D deseleziona la clip corrente ed esclude anche un frammento già tagliato con X. Il contatore scende subito; pressioni ripetute non lo diminuiscono ancora. Prima del taglio, S può selezionare nuovamente la clip.

Q annulla la sessione e scarta tutte le clip, senza generare o scaricare file. La freccia destra taglia la clip selezionata nel punto corrente, come X, poi passa normalmente al video successivo.

C → registrazione MP4: il riquadro sullo schermo mostra esattamente il ritaglio registrato. Altezza in vh, larghezza in vw e centro x/y sono regolabili; le proporzioni seguono la risoluzione di output. Default: 100vh, 3:4, 1080×1440 px (area ridotta solo quando la finestra è troppo stretta). Le impostazioni si conservano nel browser. Il ritaglio può cambiare durante la sessione; risoluzione e proporzioni prima di R. Pannello C, bordo e feedback non entrano nel file.

Spazio mette in pausa/riprende la visione mentre ricerca e precaricamento proseguono. La coda arriva fino a 12 riserve senza aumentare i caricamenti simultanei. In Afterimage le riserve della query corrente hanno precedenza sulle casuali e vengono rinnovate quando cambia la descrizione. Il tempo in pausa non entra nella registrazione; la pausa non garantisce funzionamento offline, perché i media restano in streaming e il buffer dipende dal browser.

R registra anche le istruzioni per ricostruire le clip selezionate. In C → registrazione MP4, “solo istruzioni” disattiva la codifica live: R termina conservando le istruzioni nel browser, E termina la sessione e monta dai sorgenti. S seleziona retroattivamente la clip, D la esclude, X e freccia destra ne fissano la fine. Le istruzioni comprendono URL, intervalli del video, ritaglio, cambi di inquadratura, zoom, doppia vista e bordo dell’opera; pannelli e indicatori restano esclusi. L’ultima sessione completata si conserva in IndexedDB e può essere scaricata/importata come JSON da C. Q scarta la sessione corrente o annulla l’elaborazione in corso.

E carica Mediabunny 1.61.6 solo alla richiesta, legge le porzioni necessarie del media e ricostruisce un MP4 H.264 a 30 fps con audio AAC originale a 256 kbps. Cerca risoluzioni maggiori dello stesso file/filmato quando disponibili, senza cambiare contenuto. Ricostruisce i movimenti registrati come cambi istantanei; non introduce interpolazioni. La qualità resta limitata dalla sorgente; non equivale a un copia-incolla senza ricodifica. L’elaborazione può richiedere tempo e memoria: avviene per una clip alla volta, con cache di lettura limitata a 32 MiB e PCM limitato alla clip corrente; il file MP4 finale resta in memoria. I sorgenti devono essere ancora raggiungibili e supportare lettura dal browser/CORS. In caso di errore non si saltano silenziosamente clip: il montaggio si interrompe e le istruzioni restano disponibili. Chrome/Edge con WebCodecs sono i browser di riferimento. [Documentazione del motore](https://mediabunny.dev/guide/reading-media-files).

G esporta tutti i video visti (anche non selezionati con S) come MP4 rapido di screen, 8 fotogrammi al secondo, senza dissolvenze e senza audio. Usa le dimensioni e il ritaglio correnti della registrazione, default 1080×1440. Riutilizza gli screen già salvati; se in Afterimage manca un frame, lo estrae dalla sorgente solo durante G. La visione si mette in pausa durante E/G e riprende alla fine. Excel in Afterimage resta nel pannello C; il tasto E è assegnato al montaggio dai sorgenti.

In C lo stato MP4 resta visibile anche con la sezione registrazione chiusa: preparazione, lettura sorgenti, audio, video elaborati, percentuale di rendering, finalizzazione, download avviato o errore. L’avanzamento indica il lavoro sui fotogrammi, non la percentuale di byte scaricati; durante la lettura dalla rete mostra la fase e il tempo trascorso. Le istruzioni JSON non vengono scaricate automaticamente con E o R: sono conservate nel browser e restano scaricabili da C. Solo se il salvataggio nel browser non riesce viene scaricato un JSON di backup.

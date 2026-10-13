# afterimage

Cerca nell’intero indice dei film Internet Archive, senza ordinamento per popolarità.

Questa cartella è la versione per GitHub Pages e Live Server. Per l'apertura diretta senza server usare ../afterimage-local/index.html. Le copie locali sono generate dagli stessi sorgenti e non hanno pulsanti di avvio.

Descrizione locale del fotogramma → keyword → ricerca nel titolo → video. Limite assoluto 30 s; il successore della query parte appena pronto, anche prima. Nessun loop. Streaming nativo con riserve precaricate.

I apre informazioni e catena. ← / → navigano nella cronologia; dopo l’ultimo video → riprende il flusso. M audio, F fullscreen, C fit/fill, S JSON, E Excel, P PDF. Dal pannello si può anche copiare la catena e scegliere PDF verticale o quadrato, senza frecce e con due frame per pagina.

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

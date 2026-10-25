# Nomi e percorsi correnti

`blueness/index.html` è la versione video, prima in `bluenessmovements`. `blueness-image/index.html` è la versione fotografica, prima in `blueness`. Il vecchio percorso `bluenessmovements/index.html` resta un alias video. `node tools/build-blue.mjs movements` genera video e alias; `node tools/build-blue.mjs base` genera solo fotografie. `projects` include anche Wiki. I nomi dei cataloghi e le chiavi delle preferenze restano invariati.

La logica desktop conserva coda6, preparazioni2–3 e tracking. C permette intervalli fra cambi video da0,1 a30secondi (default15); un cambio richiede un video pronto. V esporta gli stessi screen di G preceduti dall’intro vista, senza varianti A/L. SVG VIDEOS attivo; SVG IMAGES conservato commentato. Solo iPhone/iPad usano `tools/blueness-ios-video.js`: media inline/muted nel DOM, play prima di attendere loadeddata, codec ricontrollati anche sui candidati salvati, un caricamento per volta e coda2, preload dei video precedenti ridotto a metadata; cronologia conservata. Un pulsante permette di ritentare dal gesto se l’autoplay viene negato. Xcode/simulatore iOS non installati: i test automatici non sono una verifica su Safari iPhone reale.

# Aggiornamento · 23 ottobre 2026

Rimane la registrazione selettiva R con audio, dimensioni/ritaglio e comandi S/D/X/Q, e rimangono P (PDF), J (JPEG) e G (screen MP4). Rimossi E, la modalità solo istruzioni, le timeline dei movimenti, lettura/scrittura IndexedDB e import/export JSON della registrazione. Nessuna istruzione di ricostruzione viene raccolta. Le sezioni storiche su E sono solo cronologia e non descrivono più il comportamento attuale. Il rendering R evita ridisegni duplicati prima del prossimo fotogramma da codificare.

# Stato attuale · 22 ottobre 2026

Blueness non applica esclusioni tematiche: nessun filtro su politica, governi, USA, titoli, categorie o descrizioni. Le vecchie preferenze salvate per tali filtri vengono ignorate. Commons richiede solo i metadati necessari a riprodurre il file e attribuire autore/licenza, senza categorie o testi descrittivi. Le immagini Archive a qualità <=320 px non richiedono metadati aggiuntivi; sopra tale soglia li usano per scegliere una risoluzione adeguata.

Restano il controllo del blu con i parametri del pannello, l'anti-ripetizione e i limiti tecnici per media accessibili e riproducibili (fino a 720p, file Archive sotto 150 MB). Ricerca video generale su Commons e Internet Archive; i tag colore sono solo un recupero occasionale per le immagini. La coda video si ferma a 6 riserve, anche in pausa, con 2–3 preparazioni contemporanee. Afterimage mantiene la propria selezione e coda.

Le sezioni successive documentano anche le iterazioni precedenti; questa nota sostituisce le loro indicazioni su esclusioni tematiche e dimensione della coda Blueness.

# blue

Pagine autonome, apribili con doppio clic e su GitHub Pages. Richiedono Internet, senza server locale o chiavi API.

- blue.html: immagini Wikimedia Commons.
- blue-video.html: video Commons, con tracciamento.
- blue-archive.html: immagini Internet Archive; ricerca per prefissi casuali e pagine casuali entro i primi 10.000 risultati per prefisso. Endpoint Archive /cors per leggere i pixel, senza proxy esterni. A qualità >320 cerca anche un file immagine nei metadati, sotto un limite di peso; la risoluzione effettiva dipende dalla fonte.
- blue-mixed.html: immagini Commons durante la ricerca dei video; ogni video dura al massimo quattro secondi di visualizzazione, anche se il successivo non è pronto. Poi torna alle immagini. Due code indipendenti evitano che una ricerca video impedisca di cercare immagini. Non garantisce un flusso continuo se nessuna fonte restituisce match.

## Filtro e visualizzazione

HSV centrato su tonalità 240° (#0000ff). Ampiezza predefinita ±35°, saturazione minima 55%, luminosità minima 35%, massimo 20% di pixel fuori range dentro il quadrato 50×50. Pixel trasparenti esclusi. Tabella integrale, scansione di tutte le posizioni. Il rilevamento avviene sul media ridotto a massimo 640 px; il lato del quadrato si riferisce a questa risoluzione, prima dello zoom. La qualità richiesta delle immagini è regolabile fra 160 e 1280 px, senza alterare la scala di analisi sopra 640.

In caricamento: sfondo nero, quadrato pieno blu e bordo blu, nessun testo. Quando c’è un match: immagine riposizionata e bordo bianco di 1 CSS px. Cambi istantanei, nessuna dissolvenza. Se il match video scompare, viene nascosto e ricompare il quadrato blu durante la ricerca.

## Controlli

C apre i controlli: lato, ampiezza del blu con gradiente, saturazione, luminosità, disturbo, zoom, immagini/secondo (0,5–10), qualità, durata video e frequenza di analisi video. Le impostazioni sono salvate separatamente per pagina. Link alla fonte corrente direttamente nei controlli. I mostra fonti, autore, licenza e stato. F fullscreen; M audio video.

← / →: cronologia fino a 30 media (massimo quattro video per contenere memoria e buffer). Andare indietro sospende l’avanzamento automatico delle immagini; proseguire oltre l’ultimo media torna al flusso live. I video misti conservano il limite di quattro secondi anche nella cronologia. Clic sullo sfondo = avanti.

Simulazione due schermi: due viewport 16:9 affiancati, immagine a sinistra, soltanto il ritaglio del quadrato a destra. Il pulsante secondo schermo apre una finestra dedicata al ritaglio, da spostare sul secondo monitor. Il browser può richiedere di consentire popup; non sceglie né sposta automaticamente la finestra su un monitor. La finestra principale deve restare aperta.

## Ricerca e limiti

Immagini Commons: 75% dei batch da pagine casuali della ricerca blue, 25% da file casuali globali. Tutti i file vengono verificati sui pixel. Dodici download immagine in parallelo, coda fino a 36 match. Nessun riutilizzo automatico della cronologia. Il ritmo richiesto fino a 10 immagini/s dipende dalla velocità di ricerca, rete e tolleranze; quando non c’è un nuovo match, conserva l’ultima immagine valida.

Video: pagine casuali dei primi 9.000 risultati di filetype:video con esclusioni nella query; derivati riproducibili preferibilmente 360p, due preparazioni parallele. Prova inizio, 2s e 5s prima di accettare; tracking predefinito 8 Hz. Esclude prima del download titolo, categorie e tutti i metadati che indicano governi, ministeri, agenzie, militari, polizia, fonti ufficiali e USA (compresi autore, credito e riferimenti PD-USGov). È un filtro testuale: non certifica l’indipendenza governativa di fonti prive di indicazioni.

Commons contiene media con licenze differenti: fonte, autore e licenza sono visibili in I. Internet Archive non garantisce che ogni immagine sia riutilizzabile liberamente: verificare i diritti nella pagina originale.

Sorgente: tools/blue-flow.js. Build: node tools/build-blue.mjs, che incorpora anche il trasporto Archive. Nessuna dipendenza da cartelle per aprire gli HTML generati.

## Pool combinato e varianti (aggiornamento)

blue.html, blue-video.html e blue-mixed.html usano ora Commons + Internet Archive insieme. Varianti per il confronto: blue-commons.html (immagini Commons), blue-archive.html (immagini Archive), blue-video-commons.html e blue-video-archive.html. In tutte è disponibile il selettore di sorgente nei controlli. I batch delle due fonti vengono richiesti in parallelo e mescolati nella coda, condividendo il filtro pixel. Per i video Archive: metadati item, file MP4/WebM sotto 150 MB, preferenza a derivati 240p/360p/512Kb, streaming tramite endpoint /cors. Nessun download preventivo dell’intero video.

Le esclusioni governative/USA descritte sopra sono adesso FACOLTATIVE e SPENTE di default: nessuna esclusione tematica se la casella non è selezionata. Restano i controlli di accessibilità, formato e peso dei file.

Nuovi parametri colore: rosso massimo relativo al blu (ridurlo elimina viola/magenta), verde massimo relativo al blu (ridurlo elimina ciano), distanza RGB assoluta da #0000ff (ridurla elimina anche blu scuri). Si combinano con tonalità HSV, saturazione, luminosità e disturbo. Default nuovi: ±25°, luminosità minima 45%, rosso <=40% del blu, verde <=65%, distanza RGB <=210. Impostazioni già salvate di tonalità/luminosità vengono conservate.

Aprendo la finestra del secondo schermo i bordi grafici vengono rimossi da TUTTI gli schermi, compresa la simulazione. Tornano chiudendola. Rimane il quadrato pieno blu in attesa di un match.

Storyboard tecnico: blue-installation.svg (vettoriale B/N, tre momenti dell’immagine dietro un materiale opaco con foro fisso). blue-installation.html lo mostra nel browser e richiede il file SVG accanto.

## Coda video e stato in C

Tutte le varianti preparano fino a sei video con match già verificato, con tre preparazioni parallele. La riproduzione non sospende ricerca o analisi dei successivi: consumando un elemento, la coda viene rifornita automaticamente. Restano sospesi i download aggiuntivi quando la coda è piena o la scheda non è visibile.

Il pannello C mostra, separatamente per immagini e video: fase della ricerca, pronti/limite, preparazioni in corso, candidati, analisi, match, scarti e ultimo errore. Si aggiorna ogni mezzo secondo. Questi valori sono disponibili anche in blueStatus.search.

## Zoom automatico e foro fisso

Il lato del quadrato è ora misurato in pixel CSS sullo schermo e resta fisso durante zoom e dezoom. Il rilevamento prova aree sorgente di più dimensioni riusando la tabella integrale: con apertura 50 px, una regione di circa 6 px può essere ingrandita ~8× e una di 100 px ridotta 0,5×. I controlli zoom minimo/massimo delimitano l’intervallo (default 0,5×–8×). Dimensioni sorgente intere, minimo 2 px; scale campionate, non ottimizzazione continua. Nel video tenta prima la scala già scelta per evitare cambi inutili. Immagine e ritaglio sul secondo schermo usano la stessa area sorgente. Nessuna dissolvenza.

Storyboard aggiornato: tre fotografie reali già accettate, incorporate direttamente nello SVG; assonometria sopra, vista frontale attraverso il pannello sotto ogni momento. Fonti cliccabili e riepilogo in blue-installation-sources.json. Il disegno rimane vettoriale per geometrie, testi e linee; le fotografie sono raster.

## Nessuna ripetizione automatica

Tutti i lettori blue condividono blue-played-v1 in localStorage: identità canonica della pagina fonte, senza scadenza né eliminazione dei più vecchi. Verifica all’ingresso della ricerca, a fine preparazione e prima di mostrare; sincronizzazione degli aggiornamenti tra finestre quando il browser emette storage. Una pagina fonte già mostrata non rientra nel flusso automatico, anche dopo il ricaricamento nello stesso spazio di archiviazione del browser. I tentativi della sessione non vengono più rimossi dopo 10.000 candidati. La cronologia manuale con frecce resta disponibile.

Il contatore è in C. La persistenza dipende dai dati del browser (file:// può separarli per file/browser); cancellare i dati elimina la memoria. Se il salvataggio fallisce, lo stato segnala la limitazione e rimane il blocco per la sessione. Identità per fonte: copie caricate con identificativi diversi, anche fra due archivi, non sono confrontate visivamente.

## Simulazione condivisibile, stabilità e preselezione

- Simulazione attiva: URL `?dual=1`. Il controllo aggiorna l’URL senza ricaricare; il parametro ha precedenza sulle preferenze locali. Con due viewport simulati o finestra secondaria aperta, nessun bordo in nessun viewport. La casella “mostra bordo anche con due schermi” permette di ripristinarlo. Il quadrato di caricamento è sempre pieno blu senza bordo.
- Camera video: mantiene centro e scala precedenti se l’area soddisfa ancora il test blu. Se serve un nuovo match, ignora spostamenti inferiori a 10 px sullo schermo (regolabile 0–80); cambi di zoom inferiori al 15% non aggirano questa soglia. Se manca un’area valida, nasconde il video anziché tenere visibile un ritaglio non conforme.
- Trump/politica: esclusione separata, attiva di default e disattivabile in C; governi/USA restano opzionali. Query e metadati su entrambe le sorgenti, immagini comprese. Filtro testuale, senza classificatore visivo.
- Corsie preferenziali (2 batch su 3) per blue, blue sky, underwater, ocean, blue background e blue water; un batch su tre mantiene il pool generale. Commons prova anche `haswbstatement:P462=Q1088 OR blue`. Questo sceglie i candidati da analizzare, senza aggiungere un nuovo requisito al filtro sui pixel. Non è una garanzia di area blu né un archivio completo indicizzato per colore.
- Catalogo locale blue-candidates-v1: fino a 1.000 candidati con match già verificato; al riavvio prepara prima quelli mai mostrati, rieseguendo l’analisi con le impostazioni correnti. Non ricicla media già riprodotti. C mostra la dimensione del catalogo. Nessuna immagine/video incorporata nel catalogo, solo URL e metadati.
- Storyboard: immagini reali scalate e traslate su fondo nero come nella UI (viewport esemplificativo 960×540); quadrato segnato sul display solo per il disegno tecnico. Rimane la vista frontale sotto ogni momento.

Riferimenti verificati: https://commons.wikimedia.org/wiki/Commons:Structured_data/Get_involved/Finding_data · https://www.wikidata.org/wiki/Q1088 · https://archivesupport.zendesk.com/hc/en-us/articles/360018359991-Search-A-Basic-Guide.

## Tracking più stabile

Tolleranza extra solo sul riquadro già agganciato: 15 punti percentuali predefiniti, oltre al disturbo impostato (non allarga il filtro iniziale dei candidati). Soglia movimento predefinita 18 px; il vecchio default 10 viene aggiornato a 18. Una nuova inquadratura richiede tre rilevamenti coerenti e almeno 1,2 s dall’ultima correzione. Perdite brevi conservano l’inquadratura fino a 900 ms, continuando a riprodurre il video: questo accetta temporaneamente scostamenti dal blu per evitare lampeggi e scatti. In C si regolano tolleranza tracking, soglia movimento e pausa fra correzioni. Il quadrato resta fisso.

## Ricerca generale, senza preferenze di soggetto

Rimosse tutte le ricerche per blue sky, underwater, ocean, blue background e blue water. Ricerca principale generale: file casuali Commons per immagini, video senza parole tematiche, campionamento Archive per prefissi e pagine. Solo se la coda pronta è vuota, dopo tre batch generali, il quarto batch può provare riferimenti espliciti al colore: `subject:blue` su Archive; `haswbstatement:P462=Q1088 OR incategory:Blue` su Commons. Non è una corsia preferenziale né un requisito aggiuntivo per accettare il media. Le vecchie cache di candidati provenienti dalla precedente strategia tematica non vengono riutilizzate; la memoria anti-ripetizione resta intatta.

## Passaggio immediato fra video pronti

La coda video ora richiede canplay dopo il frame verificato e conserva quel fotogramma in un canvas fino a 640 px. Un video nuovo parte dalla posizione già preparata: nessun seek aggiuntivo al cambio. Il fotogramma pronto è mostrato immediatamente, poi sostituito dal video al primo requestVideoFrameCallback (playing nei browser senza quel metodo). Analisi sospesa durante seeking o in attesa del primo frame, evitando falsi match nulli. Rimossa l’attesa di 600 ms dopo la perdita del tracking: se un successivo è pronto, passa subito. Se la coda è vuota conserva l’ultima immagine del canvas, senza loop né lampeggio di caricamento. Questo non garantisce movimento continuo in assenza di nuovi video disponibili.

Derivati Commons preferiti ora a 240p per ridurre latenza e banda. La memoria anti-ripetizione resta invariata; la cronologia manuale può ancora rivedere un video.

## Qualità video normale e recupero coda

Ripristinati derivati Commons 480–720p (obiettivo 540p), limite 1280×720; risoluzioni inferiori solo se la fonte non offre di meglio. Archive preferisce risoluzioni note 480–720p o MP4/WebM standard, prima dei derivati 512Kb/low. Mantiene il limite tecnico di 150 MB e scarta risoluzioni note oltre 720p.

La selezione leggera è solo di recupero: meno di due video pronti per almeno dieci secondi, e soltanto un tentativo ogni quattro. Obiettivo Commons 360p, con 240p se necessario/disponibile; Archive preferisce in questi tentativi i derivati leggeri. A coda nuovamente >=2 il recupero si disattiva. Il passaggio immediato con fotogramma pronto resta invariato.

## Analisi colore ottimizzata

Durante il tracking viene prima letto soltanto il quadrato già agganciato (ROI): se è ancora valido, non costruisce la mappa colore dell’intero frame e non cerca altre finestre. La scansione completa rimane per i nuovi candidati o quando perde l’area.

Filtro colore equivalente riscritto con confronti RGB e forme algebriche di HSV: niente conversione di tonalità né divisioni per ogni pixel. Dato che i limiti R/B e G/B non superano 100%, B è già il massimo canale. Verificata equivalenza su 120.000 campioni casuali con tolleranze variabili. Riutilizza il buffer integrale e ridimensiona i canvas solo quando cambiano le dimensioni. Non aggiunge thread, dipendenze o test di accettazione. blueStatus.analysis espone numero di controlli ROI e scansioni complete; nessun benchmark di velocità complessiva dichiarato.

## Pannello e filtri fissi

Trump/politica e governi/USA ora sono esclusioni obbligatorie nel codice: i flag sono forzati a true dopo il caricamento delle preferenze e non sono modificabili né esposti nell’interfaccia. Le vecchie preferenze false non li disattivano.

Pannello C riorganizzato con intestazione blue, navigazione centrata, conteggio sintetico dei pronti e fonte. Gruppi richiudibili: stato ricerca, colore, inquadratura, riproduzione, archivi e schermi. Pulsante secondo schermo centrato; rimossa la descrizione lunga finale. Tutte le varianti condividono il nuovo pannello.

## Blueness / pannello raw e flusso

Nome pubblico Blueness, favicon SVG incorporato quadrato #0000ff. Entrypoint blueness.html / blueness-video.html / blueness-mixed.html e varianti di sorgente. I vecchi blue*.html continuano a funzionare con lo stesso codice.

Interfaccia C solo testo, un corpo Helvetica 12 px: nessun titolo, X, sfondo di pannello, cornice o divisore; navigazione ◀ ▶ senza riquadri. Stato non richiudibile e fisso in cima al pannello mentre i parametri scorrono sotto. Parametri numerici editabili, validati alla conferma; sezioni +/− nello stesso corpo del testo. C apre/chiude.

Correzione di un blocco concreto: le richieste Commons e Archive ora hanno stato e cooldown indipendenti. Una richiesta Archive lenta non impedisce nuovi batch Commons. Ritentativi dopo errore distanziati di 3,5 s. Preparazione video a 3 posti con coda scarsa, 2 quando ci sono almeno due pronti; immagini a 8 posti. Video già accodati passano a preload metadata (suggerimento al browser), quello in riproduzione torna auto. Canvas ridisegnato sui nuovi fotogrammi video tramite requestVideoFrameCallback, non su ogni refresh del display. Stato aggiornato una volta al secondo e riscritto solo se cambia. Nessuna promessa di coda costante: dipende da rete e match disponibili.

## Avvio rapido e qualità legata alla coda

La qualità viene scelta quando inizia la preparazione, non quando arriva il batch di metadati. Primi due match video: fascia 240–480p, preferenza 240p. Poi, con 0–1 pronti usa 240–480p (preferenza 360p); con >=2 pronti usa 480–720p. Derivati Commons conservati tra i candidati per scegliere la variante al momento giusto. Archive seleziona i file compatibili dai metadati e verifica l’altezza effettiva una volta decodificato il primo frame. I file senza variante nella fascia vengono saltati. Nessun riavvio dei video già in preparazione al cambiare della coda.

Questo può ridurre latenza di trasferimento/decodifica, ma non garantisce un match blu immediato. Ridotto a 10px lo spazio sotto lo stato prima delle frecce. Crediti in fondo a C: Blueness, 2026 Enrico Isidori x Contento360, con link a https://enricoisidori.com e https://contento360.it.

## Revisione sperimentale del 13 ottobre 2026

Confrontate 12 esecuzioni in gruppi paralleli: ricerca generale / blue a coda scarsa / generale+blue in parallelo (due giri da 40 s), poi entrambe le fonti / Commons / entrambe con massimo una preparazione Archive (due giri da 30 s). Risultati e limiti in BLUENESS-BENCHMARK.md e blueness-benchmark-results.json.

Scelta attuale: ricerca VIDEO generale, senza query blue; i test non hanno mostrato un vantaggio dei tag blu. Quando entrambe le fonti sono attive, massimo una preparazione Archive contemporanea, lasciando spazio ai candidati Commons. Non elimina Archive né riduce le sue possibilità tematiche. La strategia immagini resta invariata. Rimangono qualità adattiva, esclusioni fisse e anti-ripetizione.

## Semplificazione dell’avvio

Le fasce 240–480p / 480–720p diventano preferenze di scelta, non condizioni che scartano un media: se manca il derivato ideale può usare un altro riproducibile fino a 720p. Eliminate le verifiche ridondanti sul limite inferiore della risoluzione, che restringevano il pool.

Un’unica coda senza posti riservati. Quando c’è già un Archive in preparazione e sono disponibili candidati Commons, sceglie Commons; se non ce ne sono, usa comunque il posto libero per Archive, senza fermare il lavoro. Richieste delle due fonti ancora indipendenti.

Primo media: fotogramma già decodificato e verificato mostrato senza aspettare canplay; il video inizia a riprodursi appena possibile. I successivi mantengono il buffering prima di entrare nella coda pronta. Non ripete analisi allo stesso timestamp nei filmati troppo corti per i seek a 2/5 secondi. Metadati Commons limitati ai campi utili (autore, licenza, descrizione, credito, termini) conservando le categorie e i filtri fissi. Anti-ripetizione, tolleranze e ricerca generale invariati.

Il confronto precedente descrive le versioni testate in quel momento; questa semplificazione successiva sostituisce il limite rigido a una preparazione Archive e le fasce di risoluzione obbligatorie.

## Doppia vista predefinita e PDF del percorso

La vista simulata doppia è ora il default, anche se una vecchia preferenza locale era singola. URL senza dual (oppure dual=1) = doppia; dual=0 = singola. Il controllo aggiorna l’URL. Aprire la seconda finestra forza la principale in singola, bordo disattivato; il toggle simulazione non attiva una doppia principale mentre la finestra secondaria è aperta.

Per ciascun video nuovo della sessione, un solo fotogramma verificato viene conservato in JPEG: scena doppia fino a 1200px di larghezza, qualità 0,65, e ritaglio 64px. Nessun nuovo download video o immagine per questo archivio. La cronologia manuale non duplica le catture. I fotogrammi compressi rimangono solo nella memoria della pagina; il ricaricamento comincia un percorso nuovo.

P oppure “elabora e scarica PDF” in C assembla il documento, senza librerie o API esterne: una pagina a pieno formato per ciascuna scena doppia (senza controlli/bordi), nell’ordine di visione, poi una pagina con i quadratini accostati senza interspazi. Le pagine della scena collegano la fonte originale. Il PDF e il mosaico vengono creati esclusivamente su richiesta; la sola cattura compressa per video avviene durante la sessione per poter conservare il percorso senza trattenere i video completi. Esportazioni successive comprendono il percorso finora e non azzerano le catture.

Verifica: download reale da P dopo due video, PDF di tre pagine (~27 KB), letto da pdfinfo e renderizzato con Poppler; verificate scena doppia, mosaico e assenza di bordi. Verificato anche popup: principale dual=false, showBorder=false, URL dual=0.

Registrazione selettiva video (anche dual): R inizia/termina, S conserva la clip dall’inizio della sua registrazione, X chiude il frammento selezionato lasciando continuare la visione. MP4 finale con soli frammenti selezionati in ordine, senza indicatore o pannelli. Codifica nativa H.264 a 25 fps, dimensioni configurabili in C (default 1080×1440 px); audio AAC originale, indipendente dal muto della pagina. Nessuna cattura delle immagini nella modalità mista: si selezionano solo i video. Il motore condiviso è assets/shared/recording/recorder.js; mp4-muxer 5.2.2 MIT è confezionato in locale e valutato solo al salvataggio. Nessun encoder o timer di cattura fuori dalla modalità R.

C apre i controlli e le informazioni (I è un alias). La sezione registrazione MP4 permette di cambiare larghezza e altezza, memorizzate nel browser e applicate dalla prossima R. Il contatore dei video selezionati è separato dallo stato della clip e non cala durante il cambio video.

La registrazione conserva sempre l’audio originale dei video, indipendentemente da M, mute o volume della pagina. La sola sorgente audio è la traccia del video: nessun accesso al microfono, alla webcam o ai suoni esterni.

Durante R, D deseleziona la clip corrente ed esclude anche un frammento già tagliato con X. Il contatore scende subito; pressioni ripetute non lo diminuiscono ancora. Prima del taglio, S può selezionare nuovamente la clip.

Q annulla la sessione e scarta tutte le clip, senza generare o scaricare file. La freccia destra taglia la clip selezionata nel punto corrente, come X, poi passa normalmente al video successivo.

C → registrazione MP4: il riquadro sullo schermo mostra esattamente il ritaglio registrato. Altezza in vh, larghezza in vw e centro x/y sono regolabili; le proporzioni seguono la risoluzione di output. Default: 100vh, 3:4, 1080×1440 px (area ridotta solo quando la finestra è troppo stretta). Le impostazioni si conservano nel browser. Il ritaglio può cambiare durante la sessione; risoluzione e proporzioni prima di R. Pannello C, bordo e feedback non entrano nel file.

Spazio mette in pausa/riprende la visione mentre ricerca e precaricamento proseguono. La coda arriva fino a 12 riserve senza aumentare i caricamenti simultanei. In Afterimage le riserve della query corrente hanno precedenza sulle casuali e vengono rinnovate quando cambia la descrizione. Il tempo in pausa non entra nella registrazione; la pausa non garantisce funzionamento offline, perché i media restano in streaming e il buffer dipende dal browser.

R registra anche le istruzioni per ricostruire le clip selezionate. In C → registrazione MP4, “solo istruzioni” disattiva la codifica live: R termina conservando le istruzioni nel browser, E termina la sessione e monta dai sorgenti. S seleziona retroattivamente la clip, D la esclude, X e freccia destra ne fissano la fine. Le istruzioni comprendono URL, intervalli del video, ritaglio, cambi di inquadratura, zoom, doppia vista e bordo dell’opera; pannelli e indicatori restano esclusi. L’ultima sessione completata si conserva in IndexedDB e può essere scaricata/importata come JSON da C. Q scarta la sessione corrente o annulla l’elaborazione in corso.

E carica Mediabunny 1.61.6 solo alla richiesta, legge le porzioni necessarie del media e ricostruisce un MP4 H.264 a 30 fps con audio AAC originale a 256 kbps. Cerca risoluzioni maggiori dello stesso file/filmato quando disponibili, senza cambiare contenuto. Ricostruisce i movimenti registrati come cambi istantanei; non introduce interpolazioni. La qualità resta limitata dalla sorgente; non equivale a un copia-incolla senza ricodifica. L’elaborazione può richiedere tempo e memoria: avviene per una clip alla volta, con cache di lettura limitata a 32 MiB e PCM limitato alla clip corrente; il file MP4 finale resta in memoria. I sorgenti devono essere ancora raggiungibili e supportare lettura dal browser/CORS. In caso di errore non si saltano silenziosamente clip: il montaggio si interrompe e le istruzioni restano disponibili. Chrome/Edge con WebCodecs sono i browser di riferimento. [Documentazione del motore](https://mediabunny.dev/guide/reading-media-files).

G esporta tutti i video visti (anche non selezionati con S) come MP4 rapido di screen, 8 fotogrammi al secondo, senza dissolvenze e senza audio. Usa le dimensioni e il ritaglio correnti della registrazione, default 1080×1440. Riutilizza gli screen già salvati; se in Afterimage manca un frame, lo estrae dalla sorgente solo durante G. La visione si mette in pausa durante E/G e riprende alla fine. Excel in Afterimage resta nel pannello C; il tasto E è assegnato al montaggio dai sorgenti.

In C lo stato MP4 resta visibile anche con la sezione registrazione chiusa: preparazione, lettura sorgenti, audio, video elaborati, percentuale di rendering, finalizzazione, download avviato o errore. L’avanzamento indica il lavoro sui fotogrammi, non la percentuale di byte scaricati; durante la lettura dalla rete mostra la fase e il tempo trascorso. Le istruzioni JSON non vengono scaricate automaticamente con E o R: sono conservate nel browser e restano scaricabili da C. Solo se il salvataggio nel browser non riesce viene scaricato un JSON di backup.

Precaricamento Blueness: target di 6 video sia durante la visione sia in pausa. I caricamenti simultanei restano limitati a 2–3.

I candidati Blueness già verificati conservano URL diretto, nome file e punto di partenza: non richiedono nuovamente metadati Archive e riprovano per primo quel fotogramma. Il blu viene comunque verificato con le impostazioni attuali, senza assumere che una cache passata sia valida per ogni tolleranza. Il tracking non ripete analisi sul medesimo tempo video durante uno stallo.

Catalogo iniziale: `tools/catalogs/blueness.json` contiene 5 video verificati sul campo il 23 ottobre 2026, incorporati in `blueness/index.html` dal build (nessuna richiesta JSON iniziale). Partenza casuale fra quelli non ancora visti; le preferenze colore correnti vengono ricontrollate sui pixel. La scoperta online viene rinviata fino al primo video o all'esaurimento dei tentativi verificati, poi riprende normalmente. Il catalogo non è ancora una raccolta estesa; cresce con i candidati locali non visti. Per ampliarlo separatamente dall'installazione: `node tools/collect-blueness.mjs 120` (durata in secondi; richiede Playwright/Chrome), poi `node tools/build-blue.mjs`. Lo scanner usa tag colore soltanto per aumentare la resa della raccolta offline, non cambia le query generali della pagina. File rimossi, rete e tolleranze diverse possono rendere necessario il fallback: la lista non garantisce latenza zero.

Misura reale singola dopo il catalogo: primo video mostrato in 499 ms in un browser isolato. Non è una media né una garanzia su altre connessioni. La scansione generale precedente nello stesso ambiente aveva trovato 4 match in 90 secondi, con 154 controlli di frame e diversi timeout: si tratta di fasi e campioni differenti, non di un benchmark controllato.

# Blueness — passaggio alla nuova chat, 23 ottobre 2026

## ULTIMO — r26 confermato dall'utente ("funziona"), 25 ottobre

Online: https://blueness.blueness-pages.workers.dev (Worker + assets, `cloudflare/blueness-pages/`). `blueness/index.html` su GitHub è una cornice a tutto schermo verso quel Worker (scritta da `tools/build-blueness-pages.mjs`); la pagina vera è `blue-video.html`. Aggiornamento: `node tools/build-blue.mjs movements && node tools/build-blueness-pages.mjs && (cd cloudflare/blueness-pages && npx wrangler deploy)`.
Regole attuali:
- Raffica fino a 4 s (minimo 1 s). Il desktop aspetta un video live fino a 4 s prima della lista.
- Lista (178, `tools/catalogs/blueness.json`, `tools/collect-blueness-videos.mjs`) solo come riserva pronta; un video live pronto vince sempre.
- iPhone: solo lista per i primi 3 video e 30 s, poi live solo da Commons (240–360p, relay).
- Durata fino a 15 s; cambio a fine video o a blu perso; il primo video dura almeno 3 s.
- Primo clic = audio; salto dal secondo video in poi; nessun salto durante la raffica o il primo video, e lo SVG resta.
- Lato viola fino a 252° (cursore in C); C mostra "video corrente: live/dalla lista"; `?reset=1` azzera; ricerca live casuale vera (Commons gsrsort=random, Archive con prefissi adattivi e conteggio).
Provati e tolti: taglio dei video statici, minimo di 1 s, video successivo pre-avviato in loop, video da 2–8 s su mobile.

## ULTIMO — r9 online: fluidità prima della qualità, niente raffiche contro i 429 di Wikimedia

Utente: "caricamento scaduto", a tratti scatta; priorità: che non si interrompa mai, anche perdendo qualità. Solo iOS: video corrente fermo da 1,5s con una riserva pronta → advance (iosVideo.stalledFor; non durante la cronologia); varianti Commons fino a 480p, 240p per i primi due e poi 360p, a parità si preferisce la più leggera, escluse le .mov mp4v; i provider si alternano quando sources=both. Dopo 3 fallimenti di caricamento/seek di fila si attende 2→30s (pool.coolUntil). Relay: il 429 passa con il suo Retry-After invece di diventare 502. Provato e annullato: "su iOS solo Commons", che concentrava il carico su Wikimedia → 429 a raffica (425 scartati/60s). I 429 visti nei test venivano in parte dalle prove ripetute da questo IP. E2E Worker locale UA iPhone in 60s: 7 match/14 scartati, altezze 240–360, zero pageerror. Pubblicato, versione 352c5011.

## ULTIMO — ONLINE: https://blueness.blueness-pages.workers.dev (Worker + static assets)

`pages project create` falliva con un 500 dell'API Cloudflare (codice 8000000, account nuovo). Passati a Worker + static assets in `cloudflare/blueness-pages/wrangler.toml`: `dist/` come assets, `run_worker_first=["/__blueness_media/*"]`, Worker `tools/blueness-media-worker.mjs` (relay, altrimenti env.ASSETS). Account wrangler: OAuth di Enrico. Il sottodominio workers.dev ha impiegato circa 110s a ricevere il certificato TLS. Verificato online: / e /blueness/ 200 r8, status, Commons 206 in 0,44s, Archive 206 in 2,5s. E2E WebKit UA iPhone in 45s: 7 video distinti, coda 2/2, zero pageerror. Aggiornamento: `node tools/build-blue.mjs movements && node tools/build-blueness-pages.mjs && (cd cloudflare/blueness-pages && npx wrangler deploy)`. Mancano: conferma su iPhone; facoltativi un dominio custom e il redirect da enricoisidori.com/blueness.

## ULTIMO — Blueness su Cloudflare Pages (pagina + relay stesso dominio, DNS invariato)

Utente: r8 nel tunnel "a tratti flawless" per un po', poi dopo due ricariche non va più; chiede la strada Cloudflare a costo zero. Scelta: progetto Pages separato `cloudflare/blueness-pages/` (wrangler.toml, Function `functions/__blueness_media/[[path]].js` che usa `tools/blueness-media-core.mjs`), output `dist/` generato da `node tools/build-blueness-pages.mjs` (copia blueness/index.html in / e /blueness/). Nessun cambio DNS: il resto del sito resta su GitHub; dopo, opzionale CNAME blueness.enricoisidori.com e redirect da /blueness. Rischio termini Cloudflare confinato al progetto Pages. `wrangler pages dev` locale: pagina, status, Commons 206; e2e WebKit UA iPhone 60s: 10 video distinti, zero pageerror. Durante la prova utente il relay Node ha passato ~220MB via Mac/tunnel in pochi minuti: la banda del tunnel è un probabile fattore dello stallo dopo ricarica, non confermato. Manca: login Cloudflare dell'utente e deploy.

## ULTIMO — r8: il primo video andava a scatti e si fermava (relay saturo)

Sintomo su iPhone con r7 nel tunnel: un video parte, va a scatti e si ferma; "media non disponibile". Causa misurata: il relay Node rifiutava con 503 oltre 8 flussi; lo stato restava fermo su active=8, perché Safari tiene aperto un flusso per ogni video in pausa (cronologia 4 + riserve 2 + preparazione). I pezzi successivi del video corrente venivano rifiutati. Fix: relay senza tetto, con chiusura dei flussi non letti dopo 15s (Safari li riapre con un nuovo Range); su iOS `park` stacca la sorgente del video lasciato in select, `restore` la riattacca solo tornando indietro con le frecce. Test: relay con 10 flussi e chiusura per inattività (verificato che fallisce senza), park/restore, select. E2E WebKit con relay Node vero in 90s: massimo 3 flussi, 9 video distinti riprodotti, coda 2/2 raggiunta, zero pageerror. "media non disponibile" resta solo come scarto di candidati, senza bloccare. Sigla `25/10-r8`, tunnel `/blueness/?v=ios8`.

## ULTIMO — r7: soluzione A, Worker Cloudflare sullo stesso dominio (25 ottobre)

Dati reali iPhone D1 (Safari 26.4): MP4 stesso dominio + getImageData OK; Commons VP9 con CORS `*` e crossorigin → SecurityError; Archive nativo senza CORS riproduce ma 6,6s al primo frame. Conclusione: su iPhone solo i pixel di video same-origin sono leggibili. Il sito va online su GitHub Pages (enricoisidori.com/blueness), dove un relay locale non esiste.

Scelta utente: A. Logica relay estratta in `tools/blueness-media-core.mjs` (Request/Response web standard), usata da `tools/blueness-media-relay.mjs` (Node, tunnel/Live Server) e da `tools/blueness-media-worker.mjs` (Cloudflare Worker, config `cloudflare/blueness-media/wrangler.toml`, route `enricoisidori.com/__blueness_media/*` e www). Contratto invariato per il client iOS (`/__blueness_media/status`, `/video?url=`). Aggiunto User-Agent identificativo: Wikimedia risponde 403 senza (workerd non ne manda). Timeout iOS riportati a 10s/5s come desktop (4s/1,5s scartavano video validi via relay). Sigla C `iOS relay · 25/10-r7`, tunnel `/blueness/?v=ios7`.

Verifiche: 36 test unitari (nuovo `blueness-media-worker.test.mjs`); `wrangler dev` reale: Commons 206 0,1s, Archive 206, stream integrale 12,7MB; e2e WebKit con UA iPhone e relay stesso dominio: video via relay, match, riproduzione, zero pageerror; 60s → 4 match/33 analisi (prima 3/25). WebKit desktop NON riproduce il SecurityError: conferma solo su iPhone. Da fare dall'utente: DNS su Cloudflare (oggi GoDaddy), `npx wrangler deploy`. Collo di bottiglia restante: concorrenza iOS 1 e rarità candidati.

## ULTIMO — utente: r5 identica; attesa diagnostica iPhone D1, evitare altre patch ipotetiche

R5 non risolve sul dispositivo. In questo turno non cambiato blue-flow/helper né rigenerato programma. Creata `blueness/diagnostic.html` autonoma, pubblicabile da LiveServer/devtunnel senza backend: click avvia3 test con video DOM visibile,muted,inline; MP4 locale +pixel, Commons VP9 +pixel, Archive/download MP4 noCORS playbacksolo. Limite7s/caso, misura currentTime avanzato .3s, getImageData quando previsto, nomi errori e eventi. MP4 locale `blueness/diagnostic.mp4`, H264baseline+faststart 160×90,3s,22.656B, generato ffmpeg; nessun uso da appprincipale. Copia risultato tramite clipboard su click, fallback textarea; nessun invio automatico, nessuno storage letto. Report contiene origin/path senza query,UA/piattaforma,secureContext,canPlayType e risultati.

Chiesto via request_user_input_async all’utente di aprire sul SUO iPhone `/blueness/diagnostic.html?v=d1` nello stesso devtunnel, avviare e incollare Copia risultato. Dato necessario per distinguere effettivo supportocodec, CORS, attivazione, rete e rendering. Non continuare a dichiarare fix dispositivo basandosi su VM/desktop.

Pagina diagnostica verificata via WebKit isolato su HTTPS sintetico, HTML solo diagnostica e fixturelocale servita conRange206:3OK, locale722ms/Commons956ms/MP4Archive3120ms, pixelOK nei primi2, zero pageerror. Questo non è iPhone. Script `/private/tmp/blueness-device-diagnostic-check.mjs`. Blocco CUA del file utente rimane: nessuna ispezione del sito originale tramite URLalternativi.

## ULTIMO — iOS r5: trovata incompatibilità misurata Range/CORS di Archive; fallback Commons verificato in WebKit reale

Utente continua ad aspettare minuti. Evitare ulteriori fix ipotetici senza rete reale. Misurate5 URL catalogo con Range0-1+Origin devtunnel: Commons206 con2byte/CORS*, una429 transitoria. Entrambi Archive `/cors/` ignoranoRange,200 con Content-Length7826666 e62570459, nessun Content-Range. `/download/` e server fisici metadata d1 rispondono206 ma senzaCORS; fetch realeWebKit Load failed. Quindi non basta cambiareURL e non si può mantenere pixel readback senza un relay autorizzato Range+CORS. Nessun relay aggiunto.

Installato Playwright WebKit26.5 (76,9MiB, cache utente); simulatoreiOS/Xcode sempre assente. Prova reale isolata su HTTPS sintetico, solo filmati pubblici +detector estratto, NON pagina/app utente bloccatafile://: treCommons loaded339/209/207ms, DoD blu valido615ms, Hala no match519ms, SDO valido235ms; tutti avanzano e pixelleggibili. Script persistito `tools/probe-blueness-webkit.mjs`, import PLAYWRIGHT_MODULE o playwright come altri script. Script nodi headers in /private/tmp/blueness-*range/origin/media-headers-probe.mjs.

Modifica solo iOS: default sourcesboth passa Commons (selectC mostraCommons; desktopboth invariato). Warmcatalog filtrato perprovider comeprima. Raffica non deve sparire: startIntroSequence consente Commons seiosVideo. Discoveryvideo iOS usa metadati blu finché currentnull, poi torna generico; desktopcolorFallbackvideo false. Seutente selezionaArchive/both manualmente, prepare esegue iosVideo.streamingURL prima di decoder: fetchcors Range0-1 timeout2,5s, cancella body senza leggerlo, rifiuta non206; nessun downloadintegrale/blob. In both preferisceCommons in coda. Timeoutload iOS4s, seek1,5s (desktop10s/5s invariati). Cancella errore preparazione al caricamento successivo riuscito, oltre a C sigla`iOS streaming · 25/10-r5`, URLtunnel `/blueness/?v=ios5`.

Nuovi test: 200range non letto/cancellato,206 ammesso, defaultsourceIOSvsdesktop, colorrescue soloIOScold, introretainedCommons. Versionefotografica non rigenerata, buildmovements/alias soltanto. Conferma su dispositivo ancora necessaria, non promettere tempi0,24s su iPhone. Vecchie note sotto cronologiche.

## ULTIMO — iOS r4: utente conferma r3 e SecurityError “The operation is insecure”

Diagnosi ora concreta ma fase dispositivo ancora ignota: può essere getImageData/drawImage/toBlob/altro. Aggiunte fasi errore solo iOS in prepare e tracking, cattura export. Difetto trovato: analisi e ROI condivisi vengono solo clearRect se dimensioni uguali; un canvas tainted resta illeggibile per tutti i candidati successivi. resetBlueAnalysis assegna width a se stessa su entrambi solo dopo SecurityError iOS, ripristinando origin-clean e scartando il contenuto illeggibile. Nessun bypass CORS. Se il SecurityError arriva sul corrente, reset, current=null, rimozione dalla storia e release, advance: così prepare può avviare appena il successivo è pronto senza attendere15s sul media guasto. captureRoute su select iOS è protetto: una cattura opzionale guasta non propaga a prepare, che prima poteva rilasciare il video appena selezionato. Attributo crossorigin anonymous esplicito prima di src. Sigla C `25/10-r4`, URL tunnel `/blueness/?v=ios4`.

Tre regressioni aggiunte con errori iniettati sulla logica reale: candidato guasto seguito da valido (reset realmente invocato sui canvas), errore tracking rimuove corrente e riprende coda, errore captureRoute non distrugge media selezionato. Non sono test del dispositivo. Desktop e ricerca invariati, build solo movements/alias. Se persiste, leggere la nuova fase in C; non attribuire con certezza ogni SecurityError a CORS prima di quel dato.

## ULTIMO — iOS r3: video visibile nativo, non più fotogrammi ridisegnati

Primi due fix non risolvono su dispositivo. Utente conferma `/blueness` tramite port devtunnel; mancano ancora contatori dispositivo. Cambiato solo iOS singolo schermo: helper.present mostra media selezionato z2 sopra stage, CSS camera identica a drawScreen, clipping viewport e bordo separato (solo primo nascosto). play parcheggia il video precedente; present=false per dual/second-screen/null-match, conserva canvas per questi casi. Paintkey nativo non cambia col tempo, solo scena/camera: canvas conserva frame valido sottostante senza copiare continuamente il filmato. Analisi/tracking e export restano canvas; desktop rVFC invariato. Clock fermo4s anche con paused=false mostra recupero tramite gesto (non loop load). Ripresa esplicita resetta timer stallo per non contare pausa manuale/background. C sigla `iOS native · 25/10-r3`, renderer/native vs canvas, clock, readyState, networkState ed errori. Chiedere di usare `/blueness/?v=ios3` nel tunnel e verificare build in C per evitare vecchie copie.

18 test Node passati, inclusi geometria nativa e stallo senza paused. Prova browser separata con helper reale e MP4 fixture, pagina HTTPS sintetica (NON il sito/file utente): geometria -125,242,640×360 come atteso, media avanza anche disabilitando requestVideoFrameCallback, prosegue preparando un secondo video, pausa manuale rispettata. Chromium non simula la policy iOS: nessuna dichiarazione di fix confermato su iPhone. Script diagnostico `/private/tmp/blueness-native-video-probe.mjs`. Build solo movements; nessuna modifica ricerca, fotografie o Afterimage.

## ULTIMO — 25 ottobre: iOS si ferma dopo raffica/primi frame

Utente conferma primo fix iOS insufficiente: al massimo pochi frame del primo video. Correzione mirata solo iOS: decoder coperto non deve pilotare canvas via requestVideoFrameCallback, che può non proseguire. select su iOS imposta primo frame da readyState>=2; frame segue currentTime quantizzato30/s anziché frameSerial. Desktop conserva rVFC e logica esistente. Helper iOS rimuove autoplay dichiarativo (anche proprietà), usa play esplicito. Traccia solo media selezionato; tick chiamato nel RAF dopo le uscite pausa/hidden, ritenta al massimo due play se pausa inattesa senza progresso, poi pulsante per gesto. Nessun restart riserve o media rilasciati, nessun timer aggiuntivo. C aggiunge stato iOS: paused/currentTime/readyState/stallo. Non modificata la ricerca: utente ha chiesto di lasciare per ora le distorsioni Archive così.

Due regressioni nuove simulano callback video mai consegnati (canvas deve continuare al crescere del tempo) e pause inattese durante preparazione riserve (riprese limitate, rispetto pausa/hidden/release). Test eseguiti su produzione estratta in VM, non Safari iPhone. Rigenerazione solo movements, alias inclusi; fotografie/Wiki/Afterimage non rigenerati. Simulator iOS assente; blocco CUA file:// da rispettare.

## ULTIMO — nomi invertiti, prova fotogrammi rimossa, percorso specifico iOS

L’utente chiede di preservare il video desktop che funziona. `blueness/index.html` ora VIDEO; fotografie in `blueness-image/index.html`; `bluenessmovements/index.html` resta alias video. Build `movements` aggiorna video/alias, `base` solo foto. Rimossi frames.html, produttore e test della prova scartata; nessun ramo frames nel build/runtime. Entrambe le intro usano VIDEOS, IMAGES conservato commentato negli HTML e nell’asset originale. C: slider seconds esteso a0,1–30s (default15 invariato). V video: screen come G con sigla effettiva prefissa, nessuna variante A/L, nessun encoder prima della richiesta. Recorder condiviso ha getScreenIntro opzionale, default nullo per altri progetti; nessuna rigenerazione Afterimage.

`tools/blueness-ios-video.js` restituisce null su desktop. Solo iPhone/iPad: verifica codec anche da catalogo, video muted/inline nel DOM dietro canvas, play prima di attendere loadeddata (preload da solo può non decodificare su iOS), poi pausa sul match; saltata attesa canplay di una riserva già in pausa. Concorrenza1 e coda2: meno decoder/buffer trattenuti. Storia4 conservata anche su iOS, preload dei precedenti ridotto a metadata. Play negato mostra pulsante con ripetizione sincrona dal gesto. pagehide libera media fuori bfcache, conserva src nei ritorni bfcache. Desktop mantiene selezione varianti, preparazione in pausa fuori DOM, coda6,2–3 preparazioni, tracking e riproduzione normali. Xcode/simctl assenti: niente dichiarazioni di verifica iPhone reale. Il blocco CUA file:// non va aggirato.

Verifica:14 test Node passati (7 regressioni +5 iOS +2 export), sintassi e modalità dei tre HTML controllate, VIDEOS attivo/IMAGES commentato verificati. Prova isolata del renderer in Chrome su fixture HTTPS sintetica, senza aprire né riprodurre la pagina utente: V ha prodotto MP4 H.264 1080×1440 con2 frame intro SVG +1 screen, durata0,233s; primo frame decodificato e ispezionato, testo VIDEOS e quadrato allineati. Non è un test mobile o end-to-end della pagina. Artefatti diagnostici `/private/tmp/blueness-video-intro-probe.mp4` e `.png`.

## ULTIMO — annullata coppia locale; priorità alla ricerca live prima di controlli e sigla

L’utente ha annullato l’avvio con due foto locali. La raffica resta, prima foto dopo raffica deve essere un vero risultato remoto. Rimossi anche seed2 della lista99, startupCandidate, savedImageMatch e catalogo99 incorporato: base torna catalogo vuoto. Ricerca iniziale `fetchBatch('image')` immediatamente dopo stato essenziale e prima di creare recorder/controlli/SVG: spostati sopra i dati dei filtri e le mappe necessarie, funzioni hoisted. Prima query su `subject:blue` (sempre nuova ricerca con filtri e controllo pixel), senza consumare prima8 candidati generali improbabili. Stato fetching evita richiesta duplicata dal pump finale. Raffica locale invariata con massimo5s e SVG via primo vero risultato; nessun fermo su foto locali e nessuna attesa minima o buffer2.

Confronto codice: Movements ha5 filevideo validati diretti (3Commons,2Archive); il primo frame non richiede filevideo intero. Images usa già miniature tipicamente10–25KB, ma richiede prima discovery e verifica blu. Streaming/progressive render non fornisce una scorciatoia per la verifica dei pixel senza una miniatura decodificata. `blueStartupTiming` aggiunge resultsAt per separare API/download/disegno.

Test7 passati: bootstrap reale manda una sola query blu prima di creare controlli/intro, zero seed; primo nuovo risultato avanza senza aspettare il secondo o5s; filtri video e detector, raffica5s invariati. Prova di rete separata (non tab utente): query4,3ms, risposta976,9ms, primo candidato remoto9298B valido1643ms; non garanzia su rete/storico utente. Rimossi dalla cartella attiva97 wrapper `.image.js` generati nella modifica annullata, spostati recuperabili in `/private/tmp/blueness-unused-local-opening-2FPyK9`; JPEG offline conservati. Build solo base, pagina circa370KB. Non aggirare blocco CUA file:// per ispezionare tab utente.

## ULTIMO — coordinate vere per il primo avvio Images, filtro video Capitol Hill

Problema concreto trovato: la lista99 aveva verified/fingerprint ma nessun match salvato, malgrado la precedente richiesta. Nuovo generatore offline `tools/build-blueness-image-matches.mjs` usa canvas nativo e lo stesso detector sui JPEG completi in preload, senza browser o rete. Generati97 match validi su99 nel JSON. La base sceglie solo2 con match, mai mostrati e compatibili con provider; `savedImageMatch` riusa x/y/w/h/side e adatta zoom, saltando rilevatore runtime. Se impostazioni colore cambiate o proporzioni/zoom incompatibili, fallback detector. Download/decodifica e piccolo fingerprint anti-ripetizione invariati. Nessuna attesa5s minima: `prepare` avanza subito al primo pronto, anche mentre il secondo scarica. `blueStartupTiming` espone searchAt/loadedAt/readyAt/paintedAt per distinguere ricerca/rete/presentazione. La sola scansione1ms non spiegava13s; video e immagini avevano cataloghi di partenza diversi. Verifica remota due miniature note:0,77s e1,27s, HTTP200 e byte identici ai JPEG validati; singola misura, non garanzia.

Archive video ora aggiunge `AND NOT subject:"Capitol Hill" AND NOT subject:"January 6 Capitol Attack"` nella query. Nessun filtro video aggiuntivo su Commons, che non supporta subject Archive. Build solo base e movements. Test7 passati: no scan con coordinate note, prima foto mostrata mentre seconda ancora scarica, nessuna attesa5s, cambio criteri ricade su detector, entrambe esclusioni nella query video, startup e detector esistenti. SVG Images via al primo; video SVG sul primo senza bordo e via al secondo con bordo, invariati.

## ULTIMO — SVG al primo live per Images, al secondo per Movements

Images rimuove SVG nello stesso frame del primo risultato dopo la raffica, con bordo normale già dalla prima immagine. Movements mantiene SVG per il primo video e lo toglie al secondo; solo il primo video ha `hideIntroBorder`. Export V Images non cattura più SVG sui live (flag bordo false), conserva la sigla. Build separati `base` e `movements` per evitare di rigenerare Wiki. Verificate entrambe le soglie e il flag bordo con esecuzione della logica reale; build e test startup/detector passati.

## ULTIMO — mai fermarsi su una precaricata; ricerca avviata prima della sigla

L’utente osserva un’immagine ferma prima del vero live. Causa trovata nel codice: limite raffica5s lasciava ultima tile ferma con current null. Rimosso limite: sigla scorre fino a current live, poi stop definitivo. Compromesso esplicitato: con rete lenta può superare5s, ma non maschera una precaricata da primo risultato. Primo frame fermo proviene solo da prepare+detect nuova ricerca. Ordinamento iniziale ora seed/renderInfo/pump (avvia subito richiesta Archive), poi startIntroSequence async decode; nessuna attesa prima ricerca. SVG seconda e contorno seconda invariati. Test transizione ritarda primo risultato oltre5s e verifica preview ancora in movimento, shown0, poi prima sorgente nuova, stop preview, SVG tolto al disegno seconda con bordo.


## ULTIMO — rimossa la priorità lista99, SVG scompare già alla seconda

Utente chiede di eliminare l’ottimizzazione lista99 perché non porta vantaggi. Base torna a `BLUENESS_CATALOG=[]`; rimosso ramo seed due candidati, flag startupCandidate e inserimento prioritario. Nessuna soglia coda o attesa minima per partire: primo match nuova ricerca entra immediatamente. Rimossa anche velocità speciale delle prime2: tutte seguono fps normale. Breve sequenza locale/SVG rimane durante la preparazione, massimo5s di raffica come prima; è separata dalla lista99 rimossa. SVG solo sulla prima live, uscita nello stesso frame della seconda; bordo bianco torna dalla seconda. ExportV eredita flag di cattura solo prima live. Test candidati rinominato `blueness-live-start-browser.mjs` e ora verifica solo nuovi risultati, zero download lista, primo disegno senza aspettare secondo, SVG assente dalla seconda; transizione aggiornata.


## ULTIMO — mostra subito il primo pronto, senza aspettare il secondo

Richiesta esplicita: la raffica finisce appena disponibile il primo risultato. Gate ready1, rimosso minimo600ms. Due miniature remote dalla lista99 avviate insieme come prima; seconda non blocca più il primo disegno. Limite raffica5s invariato. Il limite1s delle prime2 è un intervallo di riproduzione, dipende comunque dall’arrivo del successivo: non si può garantire rete entro1s. Test candidati ritarda il secondo download800ms e verifica primo mostrato mentre ready0, fine raffica al primo, cambio entro1s a fps=.5; poi nuova ricerca. Passati test candidati e transizione. Verifica aggiuntiva su Archive reale in browser isolato: shown0 a1,04s, shown1 a2,05s, shown5 a4,06s, shown8 a6,06s; media controllo blu sotto1ms/immagine, tempi rete medi circa0,9–1s. Singola prova, non garanzia.


## ULTIMO — cinque secondi sono il massimo della raffica, non il minimo

Rimosso gate minimo5s che faceva attendere inutilmente anche due candidati già pronti. Nuovo minimo600ms per intro breve, poi parte subito con2 ready. La raffica termina comunque a5s; se rete non fornisce2 validi, mantiene ultimo frame sotto SVG in attesa, senza raffica infinita. Nessun cambiamento al numero di download, nessun ritorno alle immagini locali come falso live. Test candidati ora verifica primo disegno prima5s; transizione verifica raffica attiva durante preparazione ma ferma oltre5s.


## ULTIMO — due candidati remoti dalla lista99 per accelerare il primo live

L’utente autorizza le prime2 dalla lista99, scaricate al momento (non dal foglio intro). Il build base incorpora solo i metadati99, Wiki invariata. `seedCandidates()` sceglie una sola volta2 candidati casuali mai mostrati (URL e fingerprint persistenti), compatibili con sorgente scelta. Entrano nella coda normale con priorità iniziale, controllo blu/decodifica/dedup invariati. La ricerca parte comunque subito e condivide limite8 download; nessuna richiesta di metadati, nessun caricamento di tutte99 e nessun refill. Risultati della lista pronti precedono quelli nuovi durante startup, poi solo ricerca. Se uno fallisce o lista esaurita, la ricerca può avviare con2 pronti normali. Sigla continua fino al gate2 +5s; primo cambio entro1s, SVG sulle prime2. Nuovo test browser dedicato verifica due soli download catalogo, ricerca contemporanea, cambio entro1s e successivo nuovo live.


## ULTIMO — sequenza veloce continua finché almeno due live sono pronti

Supera il comportamento precedente che fermava la sigla dopo12frame. Ora usa tutta la pool67 mescolata, 50ms/fotogramma, e la rimescola a fine giro finché non parte il live. Nessun download/analisi aggiuntivo: stesso JPEG decodificato una volta. Gate minimo2 pronti oltre5s; il primo cambio live ha già il secondo in coda e intervallo massimo1s. Pausa/tab nascosta sospendono i disegni, ripresa automatica; al live il timer termina e libera il foglio. SVG e bordo invariati. ExportV registra la sequenza effettiva, che ora può durare più a lungo. Passati i test browser instant (primo frame60ms, copertura blu minima79%, nessuna analisi/storia) e transizione (attesa oltre5s con un solo pronto, intro ancora in movimento, passaggio con2 e primo cambio entro1s a fps=.5).


## ULTIMO — avvio soltanto con tre live pronti

La base attende almeno tre immagini live scaricate, decodificate e verificate, oltre alla finestra minima di5s. Fino ad allora mantiene l’ultima precaricata sotto SVG. Soglia unica `LIVE_START_BUFFER=3` per gate automatico e recupero tag blu; nessuna richiesta o coda extra. Le prime due immagini durano al massimo1s ciascuna anche con fps salvati inferiori a1, poi torna il ritmo impostato. Bordo nascosto sulle prime2 e uscitaSVG al disegno della terza invariati. Test transizione: due pronte oltre5s non avviano; rilascio terza avvia con altre2 in coda; primi2 cambi entro1s a fps=.5.


## ULTIMO — SVG responsive separato e nuovi export V

Richiesta corrente completata: testo/freccia responsive allo spazio pagina, distanza fissa dal quadrato che rimane fermo; V comeG con intro, V+A HD, V+L solo intro più lunga, V+L+A HD.

- `intro.svg`: separati i gruppi `data-intro-text` e `data-intro-arrow`, rettangolo `data-blue-anchor` invariato. `layoutBluenessIntro()` in nuovo `tools/blueness-intro-layout.js` mantiene quadrato centrato/lato impostato, adatta testo ai margini/spazio superiore e ridimensiona freccia; punta16px sopra quadrato e testo16px sopra freccia. Runtime e export usano lo stesso helper.
- Runtime ricorda solo12 metadati (fotogramma, tempo, geometria) della sigla e il tempo del primo live; nessun nuovo encoding/fetch durante visione.
- Exporter esistente accetta callback `getIntro`, aggiunge V con modificatori A/L in qualunque ordine, comando eseguito al rilascio di V. G/A+G invariati. Due pulsanti V aggiunti in C. Q annulla; pause e raccolta si conservano.
- `tools/blueness-intro-export.js` lavora soltanto su richiesta: estrae immagini dal foglio, riproduce inquadrature e durate vere della sigla, sovrappone SVG responsive su sigla+prime2live, poi normale montaggioG. V+L usa tutta la pool67 mescolata a10fps, durata6,7s, senza live. Renderer locale V riusa encoder/layout condivisi ma NON modifica `assets/shared/recording/render.js`.
- A nelle varianti V usa il resolver HD esistente, uno alla volta e con controllo equivalenza/fallback. Asset `startup.json` ora include `imageBox` (foto senza bande), generato offline per mantenere proporzioni corrette nei riferimenti HD; JPEG invariato.
- File: `blueness-intro.mp4`, `blueness-intro-hq.mp4`, `blueness-intro-long.mp4`, `blueness-intro-long-hq.mp4`. 1080×1440 senza audio, V sessione usa durata immagini dello sliderG e sigla conserva tempi veri; V+L fissa0,1s/immagine.
- Passati test: quattro MP4 V reali verificati ffprobe (16 campioni per V in fixture,67 perL, 5,4s/6,7s); combo in ordini diversi; encoder importato una sola volta e mai durante visione; HD solo su A e sostituzione HD effettiva per una sorgente della sigla con fixture equivalente, altre fallback; G su tutte durate .1/.2/1/60 e A+G HD/fallback ancora passati (Wiki letta, mai rigenerata); allineamento quad entro0,02px, margini testo e gap freccia16px misurati. Controllati visivamente primo frame V e layout desktop.


## Ultima modifica — 5 secondi di preparazione, minimo2 pronti, niente bordo sulle prime2

Richiesta: usare effettivamente i5s iniziali per preparare almeno due live, invece di consumare subito il primo e fermarsi. Aggiunto `liveStartAt` a5s dall’inizializzazione; `advance()` automatico nella sola base aspetta deadline e almeno2 elementi ready (già scaricati/decodificati/verificati). Il frame loop avvia puntualmente appena entrambe le condizioni sono vere, senza nuovo timer o motore di coda. La sigla breve resta invariata e tiene l’ultimo fotogramma durante la preparazione. La rete non può garantire2match in5s: se non ci sono, attende il secondo, evitando la falsa partenza sul primo. Recupero tag blu ogni4query consueto ora consentito con meno di2pronti durante startup, così un singolo match in attesa non blocca il recupero. Nessuna ricerca parallela extra.

Le prime due immagini selezionate ricevono `hideIntroBorder`; `drawScreen` salta il bordo bianco per questi elementi. La terza torna al bordo normale e rimuove SVG nello stesso frame, come già richiesto. Nessuna modifica a encoder/export o alle altre pagine. Test transizione esteso: un solo pronto non parte; due pronti attendono5s; prima immagine lascia almeno la seconda pronta; nessuno stroke bianco sulle prime2; stroke normale alla terza; SVG sopravvive a stalli e si toglie dopo il terzo disegno.


## Ultimo dettaglio intro — due immagini live, uscita sulla terza

L’utente conferma la sigla veloce, poi vuole SVG sovrapposto alle prime due immagini live e rimozione in corrispondenza del successivo cambio. Eliminato il timer5s. Il div SVG conserva un Set di sorgenti live effettivamente disegnate; viene rimosso DOPO il disegno della terza distinta, nella stessa requestAnimationFrame. Resize/ridisegni e frecce sulla stessa sorgente non contano come nuove immagini. Se la ricerca si ferma alla prima/seconda, resta visibile. Chiusura manuale al clic mantenuta. Test dedicato `blueness-intro-transition-browser.mjs` con due risultati e stallo oltre5s, poi rilascio del terzo risultato: verifica che la rimozione avvenga soltanto con la terza immagine già dipinta.


## ULTIMO STATO — sigla blu rapida da pool riutilizzabile, poi solo live

Supera tutti gli stati sotto, incluso quello precedente senza immagini incorporate. L’utente vuole un breve avvio molto veloce con immagini già verificate, blu nel punto corretto (NON anteprime casuali). Ha chiarito esplicitamente che la sigla può usare la stessa pool media a ogni apertura, con immagini/ordine mescolati; il live resta senza ripetizioni.

- Asset unico `blueness/startup.jpg` (151.560 byte JPEG, 960×960) e `startup.json` (67 fotogrammi validi con tile e coordinate blu). Derivato offline dai 99 JPEG reali di Archive; verificato DOPO compressione con il detector standard. `tools/build-blueness-startup.mjs` serve soltanto per rigenerare questi asset, non gira nel prodotto.
- `tools/build-blue.mjs base` incorpora un solo JPEG e i metadati `BLUENESS_STARTUP`, con catalogo iniziale vuoto. HTML circa348KiB; Wiki non rigenerata.
- `startIntroSequence()` decodifica un solo bitmap, mescola la pool e mostra al massimo12 immagini a20fps (~0,6s), senza reinserimento nella singola sequenza. Nessun controllo blu/hash, scrittura di cronologia, export o fetch della sigla. La pool è riutilizzabile fra aperture per esplicita preferenza dell’utente.
- `paintIntroFrame()` usa le coordinate verificate per centrare il blu esattamente sul quadrato attuale; segue resize, dimensione e layout doppio. Dopo il lampo tiene l’ultimo fotogramma fermo; un solo bitmap mantenuto finché arriva il live, poi rilasciato in `select()`. Nessun loop o rifornimento della sigla.
- Ricerca live immediata in parallelo al singolo decode; default Archive una query per volta e8 download/12 fra pronti e preparazioni. Appena arriva il primo match, la sigla cede definitivamente al live; niente anteprime casuali non blu. SVG resta allineato, trasparente e viene rimosso a5s/clic soltanto con live già disegnato. I fotogrammi della sigla non entrano nel montaggio G.
- Test instant ora verifica primo frame offline, burst12, copertura blu del centro, zero analisi/scritture di cronologia, stop dopo un solo lampo, nuovo ordine alla riapertura e ridisegno corretto dopo rotazione. Test live priority verifica una sola decodifica locale,8 download live e nessun ritorno alla sigla. Test no-repeat continua a riguardare il live.


## STATO ATTUALE — solo ricerca live, riserva eliminata

Verifiche finali passate: instant (anteprima da stesso download, zero richieste extra, una query simultanea, SVG visibile offline), buffer16 immagini/maxgap271ms con rete simulata, live15/zero decodifiche locali, no-repeat persistente, allineamentoSVG entro0,02CSSpx e detector blu. Prova reale singola20s: prima anteprima5802ms, primo match6063ms, 7 immagini blu mostrate, 53 analizzate, rete media1811ms contro blu0,90ms, 4 timeout; peak ricerca1. Nessuna promessa di4fps con sola ricerca live e nessun confronto controllato con la riserva. Il vantaggio dimostrato è semplicità/peso della pagina, non un’accelerazione garantita della rete.

Questo riepilogo supera le descrizioni storiche sotto. L’utente ha segnalato nero dopo il tentativo di ridurre la riserva, poi ha chiesto di eliminare i costi non necessari e valutare la ricerca parallela. Scelta implementata: la sua proposta di anteprime casuali live sotto SVG, senza usare alcuna delle 99 miniature locali.

- Il build base ora include `BLUENESS_CATALOG=[]`, nessuna `BLUENESS_PREVIEWS`, nessun JPEG incorporato o fetch del catalogo. HTML circa 137 KiB (140.615 byte nella prova). I JPEG/catalogo vecchi restano su disco, non caricati dal runtime.
- SVG immediatamente visibile e trasparente; corretto il precedente `visibility:hidden` che causava schermo completamente nero quando non c’erano immagini disponibili.
- Prima del primo match blu, `previewCandidate(entry)` può disegnare una miniatura già scaricata che non ha superato il blu, limitata agli stessi fps della riproduzione. Usa direttamente `entry.media`: nessun secondo download, nessuna ricerca di avvio separata, nessuna coda extra. Le anteprime viste sono registrate con hash/URL nella cronologia persistente per non ripeterle; non entrano nell’MP4 perché non appartengono al flusso blu.
- Il controllo blu rimane sullo stesso download. Al primo match il flusso normale prende il controllo e non ci sono più anteprime casuali, neanche a coda vuota. Rimane l’ultima immagine verificata mentre cerca.
- Default Archive: una sola ricerca per volta. Le otto operazioni parallele sono download di miniature, non otto ricerche. Se l’utente sceglie esplicitamente entrambe le fonti, resta una ricerca per provider. Coda massimo12 fra pronti/preparazioni, timeout immagini4s, nessun metadato o originale durante la visione.
- Non promettere avvio fotografico istantaneo senza rete: appena aperto vede l’SVG, le immagini appaiono quando la rete risponde. Nessun fondo bianco di attesa e nessuna invisibilità del loader. L’SVG si toglie dopo5s/clic solo con una prima immagine verificata già disegnata.
- Conservati SVG `here.svg` con quadrato allineato, filtri server inclusa esclusione esatta January6, detector160px, hash24px, no clic-skip, G/A+G e preferenze. Non toccati/generati Wiki o altri progetti, nessun commit/pubblicazione.
- Test instant riscritto: server simulato inizialmente solo immagini rosse (anteprime), poi blu (flusso verificato); nessuna richiesta doppia, peak query1, SVG visibile anche offline, niente foto incorporate. Test buffer verifica 16 immagini solo live; test live priority verifica zero decodifiche locali e nessun ritorno alle anteprime dopo carenza. Test allineamento ora verifica geometria anche senza rete, con SVG visibile.


## Richiesta attuale dell’utente

Lavorare SOLO su Blueness base (`blueness/index.html`, immagini). Non modificare Wiki, Movements, Afterimage o altri progetti. Non pubblicare né fare commit senza richiesta. Conservare le numerose modifiche già presenti: non resettare il repository.

Priorità: flusso rapido e continuo, particolarmente su mobile. La riserva iniziale NON è solo un modo per mostrare presto la prima immagine: deve dare un vantaggio al precaricamento, costruendo una coda di immagini già pronte mentre procede la scoperta dal vivo. Evitare attese a scatti per ogni nuova immagine; non introdurre architetture pesanti. Continuare da questo obiettivo, senza rifare il lavoro già completato.

Nessuna ripetizione automatica, nemmeno dopo ricaricamento nello stesso browser. Non usare confronti costosi né scaricare originali per la selezione. Le frecce della cronologia possono naturalmente rivedere elementi. Le immagini devono essere reali, provenire dall’archivio. L’utente ora autorizza esplicitamente una riserva preselezionata tramite scansione reale; non presentarla come casualità globale senza riserva.

## Già completato

- Raccolta separata di 120 miniature Archive che superavano il rilevatore blu predefinito. Aggiornamento: le 99 miniature JPEG sono ora incorporate nell’HTML per evitare dipendenza dalla rete all’avvio; sorgenti in `blueness/preload/`. Il JSON catalogo continua a contenere soltanto link/metadati.
- Ultima richiesta: escludere ESPLICITAMENTE `subject:"January 6 Capitol Attack"`. Implementato nella query della SOLA versione base con `AND NOT subject:"January 6 Capitol Attack"`.
- Controllati i 120 ID con quattro ricerche Archive da 30 ID: 21 appartenevano esattamente a quel soggetto e sono stati rimossi. La riserva ora contiene **99** elementi, non più 120. Può essere rifornita con nuove immagini verificate applicando anche questa esclusione. L’esclusione generica “Capitol Attack” da sola NON aveva eliminato questi item.
- Restano i filtri precedenti Trump/MAGA/politica/USA e “Capitol Attack”/“Capitol Hill”. Nessuna analisi testuale extra dopo il download.
- Avvio: shuffle Fisher–Yates della riserva, fino a 20 candidati non già mostrati; ricerca live in parallelo. Il pump aggiunge link verificati fino a coprire 12 pronti, considerando anche le preparazioni verificate e i link già in attesa. Priorità ai verificati, con due corsie disponibili per verifiche live durante la riproduzione; in pausa/intro si privilegia il riempimento completo. Otto preparazioni simultanee e massimo 12 immagini in coda. Ogni immagine base attende esplicitamente `decode()` prima di analisi/coda. Avvio con due secondi di margine al ritmo richiesto, fino a otto pronti; fallback dopo circa 1,5 s dalla prima immagine pronta, al controllo successivo. L’intro normalmente copre il caricamento. Nessun azzeramento della cronologia a riserva esaurita.
- Deduplica: indirizzo normalizzato + impronta a doppio hash dei pixel della miniatura normalizzata a 24×24. Set per i candidati già accettati e memoria persistente degli effettivamente mostrati. Blocca duplicati identici anche con URL diversi; NON garantisce riconoscimento di ritagli o versioni ricompresse/modificate della stessa fotografia. Nessun download aggiuntivo. Chiavi `blueness-seen-v2:` incrementali: evita serializzare una cronologia crescente 4 volte/s. Legge anche la vecchia cronologia `blue-played-v1`. Se dati browser cancellati/quota esaurita, la persistenza non è garantita.
- Nessun salto tramite clic/tocco dell’immagine. Restano frecce e controlli. Su touch compare una piccola `c` per aprire il pannello.
- C può scaricare JSON della raccolta verificata (iniziale + nuove immagini compatibili), senza scritture periodiche di cache delle immagini.
- SVG utente `/Users/enrico/Downloads/blueness.svg` copiato in `blueness/intro.svg`; incorporato nella pagina dal build. Intro per 5 secondi: bianco prima del primo caricamento, poi trasparente, con immagini in riproduzione sotto l’SVG appena pronte. Primo clic lo chiude senza saltare immagini né cambiare la pausa. Le immagini sotto l’SVG contano nella cronologia e nell’export. Il generatore include intro solo se il file esiste.

## File e generazione

- Pagina da aprire: `/Users/enrico/Documents/GitHub/site/blueness/index.html` (file:// oppure hosting statico; serve Internet).
- Runtime condiviso: `tools/blue-flow.js`. Le nuove funzioni sono condizionate da `baseStills=stills&&!wiki`.
- Generatore: `tools/build-blue.mjs`. Usare **`node tools/build-blue.mjs base`**, che scrive SOLO Blueness base. `stills` riscrive anche Wiki: evitarlo per questa richiesta.
- Catalogo: `tools/catalogs/blueness-images.json` (ora 99, tutti Archive). `tools/catalogs/blueness.json` invece è il vecchio catalogo VIDEO di Movements: non confonderli.
- Scanner separato: `tools/collect-blueness-images.mjs [secondi] [target]`; usa il sito reale e lo stesso rilevatore, legge `blueStatus.verifiedImages`, salva il catalogo. Non gira nel prodotto. Attenzione: in avvio vede anche i candidati già catalogati, quindi il numero da contare per rifornire è quello dei nuovi ID/impronte. Rigenerare dopo la raccolta.
- Documentazione: `blueness/README.md`.

## Prestazioni e comportamenti da preservare

Immagini Archive via `https://archive.org/cors/{id}/__ia_thumb.jpg`: percorsi services/img e download diretti in prove precedenti NON avevano CORS leggibile. Niente metadati per immagine durante visione, anche aumentando qualità. Analisi default 160px con integrale del colore, primo quadrato accettabile; ~1ms/immagine nelle prove, contro ~0.5–1.2s rete. Trasformare ulteriormente l’algoritmo colore non risolve da solo la scarsità di pronti. Non restringere la selezione a paesaggi/sky/ocean: l’utente cerca l’inaspettato. Tag blue solo recupero, non via principale. Mai caricare originali durante il flusso normale.

G: MP4 di tutte le immagini effettivamente viste, 1080×1440, default 0.1s/immagine modificabile in C fino a 1/60s, senza audio. A+G recupera qualità maggiore SOLO su richiesta, feedback visibile; fallisce sullo stesso thumbnail se originale ambiguo/non coerente. File dedicati `tools/blueness-stills-export.js`, `tools/blueness-highres.js`, renderer `assets/shared/recording/render.js`. Conservare queste funzioni senza appesantire la visione. Encoder caricato solo durante export. E non è necessaria. Wiki è la pagina alternativa `blueness-wiki.html`, non toccarla.

Campionamento Archive: prefisso casuale identificatore, batch50 ordinati, dopo aver appreso il totale pagine casuali nella finestra10k. Non uniforme su tutta IA; batch possono concentrare uploader. Solo ID normalizzati non bastavano a bloccare foto duplicate.

## Verifiche già passate

- `node --test tools/tests/blueness-image-detection.test.mjs`: soglie blu e rifiuto viola/grigio/rosso.
- `tools/tests/blueness-no-repeat-browser.mjs`: doppioni identici sotto URL diversi, persistenza reload, clic non salta, viewport mobile390×844, query Capitol, SVG chiuso al clic senza contare immagini durante intro. Passato dopo aggiunta SVG.
- `tools/tests/blueness-stills-export-browser.mjs`: G vero MP41080×1440, durate.1/.2/1/60s, encoder lazy, nessun audio, sessione conservata.
- `tools/tests/blueness-hires-browser.mjs`: A+G stessa immagine HD e fallback, normale G senza fetchHD. Ha letto/testato Wiki senza modificarla.
- Breve prova reale precedente all’ultima pulizia catalogo:51 immagini in25s, nessun timeout in quella run. Non è una promessa4fps né un confronto controllato. Mostra che la continuità va ancora migliorata.

## Runtime di test

`PLAYWRIGHT_MODULE=/Users/enrico/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`; Chrome headless tramite exec richiede sandbox_permissions=require_escalated (azioni di test autorizzate, auto-review). Libreria MP4 fixture `/private/tmp/mediabunny.min.mjs`; ffprobe `/opt/homebrew/bin/ffprobe`.

In una fase precedente l’accesso via CUA alla tab esistente http://127.0.0.1:8091 era stato esplicitamente negato con istruzione anti-aggiramento. Non aggirare tale blocco con CDP/altri strumenti. I test isolati della pagina file:// e le richieste pubbliche Archive utilizzate sopra sono separati. Non avviare server o installare plugin inutili.

Nessun AGENTS.md trovato in precedenza. Nessun processo di test/scansione di questa chat rimane attivo al momento del passaggio.

## Verifica del precaricamento nella nuova chat

- Nuovo `tools/tests/blueness-buffer-browser.mjs`: rete simulata 450 ms per riserva, 650 ms per live, decode ritardata di 120 ms; avvio anticipato chiudendo subito l’intro. Passato: 36 immagini uniche, minimo 5 pronti durante la riproduzione, intervallo massimo 272 ms, 24 preparazioni live e 12 pronti dopo pausa. Verifica che i pixel non vengano usati prima della decodifica.
- Prova reale isolata file://, viewport mobile: 76 immagini uniche nei 25 s dall’apertura (inclusi 5 s d’intro), minimo 3 pronti nei campioni di cambio immagine, massimo intervallo 276 ms, 9 pronti alla fine, 2 timeout e nessun errore finale. Singola misura, non benchmark controllato né promessa di velocità.
- Rilevatore blu e `git diff --check` passati. Nessuna pubblicazione/commit; rigenerato esclusivamente `base`. README corretto per descrivere la riserva e il nuovo avvio.

Ultima richiesta: immagini visibili sotto l’SVG appena pronte. Implementato avvio immediato durante intro, senza il margine iniziale obbligatorio; buffer e preparazioni restano attivi. Il test no-repeat ora verifica riproduzione sotto SVG trasparente e chiusura senza salto/ripresa involontaria dalla pausa. Le precedenti verifiche che richiedevano zero immagini mostrate durante intro sono superate da questa richiesta.

## Stato corrente — annullata la riproduzione sotto SVG, avvio locale

La richiesta più recente annulla la riproduzione sotto l’SVG e chiede prime immagini immediate. Runtime già ripristinato con intro bianca/pausa; eliminata l’attesa iniziale per otto pronti o 1,5 secondi. Aggiunte copie JPEG reali delle 99 miniature già verificate in `blueness/preload/` (1.526.438 byte totali), scaricate dagli URL originali senza conversioni. Il generatore include `BLUENESS_PREVIEWS` come data URL solo in base; prepare usa questi byte, con gli stessi controlli blu/decode/deduplica. La raccolta esportata mantiene gli URL originali. Wiki non rigenerata. La riserva vista non si ricicla: a esaurimento dipende dalla ricerca live.

Nuovo test `tools/tests/blueness-instant-browser.mjs`: rete completamente offline, almeno otto pronti sotto intro, nessuna immagine mostrata prima della chiusura; prima immagine 35 ms dopo clic di chiusura nella prova, otto immagini mostrate e reload senza ripetizioni. Il test buffer ora usa una copia HTML temporanea senza miniature incorporate per verificare separatamente il fallback di rete. Il test no-repeat considera esaurita la riserva per esercitare la deduplica dei risultati live. Le descrizioni storiche di riproduzione sotto SVG e attesa iniziale sono superate.

## Ultimo aggiornamento — live prioritario, riserva solo avvio/soccorso

L’utente chiede che il mix sparisca presto: nessuna quota fissa della riserva durante la riproduzione. Runtime semplificato: seed iniziale di due miniature, stop alle preparazioni della riserva quando ci sono almeno due pronti (live o riserva). Otto normali download dedicabili interamente al live; sotto due pronti viene preparata una sola miniatura locale alla volta, anche con gli otto download live occupati. La selezione mostra per primi i risultati live già pronti, prima dei pronti della riserva. Le 99 miniature restano incorporate come byte, senza decodifica/analisi simultanea né download della riserva all’apertura. Nessuna modifica a Wiki o altri progetti.

Test dedicato `blueness-live-priority-browser.mjs`: sorgenti live compatibili con latenza simulata; verifica otto download live paralleli, al massimo due decodifiche della riserva all’avvio, nessuna ulteriore preparazione della riserva durante un flusso live sano e visualizzazione esclusiva delle immagini live pronte. Test offline adattato a due pronti; test buffer ora esercita il soccorso locale con risultati live duplicati.

## Ultima correzione UX — SVG sopra immagini, nessun nero intermedio

L’utente precisa il flusso: SVG con immagini locali immediatamente sotto, rimozione SVG, prosecuzione con live. Ripristinata riproduzione attiva durante intro, mantenendo il soccorso locale piccolo e la priorità live. Il fondo bianco dell’intro diventa trasparente soltanto DOPO il primo disegno effettivo dell’immagine nel canvas. Clic e timer eliminano l’SVG solo con un’immagine già disegnata; se troppo anticipati, impostano una richiesta di chiusura completata al primo disegno. Nessuna ripartenza/salto/cambio pausa alla chiusura. I precedenti stati di intro opaca con riproduzione in pausa sono superati. Test instant aggiorna il caso offline e simula decode lento con clic anticipato per verificare assenza di nero; test live ammette solo le pochissime immagini locali necessarie prima che il live sia pronto, poi nessun’altra preparazione della riserva se il live è sano.

## Nuovo SVG allineato al quadrato

Sostituito `blueness/intro.svg` con `/Users/enrico/Downloads/here.svg` (testo vettoriale Times bold, freccia e quadrato). Aggiunto `data-blue-anchor="1"` al rettangolo originale x413/y416/lato183. `alignIntro()` scala l’intero SVG affinché quel rettangolo coincida esattamente con `settings.size` e con il centro della prima scena di `screens()`, aggiornando su resize e controlli. Nessuna ricostruzione tipografica o font da caricare. Restano immagini sotto SVG, rimozione senza nero, priorità live e soccorso locale minimo. Test di allineamento dedicato mobile/desktop/viewport dispari/dimensione80/layout doppio, oltre al test instant offline.

## Ultima richiesta — avvio scaricato, poi esclusivamente nuovi risultati

Semplificazione del passaggio: `liveOnly` diventa true al primo risultato live valido (dopo blu/deduplica). Da quel momento nessun seed/preparazione locale, si eliminano i link e i pronti della riserva e si rilasciano i media inutilizzati; un eventuale locale in corso viene scartato senza reinserirlo. `advance()` torna alla normale coda FIFO, senza mix o ricerca della categoria da mostrare. Le immagini recuperate dalla ricerca usano sempre il loro URL remoto, anche se un id esiste nelle 99 incorporate. Se il live si svuota, resta l’ultima immagine mentre continua a cercare: non torna alla riserva. Durante l’avvio, prima del primo live valido, restano due pronti locali con una decodifica alla volta; SVG e allineamento invariati. `blueStatus.phase` espone startup/live per verifiche.

Costi da spiegare: HTML ~2,2 MB con 99 miniature codificate (~1,53 MB JPEG), costo di apertura ma nessun download di riserva durante la visione né decodifica di tutte; rete e rarità dei match dominano i tempi live; analisi blu160px e hash24px necessari; cronologia persistente piccole scritture sincrone; JPEG delle immagini mostrate per export richiede poca elaborazione per immagine e memoria crescente, encoder MP4 e HD solo su richiesta. Nessuna modifica a export, filtri o altri progetti. Test priorità live esteso a una successiva carenza per verificare che il locale non riparta e l’ultima immagine resti visibile. Test buffer ora usa candidati live rossi per coprire solo la fase prima del primo match.

## Ultima modifica — niente fondo bianco, poche miniature per avvio

Richiesta: eliminare il bianco sotto SVG e ridurre le immagini precaricate; proposta alternativa dell’utente di usare casuali non verificate sotto intro non implementata, perché manterrebbe dipendenza dalla rete. Si conserva la soluzione locale con immagini reali di Archive. Build ora incorpora solo 24 miniature (i 99 JPEG originali restano su disco); pagina circa 730 KB invece di 2,2 MB. Seed base filtra le immagini non incorporate per non scaricare la riserva residua. Il ritmo locale resta lo stesso del live (default4/s), una sola decodifica e circa due pronti. Il div SVG è trasparente fin dall’inizio e inizialmente invisibile; appare nello stesso frame del primo disegno reale dell’immagine. Disattivato il primo disegno canvas nero/quadrato blu senza immagine nella sola versione base. Nessun fondo bianco di attesa. Restano allineamento geometrico SVG, chiusura dopo primo disegno e passaggio definitivo a soli nuovi risultati. Vincolo inevitabile: a tutte le 24 già viste, attende il live senza ripetizioni. Test instant aggiornato a 24 incorporate; test buffer limitato a16 immagini per non esaurire il piccolo avvio locale.

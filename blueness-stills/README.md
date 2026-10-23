# Blueness stills

Aprire `index.html` nel browser oppure pubblicare la cartella su un server statico/GitHub Pages. La pagina è autonoma, ma necessita di Internet per le immagini e le ricerche.

Immagini casuali di Internet Archive, verificate sul blu con lo stesso rilevatore di Blueness: zoom e posizionamento mantengono il quadrato fisso al centro. Nessuna dissolvenza. Il primo elemento compatibile viene mostrato senza aspettare il batch; durante una carenza di immagini pronte rimane l'ultima. Target 4 immagini/s, regolabile fino a 10; il ritmo reale dipende da rete e percentuale di immagini compatibili. Miniature da 320 px, 8 preparazioni simultanee, fino a 36 immagini pronte. Nessun filtro tematico; anti-ripetizione persistente condivisa con le altre varianti Blueness.

La pagina incorpora 24 immagini Archive verificate, mischiate casualmente e saltate se già viste: accelerano il primo avvio senza limitare la ricerca successiva. Vengono ricontrollate con i parametri correnti. Nessun encoder è attivo durante la visione; la libreria MP4 esterna viene caricata soltanto premendo G.

C: controlli di colore, dimensioni/zoom, velocità, qualità, archivi e doppio schermo. Spazio: pausa/riprendi; frecce: cronologia; clic: prossima immagine pronta; F: schermo intero. `?dual=1` simula due schermi; `?source=commons` e `?source=both` cambiano la sorgente (anche da C). La fonte dell'immagine corrente è collegata nei controlli.

Confronto del 23 ottobre 2026: due prove da 30 s per fonte, contesti browser nuovi e paralleli, senza catalogo iniziale, stessi parametri. Dopo aver evitato il riuso dello stesso batch casuale Commons: Archive 47 e 39 immagini mostrate; Commons 12 e 7. Primo elemento: Archive 9,20 e 2,85 s; Commons 10,25 e 11,44 s. Scelta predefinita: Archive. Campione piccolo e variabile, non una garanzia di prestazioni. I risultati completi sono in `tools/blueness-stills-benchmark.json`. Le miniature mancanti o scadute vengono scartate.

Per rigenerare solo questa pagina: `node tools/build-blue.mjs stills`. I sorgenti condivisi sono in `tools/blue-flow.js`; il catalogo iniziale è `tools/catalogs/blueness-stills.json`.

## MP4 della sessione · G

G scarica `blueness-stills.mp4` a 1080×1440 px, senza audio, con tutte le immagini effettivamente mostrate nella sessione, in ordine di prima apparizione. Tornare indietro nella cronologia non duplica un'immagine. Nessuna selezione né taglio. La porzione centrale in 3:4 mantiene il posizionamento mostrato, compreso il quadrato; i controlli sono esclusi. Ogni immagine dura 0,3 s; in C → esportazione MP4, lo slider varia da 0,1 a 2,0 s in passi da 0,1. La preferenza resta nel browser. Lo stato mostra numero immagini, durata prevista e avanzamento dell'esportazione.

Si conservano in memoria una copia JPEG della sorgente già caricata e il suo posizionamento, senza nuovi download. Il montaggio e la codifica avvengono solo su richiesta: la visione si mette temporaneamente in pausa e riprende alla fine se era in corso. Q annulla l'elaborazione. Esportare non svuota la sessione: un successivo G comprende anche le nuove immagini; ricaricare la pagina comincia una sessione nuova.

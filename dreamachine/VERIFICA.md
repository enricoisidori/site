# Verifica eseguita il 12 ottobre 2026

- 6 test automatici superati: keyword, query, match, file leggeri, buffer senza buchi, limite byte del download.
- Prova ripetibile in Chrome superata: avvio con informazioni nascoste, I/M/F, due transizioni, match evidenziati, singolo lettore visibile, riproduzione da Blob e assenza di errori JavaScript. Questa prova controlla rete e modello con fixture e non misura la qualità del riconoscimento.
- Prova live separata con Chrome, Transformers.js, pesi Hugging Face e Internet Archive effettivi: due passaggi consecutivi completati. Esempio osservato: Folgers Coffee Commercial 2 → query `hat OR beer` nei campi title/subject → “Wow, Our NIO EC6's Nomi got a hat!” → query `dark OR room` → filmato Android Dark Theme. I contenuti effettivi variano a ogni avvio.
- Descrizioni osservate in circa 1,7–3,6 secondi nella sessione di prova. È una misura su questa macchina, non un benchmark universale.
- I download Archive hanno mostrato variabilità, timeout e singoli errori CORS. Il lettore ha continuato a ripetere il frammento locale durante i tentativi; i candidati falliti sono stati scartati. Le due transizioni live della prova con filtro iniziale da 8 MB sono avvenute entro circa 125 secondi complessivi, con quattro ripetizioni: la preparazione non è sempre rapida quanto l'inferenza.
- I tre file di avvio sono stati verificati con ffprobe e decodifica ffmpeg: 28/28/32 secondi, circa 310–522 KiB. Nessun accesso a modello remoto per inferenza o chiave API.

Non è stata eseguita una prova di durata infinita né una misura strumentale di frame persi su tutti i dispositivi. Il modello può descrivere male scene sfocate, titoli o dissolvenze; il codice finale attende almeno due secondi dopo il cambio prima della cattura. Il comportamento dei controlli e della catena dopo tale modifica è coperto dalla prova browser ripetibile.


## Aggiornamento: avvio live e fallback

8 test automatici superati, inclusi assenza di filtri di collezione/peso totale dell'item, suddivisione degli indici grandi e inclusione dell'ultima pagina. Prova browser controllata superata: nessuna richiesta di startup.json o video locali, due cambi semantici, I/M/F, clic alla fonte in nuova scheda, cambio a riserva casuale quando il modello non risponde. Il tentativo reale di richiedere la pagina 10.001 è stato rifiutato da Archive con DEEP_PAGING; il campionamento usa ora partizioni di identificatore. Le precedenti misure live con avvio locale non misurano la latenza del nuovo avvio live.


## Streaming dei filmati lunghi

10 test automatici superati. Aggiunti controllo dei derivati lunghi a basso bitrate e scelta del frame dello stesso file originale. La prova browser verifica anche lo stream nativo e il caricamento di una scena Archive quando il canvas del video è protetto da CORS.

Prova live aggiornata: avvio da `1boy 2kittensvideo`, scelto dall'indice generale, e passaggio entro circa 60 secondi a `wdsu-6-news-start-april-14-1996-start-a` come fallback casuale generale. Il secondo lettore stava riproducendo da un punto casuale a circa 185 secondi del filmato. Nessun seed locale o riavvolgimento del video corrente in questa prova. I tempi restano dipendenti da Archive e non dimostrano una partenza istantanea.


## v2 · streaming e coda persistente

Backup della v1 creato prima delle modifiche: `../relay-backups/relay-v1-20261012-180426.zip`. Verificati i 15 file rispetto al manifest SHA-256 affiancato.

10 test automatici superati: keyword, query senza collezioni o popolarità, limite 10k, singola richiesta iniziale, match, durata minima 30s/derivati lunghi, buffer continuo, scena dello stesso file, pagina condivisa fra preparatori e limite di concorrenza con annullamento.

Prova browser controllata superata: sei lettori, avvio senza seed, MP4 richiesti solo come media nativi (nessun fetch integrale o Blob), query e match, cambio automatico dopo 30s, clic su riserva in meno di 1,5s senza nuove schede, i/m/f, Helvetica minuscola, modello bloccato con fallback a 60s, nessuna riserva con waiting/noise e nessun riavvolgimento. La prova modifica il clock della pagina per controllare i limiti temporali: non è un benchmark reale della rete.

Prova live separata con modello e Internet Archive effettivi: al primo campionamento, circa 5 secondi dopo l'apertura, `https://archive.org/details/dusk` stava già riproducendo (currentTime circa 0,065s). Nel campionamento a 50s aveva circa 39s di buffer e due casuali pronti. Una descrizione ha richiesto circa 3,45s e prodotto `clock`, `wall`; è stata scelta la keyword `clock`. Al campionamento a 55s era in riproduzione `https://archive.org/details/youtube-IQe5IhSo5ng` (“Burn Ban Clock N Gears…”), con collegamento nella query, zero fallback e ancora due riserve casuali pronte. Il nuovo video era attivo da circa 4s: il cambio è quindi avvenuto attorno a 51s.

Questa singola esecuzione conferma un miglioramento dell'avvio osservato, senza garantire tempi uguali su altre connessioni, item o dispositivi. Fonte remota e decodifica possono ancora fermarsi; le riserve e waiting gestiscono i casi osservabili, non eliminano ogni limite della rete.


## dopo il backup v2

Copiata da afterimage con le sole variazioni di sorgente e nome. Nessuna prova eseguita, come richiesto dall’utente; le verifiche sopra documentano versioni precedenti e non certificano questa copia.

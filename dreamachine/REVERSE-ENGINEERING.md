# PLAYPLAYPLAYPLAY — analisi del sorgente

Sorgente scaricato direttamente dal repository pubblico il 12 ottobre 2026:
https://github.com/jacoponatoli/PLAYPLAYPLAYPLAY/blob/54440399711fbe1e8ccd4abdd5cd5b7eee511eb2/index.html

Il tool MCP Decompile non è disponibile nella sessione. Il reverse engineering è stato eseguito leggendo il sorgente originale, senza dedurre il comportamento soltanto dall'aspetto del sito.

## Casuale oppure lista fissa?

`VIDEO_SOURCES.archive.search`, righe 592–619 della revisione indicata, interroga `advancedsearch.php`.

1. Costruisce `mediatype:movies AND (subject:"term" OR title:"term")` se esiste una query; altrimenti `mediatype:movies`.
2. Prova un filtro formato `MPEG4`/`h.264`; senza risultati riprova senza filtro.
3. Memorizza query e conteggio in `vtotals`.
4. Sceglie una pagina da 50 risultati: da 1 a `min(floor(n / 50), 200)`, con minimo una pagina.
5. Varia l'ordinamento: downloads asc, addeddate asc/desc, identifier asc/desc.
6. Il gestore delle sorgenti mescola i candidati e li risolve via `metadata/identifier`.
7. `resolve` preferisce un MP4 derivato, scelto casualmente, e restituisce un URL diretto `/download/identifier/file`.

Quindi **non c'è una lista fissa di filmati**. La casualità è però parziale: ciascun ordinamento considera una finestra fino a 10.000 risultati; non tutti gli item hanno pari probabilità e il campionamento non copre uniformemente ogni filmato di Archive. I filtri/query restituiscono metadati, senza scaricare o analizzare prima i video: questo spiega la rapidità apparente del filtro. Il sito originale usa inoltre diverse sorgenti e collezioni; Relay usa solo Internet Archive.

## Perché il cambio sembra immediato?

`VideoEngine`, righe 2416–2508:

- crea 6 elementi video su desktop, 4 su mobile, 3 con risparmio dati;
- tutti restano collegati al DOM, con `preload="auto"`, `playsInline` e `loop=true`;
- ciascun lettore cerca e prepara un candidato in parallelo;
- sceglie un punto casuale del filmato e attende che `video.buffered` copra tutto il frammento richiesto;
- i frammenti sono molto brevi: 1–10 secondi, 3 secondi nell'URL fornito (`s=3`);
- dopo 12 secondi ammette anche `readyState >= 3`, una soglia meno prudente;
- i lettori pronti entrano in `readyQ`;
- `cut()` rivela un lettore già pronto cambiando una classe CSS e riutilizza quello precedente;
- non aspetta un download intero e non esegue riconoscimento visivo.

Il lavoro di caricamento esiste, ma viene svolto mentre è visibile un altro filmato. Frammenti brevi, più lettori nascosti e loop coprono parte della variabilità della rete. Un video mai preparato non parte magicamente in tempo zero.

## Parti ricostruite in Relay

- Query nei campi `subject`/`title`, pagina casuale da 50, cache dei conteggi e stessi ordinamenti. Più keyword diventano clausole OR. Il filtro aggiuntivo sul peso totale dell’item parte da 8 MB e si amplia a 25 MB dopo due tentativi senza candidati leggeri.
- Metadati → selezione MP4 → preparazione nascosta → promozione di un lettore già presente nel DOM.
- Controllo esplicito del buffer e frame decodificato prima di nascondere il precedente.

## Modifiche per la catena causale

Il successore non può essere scelto prima di conoscere il contenuto del corrente. Sei casuali indipendenti già in coda spezzerebbero il requisito. Relay usa pertanto il corrente più due candidati in competizione, **entrambi appartenenti alla query derivata dal corrente**.

Il fotogramma viene letto dal vero video riprodotto (Blob locale), senza usare copertine o titoli come sostituti della visione. Il worker produce una descrizione, il codice estrae keyword, Archive cerca titolo/soggetti, e i metadati del candidato sono ricontrollati. Il pannello I mostra il collegamento in entrata e la ricerca in uscita separatamente, evitando di attribuire al video una query ricavata da un altro fotogramma.

Per contenere il rischio di arresti si preferiscono file piccoli, scaricati interamente, e frammenti di 24 secondi. L'avvio locale copre anche il primo caricamento del modello. In attesa di un successore valido si ripete il frammento corrente; non si inserisce un casuale non correlato. La documentazione esplicita il costo di questa scelta: meno file eleggibili e possibili ripetizioni durante ricerche lente.


## Aggiornamento richiesto dall'utente

L'avvio locale e il loop descritti sopra documentano la prima versione. Nella versione attuale sono rimossi: avvio con ricerca live, nessun filtro di collezione o peso totale dell'item, partizioni casuali per superare il limite di paginazione di Archive, quattro lettori con riserva casuale generale indipendente dal modello, clic sul video alla fonte. I candidati della query hanno priorità sulla riserva. I filtri sui singoli file leggeri restano attivi. Vedi README.md per il comportamento attuale.

I derivati lunghi a basso bitrate sono ora supportati in streaming con buffer completo del frammento. Per la visione si usano, se necessario per CORS, le scene Archive dello stesso file e del tempo più vicino; il pannello dichiara la differenza rispetto al frame esatto.


## v2 · semplificazione richiesta

La versione corrente torna alla finestra fino a 10.000 risultati per query e ordinamento: niente prefissi o conteggi per partizioni. La query generale parte con una richiesta; quelle semantiche condividono conteggi e pagine. Ordinamenti solo per identificatore/data di aggiunta, mai popolarità.

Rimosso ogni download integrale MP4: tutti i lettori sono stream nativi. Sei lettori in DOM, due riserve generali persistenti e fino a tre candidati di una keyword estratta dal corrente, massimo tre preparatori media contemporanei. I file devono durare almeno 30s; la riproduzione automatica va da 30s fino a 60s, salvo recupero da fine file o arresto. Il clic promuove un video pronto, senza aprire schede. Waiting/noise copre l'avvio e la coda vuota, con Helvetica minuscola.

La v1 precedente è conservata nel backup verificato indicato in README.md.

# afterimage

La v2 richiesta dall'utente è conservata in `../relay-backups/relay-v2-20261012-190105.zip`, con manifest SHA-256 affiancato. Contiene anche ricerca limitata al titolo e noise disattivato, così come erano prima delle modifiche successive.

## comportamento attuale

- Solo Internet Archive, streaming nativo, nessuna collezione obbligatoria. Finestra fino a 10.000 risultati per query, senza ordinamento per popolarità. Il filtro esclude trailer, spot, videogame, news, podcast, commerciali, pubblicità, TikTok, compilation e tutorial.
- Il modello locale ViT–GPT2 q8 produce una descrizione. Prima le keyword venivano estratte escludendo molte parole generiche (anche `man`, `woman`, `people`, `person`) e la scelta era casuale: questo favoriva gli oggetti.
- Ora le parole relative alle persone sono ammesse. Le keyword sono ordinate da una piccola euristica locale: penalità per parole molto generiche/comuni, preferenza per espressioni composte e parole più specifiche. Professioni e ruoli non vengono penalizzati in quanto persone. Non è una misura reale della frequenza linguistica: non si aggiungono modelli, richieste di rete o inferenze.
- Si cerca prima la keyword con punteggio maggiore, poi le altre se una query non dà risultati. La keyword deve comparire nel **titolo come parola intera**; viene evidenziata nel pannello.
- Nessuna durata minima del video sorgente, salvo durata nulla/non riproducibile. Il successore della query viene promosso appena pronto. A 30 s il video passa normalmente alla riserva; l'unica estensione possibile è fino a 60 s, solo se lo stream attivo ne dispone e nessun successore della query è pronto. Poi usa una riserva casuale; senza riserve resta il noise. Nessun loop.
- I candidati della query hanno priorità sia nell'assegnazione dei lettori liberi sia nella coda dei preparatori media. Le due riserve generali restano disponibili come fallback. Anche il clic preferisce un candidato della query già pronto, poi un casuale.
- Noise iniziale più fine (fino a 960 px di larghezza), aggiornato a 30 fps e senza testo. Alla partenza, la luminanza del noise congelato determina l'alpha: i pixel scuri diventano trasparenti prima di quelli chiari, rivelando il video in circa 2,6 s. È una maschera luma sul noise, non una lettura del video tramite canvas; funziona anche con stream protetti da CORS. Il favicon diventa il fotogramma usato dal modello. Helvetica minuscola e rispetto del movimento ridotto.

## avvio e controlli

Da `site/afterimage`: `python3 -m http.server 8091 --bind 127.0.0.1`, poi http://127.0.0.1:8091/. Compatibile con hosting statico HTTPS. Nessuna chiave API.

`i` informazioni e fonte; `m` audio; `f` fullscreen; `c` alterna fit/fill; clic per un altro lettore già pronto. Il clic non avvia download o nuove schede e resta inattivo se la coda è vuota.

Il modello richiede circa 247 MB al primo download, poi può usare la cache del browser. Le inferenze avvengono sul dispositivo. Per gli stream non leggibili da canvas si cerca una scena `.thumbs` dello stesso file e del tempo più vicino; il pannello dichiara questa approssimazione. La disponibilità della rete resta necessaria per Archive.

## verifica

Su richiesta dell'utente, **nessuna prova eseguita dopo queste ultime modifiche**. Le verifiche documentate in VERIFICA.md si riferiscono alle versioni precedenti. I vecchi test temporali del browser descrivono ancora il comportamento v2 (minimo 30 / massimo 60) e devono essere aggiornati prima di essere usati per questa versione.

La fixture locale in `tests/fixture.mp4` è usata soltanto dai test: estratto pubblico dominio di [Chevrolet Commercial](https://archive.org/details/chevrolet), mai caricato dal player normale. Cronologia tecnica in [REVERSE-ENGINEERING.md](./REVERSE-ENGINEERING.md).

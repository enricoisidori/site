# observation

Pagina statica autonoma: aprire `index.html`, usare Live Server / `serve`, oppure il link GitHub Pages. Non richiede build per l’uso, chiavi, account o backend. Lo stesso HTML contiene applicazione e worker; non usa percorsi assoluti verso file locali. La modalità `file://` è predisposta ma non verificata dal browser automatico, che permette solo HTTP/HTTPS. Serve Internet per Archive, libreria e primo download dei pesi del modello.

`I` mostra video → descrizione → keyword → query → nuovo video, con parole riscontrate evidenziate nel titolo, nei soggetti o nella descrizione. Ogni tempo specifica quale operazione e quale candidato misura; 1000 ms = 1 secondo. La dimensione in MiB è il totale dichiarato nei metadati, non i byte già trasferiti. `W` mostra solo parole bianche centrate. Entrambi spenti di default. Audio muto per autoplay; un click riprende se il browser lo sospende.

## Catena e caricamento

- Primo item casuale da una ricerca live, preferibilmente runtime di un minuto. Nessun catalogo, video introduttivo o lista precostituita. La casualità campiona i primi 24 risultati e non è uniforme su tutto Archive.
- MP4 massimo **6 MiB**, preferendo bitrate inferiore. Streaming `/cors/`: il primo video parte appena decodificabile; un solo successore viene preparato con almeno due secondi di buffer. Il browser può limitare il precaricamento: dopo 20 secondi si accetta almeno un secondo disponibile, altrimenti si scarta il file.
- Durante la riproduzione ViT–GPT2 q8 descrive un fotogramma in un worker WASM sul dispositivo. I pesi vengono scaricati al primo uso, senza bloccare il primo video. I fotogrammi non sono inviati a un servizio.
- Parole estratte dalla caption, ricerca AND poi OR in titolo/soggetti/descrizione. La ricerca filtra item piccoli; verifica fino a quattro schede per query e si ferma al primo candidato adatto. Priorità: copertura delle parole, titolo, soggetti, descrizione. Verifica nuovamente i metadati effettivi prima di aprire il video.
- Cambio a circa 60 secondi di riproduzione, oppure alla fine dei video più brevi, quando il successore è pronto. Nessun loop, nessuna riserva parallela. Se il successore tarda, il caricamento resta visibile su nero. Nuovo casuale solo dopo l’esaurimento della ricerca correlata. Candidati falliti rilasciati prima di riprovare in sequenza; errori persistenti ritentati dopo 15 secondi.
- Identificatori già riprodotti esclusi nella stessa sessione della scheda, anche dopo reload. Copie sotto identificatori diversi non riconosciute.

La corrispondenza nei metadati prova un legame testuale, non l’identità visiva: caption errate e legami metaforici restano possibili. Non è un filtro sui contenuti. Streaming e un solo successore non garantiscono assenza di pause su host lenti.

## Misure e confronto con PLAYPLAYPLAYPLAY

Il [codice del riferimento](https://github.com/jacoponatoli/PLAYPLAYPLAYPLAY/blob/main/index.html) usa MP4 diretti, segmenti brevi e una coda di più video precaricati. Qui si mantiene lo streaming ma con un solo successore, rispettando il vincolo; non vengono copiate chiavi o servizi del riferimento.

`measure.html` è una pagina separata di misura, non una playlist usata dall’app. Prova Chrome del 12 ottobre 2026, stessi file, streaming prima del download completo (possibili effetti cache/host):

| File | Totale file | Metadati | Primo frame streaming | Download completo |
| --- | ---: | ---: | ---: | ---: |
| Tempe Town Lake PSA | 6.260.842 byte | 2.838 ms | 2.084 ms | 6.651 ms |
| TikTok 7605755333562158349 | 1.423.804 byte | 6.288 ms | 6.831 ms | 5.669 ms |

Entrambi riproducibili, fotogrammi leggibili dal canvas. Una terza richiesta metadati è scaduta dopo 15 s. Nel file da 6 MB lo streaming ha anticipato l’avvio; nel piccolo la latenza del server ha prevalso. La dimensione da sola non predice la velocità. Decisione: streaming, limite ridotto da 18 a 6 MiB e filtro anticipato degli item, evitando l’attesa obbligatoria di tutto il download. Il primo avvio reale precedente alla semplificazione della query ha richiesto 68,24 s: resta un problema di latenza Archive, non va nascosto nelle misure del solo primo frame.

Per modificare i sorgenti: `python3 observation/build.py`. Verifica: `node --test observation/compatibility.test.mjs`. Non serve nessun comando a chi apre la pagina già generata. Vedi `VERIFICA.md` per prove e limiti storici.

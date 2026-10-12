# Afterimage e Dreamachine

| | Online / Live Server | Locale con doppio clic |
| --- | --- | --- |
| Afterimage | afterimage/index.html | afterimage-local/index.html |
| Dreamachine | dreamachine/index.html | dreamachine-local/index.html |

Le copie locali incorporano codice e CSS; usano un worker Blob classico con importazione dinamica del bundle autonomo Transformers. Non richiedono server, terminale, Python o configurazione. Serve Internet per Archive, CDN e il modello (circa 247 MB al primo caricamento). Non sono versioni offline.

Online si usa il normale fetch; dopo un errore la ricerca prova JSONP Archive e poi l'endpoint scrape. Con file:// si usa direttamente JSONP per la ricerca. Il recupero scrape applica gli stessi filtri, ma campiona il lotto restituito di 100 elementi anziché una pagina casuale nella finestra fino a 10.000 risultati. Se tutti gli endpoint falliscono, il pannello mostra l'errore. Il codice non richiede un proxy esterno.

## Controlli

I informazioni, M audio, F schermo intero, C fit/fill, S esportazione JSON della catena. Primo clic ovunque: solo audio. Clic successivi o freccia destra: successore già pronto, preferendo quelli della query. Nessun pulsante iniziale aggiunto; il video parte muto secondo le regole di autoplay del browser.

Il limite assoluto è 30 secondi, senza estensioni. Il successore della query parte appena pronto, anche prima; al limite si usa una riserva casuale, oppure si sospende il video se non ci sono riserve.

## Caricamento e cronologia

Caricamento: anteprime Archive FIFO senza ripetizioni, prima subito disponibile, tre download paralleli. Quando il video è pronto: SVG su bianco per 3 secondi, solo bianco per 1 secondo, poi dissolvenza di 3 secondi al video. afterimage: query globale con esclusioni complete; dreamachine: Prelinger preferita (3/4) senza etichette positive obbligatorie; fuori da Prelinger resta domestico/amatoriale AND non montato. Query nel titolo ed esclusioni restano attive.

Il pannello I distingue catena in entrata e in uscita, evidenzia la keyword nel titolo e mostra collezioni (con link), autore, uploader, data, lingua, descrizione, soggetti, formato, durata sorgente e diritti disponibili. La cronologia conserva fino a 2.000 video, con descrizione, keyword, query tentate e successore; i fallback sono espliciti. Il salvataggio è automatico nel localStorage del browser, separato per progetto; se non disponibile viene indicato, e S permette comunque l'esportazione dalla memoria. Eliminare i dati del sito elimina la cronologia; spostare il file locale o cambiare browser può cambiare lo spazio di archiviazione.

## Sviluppo e verifica

I sorgenti sono nelle due cartelle online. tools/build-local.mjs rigenera entrambe le copie locali; non modificarle separatamente.

Il 12 ottobre 2026, controllo in Chrome delle quattro versioni: riproduzione, worker, caption → keyword → titolo, salvataggio, esportazione, fit/fill; verifica anche del recupero dopo errore di rete e del limite assoluto di 30 s. Le risposte del modello e i media di questo controllo erano fixture per evitare il download dei pesi. Separatamente verificate due query reali con tutti i filtri e l'importazione reale della libreria nel worker file://. Non eseguita un'inferenza completa del modello reale in questa revisione, né un collaudo specifico in Safari/Firefox.

Esecuzione del controllo: tools/check-video-versions.mjs richiede Playwright e Chrome nell'ambiente di sviluppo. Non è una dipendenza di chi usa il player.

Revisione successiva: eliminata l'estensione; il limite è assolutamente 30 s. Il controllo del fallback verifica ora permanenza prima del limite e sostituzione al suo raggiungimento.

## Flusso di sole immagini

image.html è autonomo, utilizzabile via HTTP o apertura diretta file:// con Internet. Mostra anteprime leggere casuali da Archive, senza interfaccia, testi o dissolvenze. Coda FIFO senza ripetizioni nella sessione, quattro immagini in preparazione e fino a dieci pronte/in caricamento; cambio circa ogni 120 ms se disponibile. Ricerca per prefissi casuali di identificatore, ordinamenti variabili e pagine casuali fino a 10.000 risultati per prefisso; non è un campionamento uniforme di tutta Archive. tools/build-image.mjs rigenera il file da tools/image-flow.js e dal trasporto Archive condiviso. Le immagini iniziali dei lettori video ora vengono decodificate prima della visualizzazione e scambiate come elementi già pronti.

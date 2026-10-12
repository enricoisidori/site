# Studio del lettore PLAYPLAYPLAYPLAY

Riferimento studiato il 12 ottobre 2026: https://jacoponatoli.github.io/PLAYPLAYPLAYPLAY/?m=video&q=blood%2Cviolent&s=var

Codice pubblico: https://github.com/jacoponatoli/PLAYPLAYPLAYPLAY/blob/main/index.html

## Cosa fa il riferimento

- VIDEO_SOURCES.archive cerca direttamente in titolo e soggetti con advancedsearch.php, memorizza i conteggi, prende pagine da 50 risultati e varia ordinamento e pagina.
- Legge metadata/identifier, preferisce i derivati MP4 e passa al lettore l'URL /download/identifier/file.
- VideoEngine usa 3–6 lettori nascosti, preload auto, loop attivo. Prepara frammenti di 1–10 secondi, controllando video.buffered. Dopo 12 secondi può accettare anche readyState >= 3 senza il buffer completo del frammento.
- I lettori pronti entrano in una coda; il cambio rivela un elemento già collegato al DOM. Il vecchio lettore viene liberato e riutilizzato.
- Non scarica tutto il video con fetch e non fa riconoscimento dei fotogrammi.

La fluidità dei suoi frammenti brevi non dimostra che un minuto intero possa essere riprodotto senza interruzioni sulla stessa connessione. I loop e la coda di più video contribuiscono a coprire le attese.

## Applicazione al nostro progetto

Implementazione autonoma delle parti utili: URL diretto per il lettore, buffer verificato e cambio senza spostare l'elemento video. Conservati concatenamento visivo, storico persistente, assenza di loop e scoping diverso di Dreamachine. Nessuna copia integrale del progetto di riferimento.

Per il riconoscimento usiamo i JPEG temporizzati .thumbs già estratti da Archive. Esempio effettivamente verificato:
https://archive.org/cors/BellyButtonFilm/BellyButtonFilm.thumbs/BellyButton_000020.jpg

Risposta HTTP 200, image/jpeg, Access-Control-Allow-Origin: *, 6674 byte, circa 4 secondi nella prova. Il frame è del video originale al secondo 20, non un'anteprima generica dell'item. La selezione non sostituisce mai un frame appartenente a un altro file nello stesso item. Il fotogramma può non coincidere precisamente con quello visualizzato. Per gli item senza scene disponibili la visione non viene inventata.

## Verifiche e limiti

116 test automatici superati, inclusi selezione del fotogramma per file e timestamp, campi di ricerca, storico, scope e grafo degli import. Endpoint JPEG verificato via rete. La verifica interattiva della pagina locale è stata bloccata dal controllo automatico degli URL del browser: avvio e fluidità reali della nuova versione non sono ancora confermati. Nessuna pubblicazione o commit eseguiti.

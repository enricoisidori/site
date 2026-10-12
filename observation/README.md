# observation

Pagina statica autonoma: `index.html` contiene codice applicativo e sorgente del worker. Non richiede chiavi, account o backend.

- Senza server: aprire `index.html` direttamente nel browser (doppio click).
- Con server locale: dalla radice del repository eseguire `python3 -m http.server 8765`, poi aprire http://localhost:8765/observation/. È compatibile anche con `serve` e altri server statici.
- GitHub Pages: pubblicare `observation/index.html`; funziona anche sotto un prefisso come `/site/observation/`. Nel repository attuale il workflow Pages pubblica i file tracciati su `main`.

Serve comunque una connessione Internet per video, ricerca e primo download del modello. “Senza server” non significa offline. I browser possono applicare restrizioni diverse alle pagine `file://`; l’apertura diretta non è verificabile dal browser automatico di Codex, che consente solo HTTP/HTTPS.

Per modificare: editare `app.js`, `vision-worker.js` o `index.template.html`, poi eseguire `python3 observation/build.py` dalla radice. Il file generato `index.html` è già pronto: non serve eseguire build per usarlo o pubblicarlo. Verifica di regressione: `node --test observation/compatibility.test.mjs`.

Schermo nero, video a tutto viewport con proporzioni originali, audio muto per consentire autoplay. `I` mostra diagnostica; `W` parole bianche centrate, senza animazione. Entrambi spenti al caricamento. Un click riprende il video se il browser blocca autoplay. Gli errori di avvio ora compaiono sul nero; un click riprova ricaricando la pagina. Il fullscreen nativo del sistema richiede un gesto dell’utente; il layout riempie comunque la finestra.

## Catena

1. Ricerca casuale online di un item, preferendo runtime intorno a un minuto; nessuna lista iniziale o file video incluso nel sito.
2. Sceglie un MP4 fino a 18 MiB dai metadati; preferisce file da 40–90 secondi e poi la dimensione minore. Scarica completamente con `/cors/`.
3. Dopo quattro secondi di riproduzione acquisisce un fotogramma. ViT–GPT2 q8, in un worker WASM locale, genera una descrizione libera. Il primo uso scarica libreria e pesi da jsDelivr/Hugging Face e può superare un minuto. Le visite successive usano la cache del browser.
4. Estrae parole, cerca solo nei campi titolo/descrizione/soggetti, cerca prima la compresenza delle parole (AND), poi allarga a OR solo se non trova candidati verificati. Verifica massimo venti risultati per ricerca in sequenza; privilegia il numero di parole riscontrate e poi pesa titolo 100, soggetti 10, descrizione 1. Esclude parole di posizione e colori generici. Scarica un solo successore verificato. Non scarica candidati alternativi in parallelo.
5. Passa al successore a 60 secondi effettivi del video, oppure alla fine di un video più breve, soltanto quando pronto. Se finisce prima resta nero durante l’attesa, senza loop. Se la ricerca correlata non produce un candidato verificato tenta un nuovo casuale. Un trasferimento fallito viene scartato prima di cercare un altro candidato, con massimo tre tentativi sequenziali e 180 secondi per trasferimento. La ricerca casuale viene usata solo dopo l’esaurimento dei candidati correlati utilizzabili. Errori persistenti di rete o del modello sospendono la catena, senza inventare parole.

Le richieste HTTP fallite vengono riprovate fino a tre volte sullo stesso URL, in sequenza. La scelta casuale campiona entro le prime 300 pagine della ricerca, quindi non è uniforme su tutto Internet Archive.

Gli item riprodotti sono esclusi tramite sessionStorage (persistente ai reload nella stessa scheda). Nessuna esclusione globale tra schede o dopo la chiusura della sessione. L’identificatore impedisce la ripetizione dello stesso item; duplicati caricati su Archive con identificatori diversi possono ancora apparire.

I fotogrammi restano sul dispositivo. Solo le parole di ricerca arrivano a Internet Archive. Il modello può descrivere male fotogrammi scuri o astratti: la verifica nei metadati prova la relazione testuale, non garantisce identità visiva del contenuto. Non è un filtro sui contenuti.

## Misure Chrome, 10 ottobre 2026

`probe.html` ripete ricerca, metadata, avvio streaming e download completo sullo stesso file pubblico. È uno strumento di misura separato dalla pagina, non una playlist.

- Ricerca: 2067 ms iniziali; 252–306 ms nelle ripetizioni.
- Metadati: 362–377 ms.
- File `tsunami_koh_lanta_thailand_512kb.mp4`: 61,24 secondi, 4.470.926 byte.
- `/download/`: streaming fallito e fetch bloccata dai CORS del redirect.
- `/cors/`: streaming in 548 ms; download completo in 2380 ms (dopo avvio streaming, quindi misura potenzialmente influenzata dalla cache); riproduzione del blob riuscita.

Decisione: download completo con limite 18 MiB. Offre un confine chiaro di prontezza e fotogrammi leggibili; streaming parte più rapidamente ma non garantisce la disponibilità dell’intero minuto. Queste misure riguardano una connessione e un file, non sono una previsione per tutto Archive.

Modello e pipeline: https://huggingface.co/docs/transformers.js/v2.17.2/en/api/pipelines#module_pipelines.ImageToTextPipeline

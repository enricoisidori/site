# Spiral

Pagina statica, HTTP locale o HTTPS online, senza chiavi API. Archivio: catalogo video pubblico globale.

## Lettore

Il video usa direttamente l'URL /download/ di Archive: nessun fetch integrale, Blob o attesa del file completo. Due elementi video collegati al DOM consentono di preparare il successore e rivelarlo senza spostarlo o azzerarne il buffer. Il primo filmato parte con almeno 2 secondi disponibili; il successore punta a 8 secondi. Dopo 10 secondi di preparazione accetta almeno 2 secondi e readyState >= 3 oppure scarta il candidato.

Si preferiscono MP4 di almeno 45 secondi e piccoli, con bitrate medio noto entro 700 kb/s. Il tetto di 64 MiB serve a escludere file giganteschi: non viene scaricato tutto il file prima di partire.

## Catena

Durante la riproduzione ViT–GPT2 q8 analizza un JPEG di scena già estratto da Archive. La lista .thumbs nei metadati identifica il file originale e il secondo: si sceglie il fotogramma più vicino al tempo corrente dello stesso file. Non è uno screenshot esatto e può differire di alcuni secondi. Nessun secondo lettore video o download MP4 viene usato per la visione. Se i fotogrammi non esistono, il limite è dichiarato e si prepara un nuovo casuale.

Le parole producono una ricerca prima in titolo e soggetti; senza risultati si include la descrizione. I metadati vengono verificati e la corrispondenza evidenziata. Un solo successore viene preparato: cambia dopo circa 60 secondi, alla fine del video o in caso di arresto prolungato della riproduzione. Nessun video già visto viene riproposto e nessun loop viene attivato. Senza un successore pronto la continuità non è garantita.

I mostra anche il buffer disponibile e il fotogramma Archive con il secondo effettivo. W mostra parole. Entrambi sono spenti di default. Il riferimento e le differenze sono documentati in ../spiral/STUDIO-PLAYPLAYPLAYPLAY.md.

Il riscaldamento del modello non blocca il successore indefinitamente: dopo 12 secondi, se ancora non pronto, la pagina prepara un nuovo casuale mentre il caricamento del modello continua.

Ogni cambio azzera parole, fotogramma e ricerca in corso: il nuovo video viene analizzato nuovamente. La ricerca riceve 6 candidati per pagina e verifica al massimo 4 metadati e 2 lettori. Il totale delle corrispondenze nell’indice non è un numero di download. Il cambio ha un limite di 5 secondi per l’avvio del nuovo lettore; un errore conserva il video precedente e avvia un nuovo tentativo. Se il modello fallisce, il caricamento viene ritentato dopo il periodo di recupero.

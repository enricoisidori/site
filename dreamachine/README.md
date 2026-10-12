# dreamachine

Cerca filmati domestici/amatoriali del 1920–2015 con indicazioni esplicite di riprese grezze o non montate. Prelinger ha priorità (tre ricerche su quattro) e non richiede etichette amatoriali/non montate; restano le esclusioni e il match della query nel titolo. Il resto di Archive mantiene i criteri amatoriali stretti.

Questa cartella è la versione per GitHub Pages e Live Server. Per l'apertura diretta senza server usare ../dreamachine-local/index.html. Le copie locali sono generate dagli stessi sorgenti e non hanno pulsanti di avvio.

Descrizione locale del fotogramma → keyword → ricerca nel titolo → video. Limite assoluto 30 s; il successore della query parte appena pronto, anche prima. Nessun loop. Streaming nativo con riserve precaricate.

I informazioni e cronologia; M audio; F fullscreen; C fit/fill; S esporta la catena JSON. La cronologia viene salvata automaticamente nel browser, fino a 2.000 video. Sono incluse tutte le esclusioni aggiuntive per trailer/game advertising e contenuti sportivi.

Caricamento su fondo bianco e SVG nero: anteprime leggere di Archive in coda FIFO, senza ripetizioni. La prima appare appena arriva; le successive vengono consumate ogni 120 ms quando disponibili, con tre caricamenti paralleli e rifornimento continuo. Quando il primo video è pronto: 3 secondi di SVG su bianco, poi 1 secondo di solo bianco, quindi dissolvenza di 3 secondi al video. Primo clic: solo audio; clic successivi / →: prossimo pronto; M: audio, F/Esc: fullscreen. Il modello ViT–GPT2 q8 viene eseguito sul dispositivo; circa 247 MB al primo caricamento. Serve Internet.

Istruzioni complete e limiti della verifica in [VERSIONI-VIDEO.md](../VERSIONI-VIDEO.md). Controllo integrato HTTP e file:// superato con risposte remote simulate; verificate separatamente query reali e importazione reale della libreria. Le vecchie verifiche in VERIFICA.md sono cronologia di sviluppo, non una certificazione di questa revisione.

Backup v2 storico: ../relay-backups/relay-v2-20261012-190105.zip.

Selezione stretta: ogni ricerca richiede filmati domestici/amatoriali e indicazioni esplicite di riprese grezze/non montate; controllo aggiuntivo dei metadati. Prelinger bypassa soltanto le etichette positive, mai le esclusioni né la query. Le etichette Archive non garantiscono la natura del contenuto.

L’HTML locale occupa tutto il viewport; il fullscreen reale richiede F perché il browser vieta l’attivazione automatica senza interazione.

I video appartenenti a Prelinger partono a metà della durata, anche come primo video, per saltare i titoli iniziali.
Le immagini di caricamento provengono dalle anteprime Prelinger filtrate e dai risultati della ricerca video amatoriale; non viene più usato il catalogo globale delle immagini. Cache degli identificativi separata dalla precedente.

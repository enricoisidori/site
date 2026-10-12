# leftover.html

Aprire ../leftover.html nel browser, anche con doppio clic: serve Internet, nessun server o API a pagamento. La stessa pagina è utilizzabile su un host statico, incluso GitHub Pages. Usa Three.js r159 via CDN e WebGL.

Scena bianca senza interfaccia permanente. Carica due modelli per volta, prepara immagini casuali Wikimedia Commons e mostra ogni coppia appena pronta, a intervalli minimi di 900 ms. Parte caricando 10 oggetti, poi la densità oscilla gradualmente fra 4 e 35 oggetti secondo un Perlin noise (scala temporale 40 secondi); quando diminuisce rimuove un oggetto ogni 900 ms, quando cresce inserisce quelli pronti. Alla densità corrente ogni nuovo oggetto sostituisce il più vecchio, liberando geometrie, materiali e texture GPU. Rotazioni e oscillazioni hanno velocità e fasi casuali. Il caricamento continua in background e si sospende quando la scheda non è visibile.

Trascinare per ruotare la visuale, rotella per zoom. I: informazioni, fonti, autori e licenze. F: fullscreen. S: salva la scena GLB con texture e fonti nei metadati. O: salva OBJ, solo geometria (le immagini non sono incorporate nel formato). A: salva JSON con le fonti degli ultimi 200 arrivi.

## Geometrie

Catalogo iniziale di 1.869 modelli leggeri CC0: Kenney tramite Hidencod/tge-assets, più una selezione Khronos. Aggiornamento live del catalogo ogni 10 minuti; ogni geometria viene scaricata quando entra nella coda, senza scaricare tutta la libreria. Priorità a creature, alieni, fantasmi, teschi, cristalli, pirati e oggetti spaziali. Non è un campionamento di tutti i modelli esistenti sul web. Modelli e varianti si trovano in models.json, con URL della fonte e licenza verificata nei README. Gli autori sono elencati nelle pagine delle fonti. Il mazzo è mescolato: ogni modello viene richiesto una volta per giro. All’esaurimento ricomincia evitando i 200 arrivi più recenti; il catalogo è ampio ma non matematicamente infinito.

Il programma supporta JSON glTF e GLB: nei GLB le texture originali sono già incorporate nei file (massimo 250 KB), ma vengono eliminate prima della costruzione della scena; nei glTF separati non vengono scaricate. Limite 2,5 MB di buffer e 60.000 triangoli per modello; niente decoder Draco/Meshopt o materiali costosi. Le forme sono ricentrate e normalizzate. Dove mancano coordinate UV viene generata una proiezione planare.

Fonti: https://github.com/KhronosGroup/glTF-Sample-Assets · catalogo e licenze specifiche nei collegamenti source di models.json. Three.js è distribuito sotto licenza MIT: https://github.com/mrdoob/three.js/blob/r159/LICENSE.

## Texture

Stessa ricerca casuale di Aleph: API Wikimedia Commons, namespace File, miniature da 128 pixel. Accetta soltanto miniature JPEG/PNG/WebP, limite di download 80 KB e texture finale al massimo 128×128; mai ripiego sul file originale. Mantiene una piccola coda di texture e conserva pagina, autore, licenza e indicazione della modifica nella scena e nel pannello I. Accetta CC0, pubblico dominio, CC BY e CC BY-SA. Le immagini mantengono le rispettive licenze.

Documentazione API: https://www.mediawiki.org/wiki/API:Imageinfo. Non è un generatore AI: combina geometrie pubbliche con fotografie casuali. La prima apparizione dipende dalla disponibilità delle fonti e dalla rete.

## Sorgenti

../tools/object-flow.js contiene il lettore; ../tools/build-objects.mjs genera ../leftover.html incorporando script e catalogo. Le dipendenze Three.js vengono caricate dalla CDN, anche aprendo il file locale. La pagina non modifica gli altri lettori.

## Versioni e sfondo

../object-v1.html conserva esattamente il lettore precedente, con il catalogo piccolo e sfondo bianco. Snapshot di sorgente e catalogo: object-flow-v1.js e models-v1.json.

../leftover.html è la versione nuova. Il gruppo e gli oggetti cambiano posizione nello spazio, con dimensioni e traiettorie diverse. Lo sfondo è nero uniforme, senza sfera e senza calcolo di riflessi.

Libreria live: https://github.com/Hidencod/tge-assets · licenze originali Kenney: https://kenney.nl/assets. Catalogo filtrato sui file <=250 KB; eventuali geometrie oltre 60.000 triangoli sono scartate al caricamento.

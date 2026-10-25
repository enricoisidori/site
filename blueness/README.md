# Blueness · video

Versione video precedentemente chiamata Blueness movements. Aprire `index.html`; le fotografie sono in `../blueness-image/index.html`. `../bluenessmovements/index.html` rimane un alias della stessa pagina video.

La selezione del blu, il tracking, la raffica e la riproduzione desktop conservano la logica esistente. L’SVG VIDEOS rimane sul primo video, senza contorno bianco; scompare al secondo, che torna con il contorno normale. La variante SVG IMAGES resta conservata e commentata negli HTML generati.

In C → riproduzione, “tempo massimo fra cambi video” varia da 0,1 a 30 secondi: meno secondi significa cambi più rapidi. Il valore predefinito resta 15 secondi; servono comunque nuovi video pronti. “Analisi video” cambia la frequenza del controllo del blu, non il tempo fra i video.

G mantiene il montaggio degli screen già visti. V aggiunge prima la sigla effettivamente mostrata, con SVG; nessuna variante A/L per il video. Anche C contiene il pulsante V. Q annulla. La registrazione R e gli export P/J restano disponibili.

Solo iPhone/iPad usano la preparazione dedicata in `tools/blueness-ios-video.js`: video muti e inline nel DOM, avvio prima di aspettare il primo frame, verifica del codec dei candidati salvati, un caricamento alla volta, due riserve massime e riduzione del preload dei video precedenti, mantenendo la cronologia. Se l’autoplay viene negato appare “tocca per avviare i video”. Il piccolo pulsante c apre i controlli touch.

Build: `node tools/build-blue.mjs movements`. Non rigenera fotografie, Wiki o Afterimage. Preferenze desktop esistenti conservate. Test automatici coprono bootstrap/preparazione, isolamento desktop, memoria limitata e export; il simulatore iOS non è installato, quindi resta necessaria una verifica sul dispositivo per confermare la risoluzione del blocco segnalato.

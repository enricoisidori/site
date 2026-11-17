# Counting by hands, 2026 — strumenti di produzione

Da aprire tramite `python3 serve.py` → http://localhost:8000/counting/

| file | cosa fa |
|---|---|
| `index.html` | animatic 6:1: parametri, anteprima, tabella degli scatti, **Esporta MP4** (H.264 + metronomo AAC, fotogramma per fotogramma, Chrome/Safari) |
| `sheets.html` | fogli A4 per le 6 persone, in inglese (pagina "The row" con schema assonometrico + vista palmo), stampa → PDF. Usa la configurazione dell'animatic |
| `assets.html` | le 32 posizioni × dorso/palmo × sinistra/destra |
| `frame.html?t=12.5&video=2` | un fotogramma a piena risoluzione (per controlli/screenshot) |
| `hands.js` | generatore vettoriale delle mani (una geometria, specchiata per le 4 viste) |
| `counting.js` | numero (BigInt, 60 bit), scatti, timeline, formattazione |
| `render.js` | disegno del fotogramma, metronomo |
| `build-assets.mjs` | `node counting/build-assets.mjs` → riscrive `assets/` |
| `difficulty.html` | provi e voti (facile / media / difficile) le 32 posizioni di ogni mano; i voti valgono subito in questo browser (localStorage `counting-ratings-v1`) e vanno copiati in `BAKED_RATINGS` di counting.js per i PDF |
| `check-chain.mjs` | `node counting/check-chain.mjs`: verifica secondo per secondo foglio → performer → camera → flip → video finale → numero (deve dire 0 errori) |
| `pdf/` | fogli generati con i parametri predefiniti |

Convenzioni
- 60 bit = 6 persone × 2 mani × 5 dita. Persona 1 = bit più alti (a sinistra nel video finale), persona 6 = bit 9–0.
- Video finale specchiato in post: in ripresa la persona 6 è la prima a sinistra vista dalla camera e conta con la mano destra (pollice = 1).
- Mappatura "si legge da sinistra a destra": mano destra pollice = 1 … mignolo = 16; mano sinistra mignolo = 1 … pollice = 16. Così le cifre sotto le dita si leggono come il numero, sia nel video sia sui fogli (vista palmo).
- Anni giuliani (365,25 g). T predefinito 435.400.207.208.642.900 s = 13,797 miliardi di anni (59 bit).
- Scatti "logaritmici": n_k = T^(k/5). Con 59 bit ogni passo aggiunge ~11,8 bit → si attiva una persona per scatto.
- Scatti del video 2 (predefinito): il primo scatto parte da 0. La conta (+1 continuo anche attraverso lo scatto) parte dalla mano destra della persona 6; la mano sopra (la sinistra della persona 6) cambia a ogni scatto con almeno due dita finché un riporto non la raggiunge, poi prosegue con la conta. A ogni scatto TUTTE le altre mani attive cambiano posizione, nessuna resta uguale; le posizioni allo scatto sono tutte diverse tra loro e mai 00000 (eccetto le mani che portano la conta), con almeno due dita alzate (tranne la mano più alta del momento e l'ultimo scatto, che tiene le cifre di T). La persona più alta tiene le cifre del momento logaritmico, l'ultimo scatto ≈ T (13,797 miliardi di anni).
- Video 2: sotto "seconds" e "years" (righe consecutive) la tabella degli scatti nel video (tempo nel video, secondi, tempo cosmico, potenza), senza intestazioni né righe; grigia, lo scatto in corso nero. Il fotogramma diventa 1920 × 476 (opzione "Tabella scatti").
- Video 3 · inquadrature (bottone "3" nell'animatic): stessi scatti e dita del video 2, fotogramma 16:9 (o quadrato/verticale). A ogni cut l'inquadratura si allarga sulle persone attive (2 mani, 4 … 12, l'ultimo cut = fila intera). Parametri: formato, margine, taglio netto o zoom (durata), persone non attive ai lati, dimensione testo. Disegno vettoriale scalato: nessuna perdita di qualità.
- Fogli: A4; pagine iniziali e "The row" in orizzontale, pagine delle persone in verticale (persone 1–5 in un foglio, persona 6 in due).
- Opzione "Mani": dorso (predefinito) o fronte/palmo; l'export palmo ha "-palm" nel nome.
- "Scarto dal momento esatto" nella tabella = numero mostrato − momento calcolato (T^(k/5) o epoca).
- Predefiniti: video 2 (6 scatti da 5 s, l'ultimo tiene 1 s in più → 31 s), persone non attive visibili (pugno), 1920×320, 30 fps.
- Video 1: la mano destra della persona 6 conta da 00000; la sinistra parte da un valore con ≥2 dita vicino alle cifre di T (01011) e riceve i riporti (→ 01100 a 0:32). 61 s.
- Difficoltà (difficulty() in counting.js): i voti di difficulty.html, altrimenti un modello (anulare isolato = difficile; medio giù tra indice e anulare su = difficile; alcune combinazioni = medie). Tutte le mani che non portano la conta usano solo posizioni facili (le medie solo se non c'è alternativa). Voti di Enrico salvati in BAKED_RATINGS (34 posizioni). Video 1 e ultimo cut: fitHands() tiene il numero entro T/30000 (13,797 miliardi di anni) con le posizioni più facili. Le posizioni difficili restano solo nella conta della mano destra della persona 6 (inevitabili).
- Niente cifre tonde: le mani sotto la più alta prendono valori "credibili" (≥2 dita), deterministici. Nelle liste di epoche la mano sinistra della persona più alta può restare 00000 se servirebbe a non falsare la data.
- Transizione delle dita uguale anche agli scatti; testo del video in inglese (seconds, years), regolare e stessa dimensione; binario a gruppi di 5 centrati sotto ogni mano.
- Persone non attive grigie (showAlpha 0.32); quando si attivano passano a nero con la transizione.
- Testi in Neue Haas Grotesk se installato, altrimenti Helvetica Neue / Helvetica (regular + bold), stile del deck. Fogli in inglese.
- Foglio della persona 6: schema "Each finger is a power of 2" (vista palmo, 512…32 | 16…1), istruzioni per il +1 e link ai due tutorial YouTube (TUTORIALS in sheets.html).

Rigenerare i PDF (con il server attivo):

```bash
for p in 1 2 3 4 5 6 all; do "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer --virtual-time-budget=6000 --print-to-pdf=counting/pdf/counting-person-$p.pdf "http://localhost:8000/counting/sheets.html?p=$p"; done
```

- `build-slides.mjs` → `slides/log-table.svg` (+ png): slide 1920×1080 nello stile del deck con la tabella logaritmica del video 2. Da trascinare/incollare in Figma.

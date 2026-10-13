# Blueness — confronto ricerca video, 13 ottobre 2026

Confronti in parallelo con Chromium/Chrome headless, contesti isolati senza cronologia/cache locale iniziale, viewport 640×360. Impostazioni colore e qualità identiche, esclusioni attive, due giri con seed diversi. I test condividono macchina e connessione: tempi indicativi, non un benchmark assoluto né prova statistica. Nessun errore JavaScript nei test.

## Ricerca colore: due giri da 40 secondi

| Strategia | Primo video giro 1 | Primo video giro 2 | Match totali |
|---|---:|---:|---:|
| Generale | 5.7 s | 22.3 s | 7 |
| Blue/tag colore quando pronti ≤1 | 7.7 s | nessuno entro 40 s | 2 |
| Generale + blue in parallelo quando pronti ≤1 | 27.3 s | 13.2 s | 7 |

Le query colore testate comprendevano blue, P462=Q1088 e categoria Blue su Commons; subject/title blue su Archive. Non usavano sky, ocean o underwater. Nessuna delle tre strategie ha raggiunto due pronti nei giri da 40 s: i tag blu non hanno risolto il riempimento.

## Sorgenti: ricerca generale, due giri da 30 secondi

| Preparazione | Primo video medio | Coda media (giro 1 / giro 2) | Tempo a coda vuota dopo il primo video | Match totali |
|---|---:|---:|---:|---:|
| Entrambe, preparazioni condivise | 4.1 s | 0.00 / 3.50 | 50% | 10 |
| Solo Commons | 4.4 s | 0.16 / 1.71 | 46% | 15 |
| Entrambe, massimo 1 Archive in preparazione | 6.1 s | 0.92 / 2.18 | 32% | 17 |

Coda media e percentuale vuota sono campionate ogni 500 ms, dopo il primo video; le percentuali aggregate sopra sono medie dei due giri. “Match” conta media accettati e preparati, non i singoli frame analizzati. “Primo video” è rilevato dal contatore mostrati, non da una misura esterna del display. Il primo confronto colore e quello sorgenti hanno durate diverse e non vanno confrontati direttamente.

## Scelta applicata

Ricerca video generale su entrambe le fonti, massimo una preparazione Archive contemporanea quando entrambe sono attive. Nei giri il bilanciamento raggiunge due pronti in entrambi (20,2 s e 6,6 s), diversamente dalle altre configurazioni, e limita il caso peggiore di coda vuota. La ricerca video per tag blue è disattivata: nessun vantaggio osservato. La ricerca immagini conserva il fallback raro per metadati blu. Qualità adattiva 240–480p con coda ≤1, 480–720p con ≥2; prime due accettazioni preferiscono 240p. Nessuna modifica alle tolleranze del blu, alle esclusioni o al blocco delle ripetizioni.

La coda non è garantita sempre piena: nel caso scelto è rimasta vuota per parte dei test. Alcuni candidati/ricerche hanno avuto timeout di rete. I contatori movingPct nei JSON descrivono avanzamenti del decoder, non necessariamente il movimento del canvas visualizzato: non vengono usati nella scelta. MB include solo richieste completate: non è un conteggio affidabile di tutta la banda e non viene usato nella scelta.

Dati completi: [blueness-benchmark-results.json](blueness-benchmark-results.json).

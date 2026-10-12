# Verifica reale in Chrome — 10 ottobre 2026

Nessuna transizione è stata simulata o accelerata. I video sono arrivati da Internet Archive, il modello WASM ha descritto i fotogrammi del video in riproduzione e i successori sono stati scaricati uno alla volta.

## Prima catena completa (prima dell’ultimo affinamento della ricerca)

| Ora UTC di avvio | Item                                                                      |     Byte | Download ms | Parole / metadato                            |
| ---------------- | ------------------------------------------------------------------------- | -------: | ----------: | -------------------------------------------- |
| 18:30:25.942     | Tempe_Town_Lake_PSA                                                       |  6260842 |       42682 | casuale iniziale                             |
| 18:31:51.848     | why-hiring-local-electricians-in-crystal-lake-il-makes-all-the-difference | 11327503 |       51395 | boat, lake → Lake nel titolo                 |
| 18:32:52.152     | white-lives-matter-florida-activism-in-jacksonville_202607                |  4827196 |       29704 | clock, wall, black, white → White nel titolo |
| 18:33:52.459     | TikTok-7605755333562158349                                                |  1423804 |        5823 | sign, hanging, pole → pole nel titolo        |

Tre transizioni, quattro identificatori diversi. La prima ha atteso il download oltre la fine del video; la seconda e la terza sono avvenute dopo circa 60 secondi. Inferenze dei tre fotogrammi: 2796, 3222, 2705 ms. La prima descrizione inclusivo caricamento modello ha richiesto 4506 ms (cache già disponibile da una precedente prova).

Questa catena ha esposto falsi legami: “Lake” come toponimo e “White” nel titolo di propaganda politica non costituiscono una relazione visiva affidabile. Per questo l’ultima revisione esclude colori generici, cerca prima più parole insieme (AND), poi usa OR solo se non trova un candidato verificato; la graduatoria privilegia la copertura delle parole prima dei pesi dei campi. La presenza di una parola nei metadati continua a non dimostrare la relazione visiva.

## Revisione finale: altre tre transizioni reali

| Ora UTC di avvio | Item                                                                                                 |     Byte | Download ms | Riscontro                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------- | -------: | ----------: | ------------------------------------------------- |
| 18:35:03.578     | ccxnewsmn-Armstrong-Cooper_Girls_Hockey_Loses_to_Blake_in_Section_6AA_Tournament                     |  5586767 |       28662 | casuale iniziale                                  |
| 18:36:17.195     | project-ruby-lupang-hinirang-the-philippine-national-anthem-official-government-produced-music-video |  5918712 |       37664 | hat, holding, flag nella descrizione; ricerca AND |
| 18:37:17.495     | A_key_piece_of_the_economic_puzzle_moves_forward_in_Brooklyn_Center                                  | 11546957 |       49387 | crowd, foggy, area nella descrizione; ricerca AND |
| 18:38:17.793     | twitter-1225247355223457792                                                                          |  2664906 |       13458 | table nel titolo                                  |

Contatore UI letto direttamente dal DOM: `transitions: 3`. Quattro item distinti nella stessa esecuzione, nessun fallback casuale in queste tre transizioni. Intervalli: 73,617 s; 60,300 s; 60,298 s. La prima transizione ha atteso il successore oltre il minuto; le altre hanno rispettato il minuto. Il controllo di decodifica del blob era attivo. Modello locale realmente in esecuzione: prima descrizione 3810 ms, seconda 3051 ms.

Verificati anche: I e W nascosti al caricamento; attivazione indipendente da tastiera; parole bianche centrate e senza animazioni; successiva disattivazione di entrambi. Screenshot `verifica.jpg` con W attivo durante il quarto video. Pagina lasciata aperta in Chrome con entrambi spenti. Controlli sintattici Node riusciti per app e worker. Non sono stati usati media finti, caption predefinite o salti temporali per accelerare la prova.

## Limiti ancora aperti

- ViT–GPT2 può allucinare una scena: nel video di hockey ha descritto cappello e bandiera. I metadati correlati non correggono una caption sbagliata.
- Anche AND può produrre relazioni metaforiche: “foggy future” in un servizio economico non è una scena di nebbia. Non c’è una seconda verifica visiva del successore.
- Pesi del modello scaricati da Internet al primo uso; la prova ha beneficiato di cache preesistente. Non misurato un avvio completamente a cache vuota, né altri browser o dispositivi.
- I download della prova hanno impiegato 13–49 s; la continuità senza pause non è garantita. Errori persistenti sospendono la catena, segnalati da I; non è implementato un recupero autonomo dopo una sospensione.
- Nessun duplicato dello stesso identificatore nella sessione. Video duplicati sotto identificatori differenti non vengono riconosciuti. L’esclusione non sopravvive alla chiusura della sessione.
- Il fallback casuale è implementato, ma non si è verificato nelle tre transizioni finali. Non è stato forzato artificialmente.
- La casualità campiona un sottoinsieme paginato di Archive; non è uniforme sull’intera collezione.
- Layout a tutto viewport; fullscreen nativo richiede il gesto/controllo del browser. Audio muto per autoplay.

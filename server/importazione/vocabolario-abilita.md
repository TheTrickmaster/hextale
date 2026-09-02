# Il vocabolario delle abilità

Le colonne del blocco abilità del foglio `Cards DB`, e i termini ammessi in
ciascuna. **Una colonna, una domanda.** È la regola che tiene in piedi tutto il
resto: appena una colonna risponde a due domande, due carte diverse la
riempiono in due modi e il parser ne capisce una sola.

Il blocco occupa **37 colonne**, da `Is unique` (AC) a `Complete script` (BM),
con un secondo gruppo `Rule 2 / Rule target 2 / Rule value 2` che oggi non serve
a nessuna carta ma c'e' per quando una regola dovra' averne due.

**Il vuoto si scrive `-`**, mai `none` e mai una cella davvero vuota: una sola
convenzione, cosi' non ci si chiede mai se un buco sia voluto o dimenticato.

> Attenzione ai booleani: scrivendo `true` in una cella, Sheets lo converte in
> `TRUE` perche' lo legge come valore logico. Per i test che non hanno bisogno
> di un valore — `on_edge`, `did_not_conquer` — si lascia `-`: la domanda sta
> gia' tutta nel test.

---

## Governo

**`Is unique`** — `No` · `Yes`

`Yes` vuol dire "questa abilità è scritta a mano nel codice". Tutte le altre
colonne si ignorano. Anche in quel caso conviene riempire `Trigger`, così il
motore sa *quando* chiamare la funzione su misura: su misura resta l'effetto,
non anche l'aggancio.

---

## QUANDO — quattro colonne

**`Trigger`** — l'evento o lo stato che accende l'abilità.

| termine | quando |
|---|---|
| `on_play` | appena la carta viene calata |
| `on_conquer` | quando lei conquista |
| `on_conquered` | quando viene conquistata |
| `on_destroyed` | quando viene distrutta |
| `on_drawn` | quando viene pescata |
| `on_moved` | quando viene spostata |
| `while_in_hand` | finché sta in mano |
| `while_on_board` | finché sta in campo (è la vecchia *Synergy*: si ricalcola a ogni cambio del tavolo) |
| `start_of_turn` | all'inizio di ogni turno |
| `end_of_turn` | alla fine di ogni turno |
| `always` | è una regola, non un evento: si usa con il blocco REGOLA |

**`Frequency`** — `once_per_game` · `once_per_turn` · `every_time`

I due `while_*` del Trigger dicono **dove** deve stare la carta perché
l'abilità conti, non quando scatta: il quando lo dice la frequenza.
`while_on_board` + `every_time` = sempre accesa (le dodici sinergie).
`while_in_hand` + `once_per_turn` = una volta a turno, finché resta in mano
(Alice). Senza questa lettura le due colonne sembrano contraddirsi.

Dalla v0.77.63 la conta la tiene il motore, sulla singola carta: due copie
della stessa carta hanno ciascuna il suo colpo, e un colpo che non parte perché
la condizione era falsa non è stato speso. `once_per_turn` senza un numero di
turno resta chiusa.

**`Window`** — la finestra in cui l'abilità vale.

`always` · `from_turn` · `until_turn` · `for_turns` · `next_only`

**`Window value`** — il numero della finestra. `from_turn` + `4` = dal quarto
turno in poi (Strigoi). `until_turn` + `2` = solo nei primi due (Captain Hook).

---

## SE — tre colonne

La condizione. Se `If subject` è `none`, l'abilità non ha condizioni.

**`If subject`** — di chi parla la condizione.

`self` · `target` · `attacker` · `defender` · `adjacent` · `board` · `hand` ·
`turn` · `position`

`attacker` è quello che serviva e mancava: Sleeping Beauty e Thumbelina
guardano **chi le attacca**, non chi subisce.

**`If test`** — cosa si controlla.

`has_trait` · `is_character` · `on_edge` · `adjacent_to` · `count_at_least` ·
`power_diff_at_least` · `power_is` · `free_sides_at_least` · `did_not_conquer` ·
`chance`

**`If value`** — il valore del controllo: un tratto (`Princess`), più tratti
separati da virgola (`Princess,Noble,Sovereign`), un ID (`#001`), un numero,
`odd`/`even`, una percentuale.

---

## REGOLA — tre colonne

Una regola **non fa** niente: cambia cosa gli altri possono fare. Vive in tre
colonne sue e non nella colonna `Action`, e la ragione è misurata: le nove
carte che cambiano una regola usavano solo 2–5 delle 8 colonne dell'effetto, e
soprattutto `Amount` cambiava significato — per Shere Khan valeva
`equal_or_higher`, un **operatore**, mentre per tutti gli altri è un numero.
Una colonna che cambia senso a seconda della vicina è lo stesso difetto che
aveva `all` nel foglio vecchio.

C'è anche una ragione pratica: separate, una carta può avere **una regola e un
effetto insieme** senza bruciare uno dei due posti degli effetti.

**`Rule`** — `none` · `invincible` · `conquerable_only_if` ·
`not_conquerable_if` · `side_protected` · `conquers_when` · `playable_on` ·
`attacks_with` · `immune`

**`Rule target`** — chi la regola protegge o vincola: `self` · `adjacent` ·
`ally` · `opponent`

**`Rule value`** — il termine di paragone: `equal_or_higher` (Shere Khan),
`blocked` (Peter Pan), `HIGHEST` (Merlin, Crystal Princess). Vuoto quando la
regola non ne ha bisogno.

> La **condizione** di una regola sta nel blocco SE, non qui. Sleeping Beauty è
> `Rule = conquerable_only_if` più `If subject = attacker`,
> `If test = has_trait`, `If value = Princess,Noble,Sovereign`.

---

## EFFETTO — nove colonne, due volte

**`Action`** — solo effetti: `buff` · `debuff` · `set` · `rotate` · `shuffle` ·
`hide` · `swap` · `move` · `destroy` · `summon` · `transform` · `copy` ·
`steal` · `draw` · `discard` · `freeze` · `protect` · `flip` · `cancel`

**`Who`** — `self` · `ally` · `opponent` · `any` · `attacker` · `attacked`

**`Where`** — `adjacent` · `board` · `in_hand` · `edge` · `drawn` · `deck`

**`What`** — `card` · `side` · `power` · `trait` · `ability` · `position` · `tile`

**`Which`** — il filtro: **quali** fra i candidati.
`all` · `single` · `random` · `highest` · `lowest` · `free` · `blocked` ·
`next` · `last`

**`Player selection`** (e `Player selection 2`) — **chi** indica il bersaglio:
`yes` = lo sceglie il giocatore col mirino · `no` = si compie da sola appena le
condizioni si avverano.

> **Sono due domande diverse, e prima stavano nella stessa cella.**
> `Which` aveva un valore `selected` che rispondeva alla seconda domanda
> occupando la casella della prima: così non si poteva scrivere *"un tassello
> **bloccato**, e lo indica il giocatore"* — le due cose litigavano per la
> stessa colonna. I Sette Nani sono la carta che l'ha fatto vedere.
> Da lì la colonna a parte: `Which = blocked`, `Player selection = yes`.

**`Scope`** — quanta parte della carta tocca: `ALL` · `RAND` · `HIGHEST` ·
`LOWEST` · `ONE`

> **`Which` e `Scope` sono due cose diverse, e prima erano la stessa.**
> `Which` sceglie *quali carte*, `Scope` sceglie *quali lati di quella carta*.
> Nel foglio vecchio `all` voleva dire "tutti i lati" per Alice e "tutti i
> nemici adiacenti" per Robin Hood: stessa parola, stessa colonna, due
> significati. Adesso Robin Hood ha `Which = all` (tutti i nemici) e
> `Scope = ONE` (un lato solo), Alice ha `Scope = ALL`.

**`Amount`** — un numero (`2`), un intervallo (`1-3`), un ID di carta (`#143`),
`DIFF` (la differenza fra due poteri), o `owner` (il proprietario originale).
Gli operatori di paragone NON stanno qui: stanno in `Rule value`.

**`Per`** — il moltiplicatore, quando l'effetto scala:
`none` · `adjacent_trait` · `board_trait` · `hand_trait` · `free_side` ·
`power_diff`

> Il tratto su cui contare sta in `If value`. Snow White: `Amount 1` +
> `Per = board_trait` + `If value = Small` = "+1 per ogni Small in campo".

**`Duration`** — `permanent` · `end_of_turn` · `n_turns` · `while_true`

> `while_true` vuol dire che l'effetto vive finché la condizione regge: se la
> carta Small se ne va, il +1 se ne va con lei.

---

## Composizione

**`Link`** — `none` · `and` · `or` · `instead` · `if`

Il secondo effetto ha **la sua condizione** (`If subject 2`, `If test 2`,
`If value 2`). Serve: Maid Marian dà +2 ai Wild adiacenti *ma +3 a Robin Hood*,
Aladdin +1 *ma +3 se c'è una Princess*, Guinevere +2 *ma +3 ai Trickster*.
Senza una condizione propria, quelle tre finivano per rubare il primo blocco.

---

## `Complete script`

**Non si scrive a mano: la genera l'importatore.** È la prova che la riga è
stata capita come la intendevi. Se la frase non torna, la riga è sbagliata —
non la frase.

---

## Le sei che restano scritte a mano

| carta | perché |
|---|---|
| Rapunzel | geometria: tirare una carta lungo una retta, con direzione e distanza |
| Tom Thumb | lascia segnalini persistenti sulle caselle, meccanica che non esiste |
| Unicorn | cambia il proprio drop rate: non è un effetto di partita, agisce sul database |
| Tinker Bell | intercetta il **prossimo** buff altrui: serve una coda di effetti futuri |
| Scheherazade | descrizione non ancora scritta |
| Werewolf | descrizione mancante |

Su 62 abilità, **56 entrano nel vocabolario**. Le sei fuori non sono un
fallimento dello schema: sono meccaniche che il gioco non ha ancora.

---

## Regola per l'importatore

Una riga che non si capisce deve **fermare l'importazione**, dicendo carta e
colonna. Mai entrare nel database e poi non fare niente in partita: il gioco ha
già pagato questa lezione con le abilità bloccate dal livello, e il guasto
silenzioso è costato più di quanto sarebbe costato un errore rumoroso.

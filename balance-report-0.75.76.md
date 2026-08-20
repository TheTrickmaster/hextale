# Hextale — Balance report

Sheet read on 2026-08-20 · 76 playable cards (Visible = Yes with values) · *Jack and the Beanstalk excluded as requested*

---

## How the test was run

Every card fought **every other card, on all 6 facings, in both roles** — 76 × 75 × 6 = 34,200 duels, run twice (level 1 and level 4).

The conquest rules are not my own: they are copied verbatim from the game (`vinceIlConfronto`, `puoConquistare`, `latiProtettiDi`, `getGroups`, `getAttackValueForSide`). So *Apex Predator*, *Power Nap*, *Crowned*, *True Story*, *A Kind of Magic*, *Fearless* and *Immovable* are actually played out in the matrix rather than guessed at.

Each card gets:

| Metric | Meaning |
|---|---|
| **atk** | share of duels it wins as attacker (0–1) |
| **def** | share of duels it survives as defender (0–1) |
| **combat** | (atk + def) / 2, × 10 → 0–10 points |
| **abil** | value of the ability the matrix *cannot* simulate (synergies, on-play effects, steals) — **my judgement, −2 to +4**, not a measurement |
| **tot** | combat + abil |
| **pct** | percentile against all 76 cards |

Target percentile band per rarity (Common < Rare < Mythic < Timeless, with deliberate overlap):

`Common 0–40 · Rare 30–65 · Mythic 55–85 · Timeless 80–100`

**Caveat, stated plainly:** the combat half is measured, the ability half is an estimate. Where a card is flagged only because of its ability score, I say so.

---

## The three findings that matter more than any single card

**1. Mythic and Timeless are practically the same rarity.**

| Rarity | avg tot | step |
|---|---|---|
| Common | 3.60 | — |
| Rare | 6.65 | **+3.05** |
| Mythic | 8.47 | **+1.82** |
| Timeless | 9.24 | **+0.77** |

The ordering you asked for holds, but the steps shrink to nothing at the top. Seven Mythics score *above* the Timeless average. If a Timeless is supposed to feel like a prize, the top tier needs roughly +1.5 more separation, or several Mythics need to come down.

**2. Card level is irrelevant to balance.** Level 1 and level 4 produced *identical* win rates for all 75 normal cards. Since every card gains +1 per side per level, the +1s cancel out in every comparison. Levels change the fight against *blocked tiles and thresholds*, never against another card. The only exception is a card with a 4-number scale on the sheet (today only Excalibur). Worth knowing before you tune anything by level.

**3. 22 cards break your own values rule** (sum must be 15–25). Almost all Mythics and every Timeless are over: King Arthur 37, Shere Khan 38, Crystal Princess 36, The Genie 34, Robin Hood 32, Alice 31, Cheshire Cat 30, Baloo 30, Little Mermaid 30. Either the rule is now obsolete for the high rarities and should be rewritten as a per-rarity band, or these cards are over-statted. Right now the code warns about them at every load.

---

## TIMELESS — band 80–100

| Card | tot | pct | atk / def | verdict |
|---|---|---|---|---|
| King Arthur | 12.62 | 100 | .81 / .91 | **too strong** — highest score in the whole game, and it also summons an unconquerable body |
| The Genie | 11.47 | 99 | .79 / .90 | strong end of the band, acceptable |
| Robin Hood | 10.18 | 95 | .65 / .79 | ok |
| Cheshire Cat | 9.52 | 89 | .68 / .82 | ok |
| Shere Khan | 9.04 | 87 | **.89 / .91** | ok on total, but **the best raw body in the game** — its ability adds nothing on top, which is why it lands mid-band |
| Little Red Riding Hood | 8.44 | 79 | .80 / .89 | borderline, effectively fine |
| **Alice** | 7.65 | 72 | .60 / .73 | **too weak** — 9/9 on two sides looks scary but sits next to a 1 and a 2; *Eat Me Drink Me* only rotates it **in hand**, so it does nothing once played |
| *Excalibur* | 5.00 | 52 | .00 / 1.00 | **not a balance problem — a design outlier.** 0 attack, literally unconquerable. It is a wall, not a card. Not collectible (drop 0), summoned by King Arthur |

**Too weak:** Alice.
**Too strong:** King Arthur.

---

## MYTHIC — band 55–85

| Card | tot | pct | atk / def | verdict |
|---|---|---|---|---|
| **Nottingham Sheriff** | 10.55 | 97 | .68 / .83 | **too strong** — a 29-sum body *plus* stealing any adjacent ability. Beats 6 of the 8 Timeless |
| **Sea Witch** | 10.50 | 96 | .68 / .82 | **too strong** — 29-sum body plus +1 ALL to herself and −1 ALL to the whole enemy hand |
| **Snow White** | 9.90 | 93 | .60 / .78 | **too strong** — *Smol Friends* scales with a very common trait; on a busy board it is a permanent +2/+3 ALL |
| **Little Mermaid** | 9.85 | 92 | .72 / .85 | **too strong** — body identical to Baloo *and* a free discard |
| **Baloo** | 9.82 | 91 | .72 / .85 | **too strong** — 30-sum body on a card whose ability is also a team buff |
| Mordred | 9.46 | 88 | .55 / .74 | slightly over; the body is fair, the destroy effect is what pushes it |
| *The Crystal Princess* | 8.99 | 85 | .85 / .94 | **second-best body in the game** and its top group cannot be conquered. Non-collectible transform reward, so acceptable — but do not ever give it a drop rate |
| Aladdin | 8.80 | 84 | .62 / .74 | ok |
| Captain Hook | 8.66 | 81 | .59 / .74 | ok |
| Big Bad Wolf | 8.46 | 80 | .57 / .72 | ok |
| Morgana | 8.22 | 77 | .54 / .71 | ok |
| Rapunzel | 8.19 | 76 | .56 / .68 | ok |
| Sleeping Beauty | 7.98 | 75 | .67 / **.92** | ok — the best pure defender that isn't Excalibur |
| Merlin | 7.47 | 69 | **.75** / .74 | ok — *A Kind of Magic* is quietly one of the strongest attack abilities |
| **Cinderella** | ~~7.33~~ **10.33** | ~~68~~ **95** | .67 / .80 | **updated v0.75.77 — now too strong.** With *Bell of the Ball* fixed (adjacent /Guardian/ instead of the unplayable Fairy Godmother) the ability actually fires, and it turns a 28-sum card into the 36-sum Crystal Princess *with* an unconquerable group. There are 10 Guardians in the pool and adjacency counts allies **and** enemies, so the condition is easy to meet. She now scores above every Timeless except King Arthur and The Genie |
| Pinocchio | 7.27 | 65 | .60 / .85 | ok |
| Queen of Hearts | 6.14 | 56 | .53 / .70 | bottom of band, watch it |
| **Mad Hatter** | 4.91 | 51 | .63 / .76 | **too weak** — the only card in the game whose ability is a *pure downside*: 27 points of statline collapse to a random 1–3 the moment it conquers. Its body is Mythic-grade; its ability actively punishes playing it well |

**Too weak:** Mad Hatter. (Queen of Hearts is next in line.)
**Too strong:** Nottingham Sheriff, Sea Witch, Cinderella, Snow White, Little Mermaid, Baloo — Mordred borderline.

---

## RARE — band 30–65

| Card | tot | pct | atk / def | verdict |
|---|---|---|---|---|
| **Princess and the Pea** | 8.67 | 83 | .48 / .66 | **too strong** — *Bothered* gives +1 ALL **per free side**. Played on an open board that is +4/+5 ALL on all six sides, which is a Timeless-grade swing on a Rare |
| **Lancelot** | 7.83 | 73 | .50 / .67 | **too strong** — 23-sum body plus a two-way synergy (buff *and* enemy debuff) |
| **March Hare** | 7.59 | 71 | .47 / .65 | **too strong** — swapping an enemy's highest and lowest is a large, unanswerable tempo swing |
| *The Green Prince* | 7.29 | 67 | .65 / .80 | just over the band, but it is the Frog Prince transform reward (drop 0) — fine as is |
| Frog Prince | 7.12 | 64 | .32 / .50 | ok — weak body, but the transform is worth it. Note it is entirely dependent on a Princess being adjacent |
| Maid Marian | 6.93 | 63 | .40 / .59 | ok |
| The Caterpillar | 6.62 | 61 | .38 / .55 | ok |
| White Rabbit | 6.54 | 60 | **.25 / .46** | ok on total, but this is the **weakest body of any Rare**. It survives only because of the +3 ALL on turn 1–2. Miss that window and it is a Common |
| Ali Baba | 6.34 | 59 | .44 / .62 | ok |
| Rumpelstiltskin | 6.22 | 57 | .43 / .62 | ok |
| Magic Mirror | 5.82 | 55 | .29 / .48 | ok, but very swingy — worthless with no good neighbour |
| **Seven Dwarves** | 4.79 | 48 | .30 / .46 | **too weak in practice** — 7/1/1/1/1/7 means four sides that lose to almost everything, and *Heigh-Ho* only removes a blocked tile. Scores below the Common Baba Yaga |
| **Cowardly Lion** | 4.70 | 47 | .48 / .66 | **too weak** — good even body (3/3/3/4/4/4) ruined by an ability that is a **straight self-malus**, −1 RAND on play. It scores below a Common |

**Too weak:** Cowardly Lion, Seven Dwarves — both ranked *below* a Common card.
**Too strong:** Princess and the Pea, Lancelot, March Hare.

---

## COMMON — band 0–40

| Card | tot | pct | atk / def | verdict |
|---|---|---|---|---|
| **Baba Yaga** | 5.66 | 53 | .27 / .46 | **too strong** — *Hex* retaliates −1 ALL per point of power difference, so the *stronger* the attacker the worse the punishment. Outscores two Rares |
| **12 Dancing Princesses** | 4.87 | 49 | .29 / .48 | **too strong** — self-relocation on conquer is an evasion tool no other Common has |
| Pixies | ~~4.59~~ **3.59** | ~~45~~ **28** | .15 / .37 | **fixed in v0.75.78** — *Mischief* cut from +3 to +2 RAND per other Trickster. Now sits mid-tier among Commons |
| **Phoenix** | 4.53 | 44 | .16 / .35 | **too strong for a Common**, and lopsided: 1/1/7/1/1/1 is five dead sides plus a resurrection |
| Unicorn | 4.34 | 43 | .33 / .54 | just over — but its ability is a meta effect (drop rate), no board impact. The body alone (18-sum, a 7) is what makes it a strong Common |
| Oni | 4.26 | 41 | .32 / .53 | strongest vanilla Common; fine as the ceiling |
| Griffin → Goblin | 4.16 → 3.23 | 40–12 | — | the healthy middle, 25 cards, no action needed |
| Leprechaun, Cyclop, Centaur, Crow | 2.86–2.98 | 7–11 | — | ok |
| **Grasshopper / Hare** | 2.70 | 4–5 | .18 / .36 | **too weak** — *identical statlines* (2/1/1/1/4/2). Two different cards with the same numbers and no ability |
| **Mouse** | 2.66 | 3 | .16 / .37 | too weak |
| **Ant** | 2.62 | 1 | .14 / .38 | too weak |
| **Tortoise** | 2.59 | 0 | .15 / .36 | **weakest card in the game** — 1/5/2/1/1/1, one usable side |

**Too weak:** Tortoise, Ant, Mouse, Hare, Grasshopper.
**Too strong:** Baba Yaga, 12 Dancing Princesses, Phoenix — Unicorn borderline. *(Pixies fixed in v0.75.78.)*

The Common tier spans 2.59 → 5.66, a 2.2× spread. That is wider than the gap between Common and Rare, which means "Common" currently predicts very little about how good a card is.

---

## Shortlist, if you only change ten things

**Bring down**

1. **Nottingham Sheriff** — cut the body (29 → ~24). Stealing an ability is already a Mythic-worth effect.
2. **Sea Witch** — same: 29-sum plus a whole-hand debuff is two payloads on one card.
3. **Princess and the Pea** — cap *Bothered* at +3 ALL, or count only free sides at end of turn.
4. **King Arthur** — 9/9 adjacent is the strongest pair on the board *and* he summons an unconquerable tile.
5. **Baba Yaga** — cap *Hex* at −2 or −3 ALL; unbounded scaling on a Common is inverted rarity.
6. **Lancelot / March Hare** — one notch down each, or move March Hare to Mythic.

**Bring up**

7. **Cowardly Lion** — remove *Scaredy Cat* or give it an upside; a Rare should not be worse for having its ability.
8. **Mad Hatter** — the random 1–3 should be an *option* or a trade, not an automatic downgrade of a 27-point body.
9. **Alice** — make *Eat Me Drink Me* keep rotating on the board (it is Cheshire Cat's ability minus the movement), or she is a vanilla Timeless.
10. **Tortoise / Ant / Mouse / Hare / Grasshopper** — five bottom Commons, two of them literally the same card. Redistribute so the worst Common is around 13–14 sum with two usable sides.

**One bug left, not balance**

- **Grasshopper and Hare have identical values** (2/1/1/1/4/2).

---

## Changes applied since this report was written

- **v0.75.77** — Cinderella's *Bell of the Ball* now triggers on an adjacent /Guardian/ instead of The Fairy Godmother (which was `Visible = No`, so the ability could never fire). This **fixed a bug and created a balance problem**: see her row above, she is now a 95th-percentile Mythic. Tightening the condition — an *allied* Guardian, or a Guardian you played yourself — would bring her back into band without undoing the fix.
- **v0.75.78** — Pixies' *Mischief* cut from +3 to +2 RAND per other Trickster. Now in band.

# Logbook

A digital successor to the paper exercise book, so a fisher records his own trip at the moment of landing, offline, at night, with no data collector present.

That is the entire scope of this repo. It captures trips. It does not compute compliance, hold registers, sync to LAMCOT, or handle traceability.

---

## Why this exists

The digital layer in the Lamu catch data chain is attached at the wrong end. Today it runs: fisher speaks, data collector writes in a paper logbook, KoboCollect on the collector's phone, LAMCOT server. **The fisher never touches the app.** The collector is the only digital actor, and everything upstream of that phone is paper and memory.

The failure this causes is specific. Fishers land at night, when no collector is on site. By morning the collector had to reconstruct the catch from fish traders, whose information was usually incomplete or wrong.

The BMU chairman already solved this on paper. He bought exercise books and allocated pages to individual fishers, so each fisher records his own trip as he lands. LAMCOT adopted the concept and is redesigning it.

**That is the design precedent and this repo is a direct digital successor to it, not a replacement.** The field-proven answer to night landings is fisher self-capture at the point of landing, not collector presence.

---

## Captured fields

From the current routine data set, unchanged:

| Field | Notes |
|---|---|
| Date / trip identifier | |
| Days at sea, hours at sea | |
| Gears used | Multi-select |
| Species landed | Pictorial selection, see below |
| Area fished | |
| Propulsion mode | Sail or outboard engine |
| Fuel | |
| Vessel type | "Tumia" vessel `[?]`, taxonomy unconfirmed |
| Number of crew including captain | Typically 2 to 3 |
| Captain name and contact number | The identity anchor |
| Engine horsepower | **Not in the current paper form.** Added because it is in the fisheries officer's effort-variable set and is otherwise uncollected |

Per species landed: **batch weight** and **piece count**.

Those two are captured because they are the inputs to the existing BMU size method, which weighs the species batch, counts the pieces and divides. Worked examples given in the field were 6 kg of mullet across 7 pieces, and 20 kg of crab across 30 pieces. This repo records both numbers and derives mean piece weight. It does **not** compare against legal minimums; that comparison lives elsewhere.

---

## Design constraints

All of these are evidenced from the field, not assumed.

**It runs at night, on a beach.** High-contrast, large touch targets, one-handed operation, readable in the dark. No assumption of good light or a free second hand.

**It runs offline, always.** No entry may block on a network call. Where connectivity has been made a precondition elsewhere in this programme, the documented outcome is that the operation reverts to paper books.

**Mixed literacy.** Species selection is pictorial, never a typed name. A Lamu-specific fish identification guide is in development with a prototype mentioned for September. Use it rather than hand-rolling a species list.

**Time-to-complete is the adoption metric, not feature count.** Older fishers resist gadgets as an *added burden*, not as useless. If an entry takes longer than writing a line in an exercise book, this has already failed regardless of what else it does.

**Assume a shared device.** One phone at the landing site serving many fishers is the realistic baseline, not one phone per fisher. The direct precedent here is FAO's vessel-monitoring gadgets, described as "very challenging" and defeated by fisher capacity and education level. Anything requiring distributed hardware inherits that failure.

**The fisher owns his page.** The exercise book worked because a fisher can see his own history. The digital version must show him his trips and his numbers, not present a submission form that swallows data into somewhere else. This is a deliberate carry-over of the paper metaphor, and it is the difference between a tool and a reporting obligation.

**Paper stays in service.** The exercise books are not decommissioned when this ships. They remain the fallback, and the only path that reaches the roughly 31 BMUs outside the LAMCOT programme, which have no funded collectors, no training and no phones.

---

## Local data model

Append-only. Records are never edited in place; corrections are new records that supersede. Devices may be offline for days and there is no reliable clock authority on a beach, so there is deliberately no merge to resolve.

```
trip
  id · vessel_id · captain_id · departed_at · returned_at
  days_at_sea · hours_at_sea · gears[] · fishing_ground
  propulsion (sail|outboard) · engine_hp · fuel
  crew_count · vessel_type
  recorded_by (fisher|collector) · recorded_at · device_id

lot                                    -- one fisher, one species, one landing
  id · trip_id · species
  batch_weight_kg · piece_count
  mean_piece_weight_kg                 -- derived locally
  captured_at · captured_offline (bool)
```

`lot` is atomic and is never merged, including when catch is later co-mingled into a shared consignment. That constraint originates downstream but has to hold from the moment of capture, so it is enforced here.

Every record carries `recorded_by`, `recorded_at` and `device_id`. Provenance of the data is itself data, because fisher self-capture and collector entry do not carry equal evidential weight and the distinction must survive sync.

---

## Out of scope

- Legal-minimum comparison and compliance flagging
- Fisher and vessel registers
- Sync, validation, and anything server-side
- Consignments, pack codes, traceability
- Catch Assessment Survey sampling

---

## Honest limits

This is **self-reported data with an obvious incentive to shade it.** The claim is faster and more complete capture of *declared* catch, not verified catch. Independent CAS sampling remains the check, and nothing in this repo should be presented as replacing it.

---

## Open items

- [ ] **Shared-device identity.** How a fisher authenticates on a communal phone, at night, without a password. Unsolved and blocking.
- [ ] **Fish identification guide.** Needed for pictorial species selection. Prototype mentioned for September.
- [ ] **Vessel type taxonomy.** "Tumia" `[?]` needs confirming against the actual local term and the full class list.
- [ ] **Engine horsepower.** Added to the form on the officer's evidence. Confirm a fisher can realistically supply it.
- [ ] **Entry-time benchmark.** Measure against a line in an exercise book before shipping. This is the pass/fail test.
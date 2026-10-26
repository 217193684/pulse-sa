# Explainer script format

A script is JSON. Each scene has a `type`, the narration `lines` (one sentence each, spoken in order) and the data that
scene type draws. Items appear on screen when a line starts: `"at": 2` means "when line 2 of this scene starts"
(lines count from 0); `"at": [1, "word"]` means "when that word in line 1 is spoken". Leave `at` out and items appear
one per line.

Top level:
```
{ "id": "short-slug", "title": "Question the video answers (max 70 chars)", "caseNo": "PSA-YYYY-MMDD", "date": "YYYY.MM.DD",
  "voice": "af_heart", "thumb": {"big": "R370", "line": "Why is it STUCK?", "stamp": "EXPLAINED", "sub": "+ what you can do"},
  "scenes": [ ... ], "sources": [{"name": "Outlet, date: headline", "url": "https://..."}] }
```
`thumb.big` is one short number or word (max 5 characters) that sums the story up. `thumb.line` is max 22 characters.

Every scene except `hook` and `outro` has `"tag": ["WORD", "WORD"]` – two short words for the case-file label
top left (e.g. ["SUSPECT 01", "MONEY"], ["WHAT YOU", "CAN DO"]).

## Scene types

- **hook** – one giant number or word on screen. `value` (max 5 chars, e.g. "R370", "R25", "18h"), `label` (2-3 words,
  handwritten under it), optional `was` + `wasNote` (a yellow sticky: an earlier value, e.g. "R350" / "in 2020"),
  optional `ups` (exactly 3 short words that pop up with a red ▲, shown on line 3, e.g. ["Bread","Taxi fares","Electricity"]).
  The last line shows a "WHY?" burst. 4-5 lines.
- **title** – the case title. `headline` (max 22 chars), `sub` (max 45 chars), `stamp` (e.g. "UNDER INVESTIGATION"). 1 line.
- **timeline** – 3-5 points on a line. `points`: [{"year": "2020", "value": "R350" (max 6 chars), "note": "max 26 chars", "at": n}].
- **stats** – 2 or 3 big numbers. `items`: [{"value": "8.5M" (max 6 chars), "label": "max 30 chars", "color": "yellow|pink|blue", "at": n}].
- **suspects** – exactly 3 pinned evidence cards = the 3 main causes. `headline` (max 28 chars),
  `cards`: [{"n": "01", "title": "max 14 chars", "sub": "max 40 chars", "color": "yellow|pink|blue", "at": n or [line, "word"]}].
- **bars** – horizontal bar chart, 2-4 bars. `headline`, `bars`: [{"label": "max 28 chars", "value": number, "show": "R40bn" (max 12 chars), "color": ..., "at": n}].
- **calendar** – a row of 4-7 year pages each stamped with `stampText` (max 10 chars, default "RENEWED"). Use for "it keeps happening every year".
  `headline`, `years` ["2020", ...], `quote` (a real quote, max 110 chars), `quoteBy` (who + when), optional `law` + `lawSub` (sticky note, max 10 / 22 chars).
- **compare** – two columns and the gap between them. `headline`, `left` {"label","value" (number),"show"}, `right` {...},
  `gap` (max 6 chars, e.g. "-R56"), optional `noteTitle` (max 8 chars) + `note` (max 50 chars, sticky on line 3), optional `leftAt`, `rightAt`, `gapAt`.
- **court** – 2-4 steps in a process (court case, law, plan). `steps`: [{"date": "max 12", "title": "max 26", "text": "max 40", "at": n}], optional `stamp` (max 20 chars).
- **bankcheck** – a statement with money coming in and a limit crossed. Only for stories about income tests, bills or budgets.
  optional `note` (max 50 chars) + `noteBy` (the source) for the dark note on line 4.
  `headline`, `inflows` ["R300 from family", ...] (2-4, amount first), `total`, `limit`, `inflowAt` [[line,"word"], ...]. Line 3 stamps DECLINED; line 4 shows a dark note.
- **verdict** – the short answer. `headline` (max 20 chars), `points` (exactly 3, max 34 chars each), `pointAt`, `stamp` (max 14 chars).
- **checklist** – what the viewer can do. `items` (3-5): [{"title": "max 34 chars", "sub": "max 44 chars", "at": n}]. One line per item.
- **outro** – `headline` (max 20 chars), `sub` (max 40 chars). 2 lines, the last one asks people to follow Pulse SA News.

- **scenario** – an everyday person living the story (always an illustration, stamped EXAMPLE). `name` (e.g. "Gogo Nomsa"),
  `place`, `look` ("gogo" | "woman" | "man" | "youngman" | "child" | "worker"), `mood` ("worried" | "angry" | "happy" | "thinking" | "calm"),
  `bubbles` (2-4): [{"text": "what they say, max 60 chars", "at": n, "who": "person" or "narrator"}]. 3-5 lines.
  Use it early (right after the title) so viewers see themselves in the story, and again later to show a fix working.
- **voices** – what people are saying. `headline` (optional, default "What people are saying"), `items` (2-4):
  [{"text": "max 70 chars", "who": "max 40 chars", "at": n}]. Use REAL quotes from the articles ("Resident, Soweto (SABC News)",
  "Water minister (EWN)") or common questions clearly labelled as such ("A question many people ask"). Never invent a quote and
  put a real person's or outlet's name on it.
- **moneytrail** – follow the money: what was promised/budgeted vs what was delivered/seen, and the gap.
  `headline`, `promised` {"label","show","value"}, `delivered` {"label","show","value"}, `gap` ("R150m?", max 7 chars),
  `reasons` (2-3): [{"title": "max 18 chars, e.g. Corruption?", "status": "max 16 chars: PROVEN / BEING INVESTIGATED / NOT PROVEN / NOT ANNOUNCED / NO REPORT YET", "color", "at": n}],
  optional `promisedAt`, `deliveredAt`, `gapAt`. Only use with real numbers from sources.
- **howto** – numbered practical steps people can do themselves (check, report, organise). `headline` (max 30 chars),
  `steps` (3-5): [{"title": "max 36 chars", "sub": "max 44 chars", "at": n}].

## The story shape (case file)

hook → title → scenario (someone living it) → background (timeline / stats) → voices (what people are saying) →
suspects (3 causes) → one scene per cause (bars / calendar / compare / court / bankcheck / stats / moneytrail) →
moneytrail if there is a gap between money promised and results → verdict → howto and/or checklist (what you can do,
including what a community can do together) → outro. 12-20 scenes.

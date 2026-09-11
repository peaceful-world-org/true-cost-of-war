# Unified parity checklist

Reference: the current localized calculator (`*/calculator.html`, rendered under preview `parity/*`).

Goal: migrate the proven product into the unified architecture without redesigning it. A checked item means the unified candidate reproduces the reference behaviour or deliberately preserves an accessibility/architecture improvement without changing the user-facing information hierarchy.

## Architecture invariants

- [x] One shared HTML template
- [x] One shared CSS layer
- [x] One shared application runtime
- [x] One shared calculation engine
- [x] One canonical legacy data baseline
- [x] Locale files for every supported language
- [x] URL state for language, timeframe, share and birth year
- [x] Preview remains `noindex`

## Parity Sprint A — presentation and live runtime

- [x] Shared reference-style formatter exists outside the UI runtime
- [x] Currency placement and compact units are locale-configurable
- [x] Western-digit presentation can be retained where the reference uses it
- [x] Live spending rate uses the same 365.25-day year convention as the reference
- [x] Session counter measures active viewing time, not wall-clock time
- [x] Live loop pauses while the document is hidden
- [x] Hot-path updates mutate existing value nodes instead of rebuilding all cards
- [x] URL writes are kept outside the animation hot path
- [x] Main metrics update continuously in live modes
- [x] Mode changes use a 1200 ms ease-out count-up
- [ ] Published hero subtitle and opening lead ported exactly for every locale (RU/EN migration copy is in place)
- [ ] Reference metric descriptions ported to locale schema
- [ ] Reference methodology tooltip corpus ported to locale schema

## Reference surfaces still to port

- [ ] Hero-level methodology info control
- [ ] Main period-total info control and caption (caption restored; info control pending)
- [x] Session human equivalents: food / basic healthcare / extreme poverty
- [x] Per-person indirect financial burden card
- [ ] Direct / indirect death cards with descriptions and distinct colour roles (cards/colour roles restored; descriptions pending)
- [x] Economic-impact section title + intro (RU/EN migration copy)
- [ ] Infrastructure / YPLL / aggregate cards with reference descriptions (cards restored; descriptions pending)
- [x] Opportunity-cost section title + intro (RU/EN migration copy)
- [x] All 8 opportunity-cost programme rows
- [x] Programme need notes and xN progress bars
- [x] Extra-programme expand/collapse interaction on mobile
- [x] Conservative → Moderate → Systemic slider labels
- [x] Development / remaining-defence allocation bars
- [ ] Micro-redistribution mission block
- [ ] Peaceful World support CTA
- [ ] Philosophy / UNESCO quote block
- [ ] Day / month / year scale tiles
- [x] Text summary generation
- [x] Copy-to-clipboard feedback state
- [x] 1080×1080 infographic generation and download
- [x] Mobile summary and progressive disclosure
- [ ] Desktop tooltip collision protection
- [ ] Mobile inline tooltip container
- [x] Embed mode (`?embed=1`)
- [x] iframe resize contract (`pw2-resize`, `ResizeObserver`, request/response)
- [ ] Full RTL validation after restored reference layout is present

## Current migration note

Unified v0.7 now carries most of the reference interaction skeleton. The next pass is intentionally about parity details rather than redesign: tooltips/descriptions, remaining reference narrative blocks, full-locale copy, RTL/mobile validation, and visual calibration against the production reference.

## Promotion gates

Do not call the unified candidate production-ready until all of the following are true:

1. Required QA is green.
2. Every critical reference surface above is checked.
3. Desktop and mobile visual comparison is complete.
4. RU/EN plus AR/FA RTL smoke tests pass.
5. Embed mode is verified inside a real host page.
6. Final independent parity review finds no critical divergence.
7. Methodology/data changes, if any, are reviewed separately from the parity migration.

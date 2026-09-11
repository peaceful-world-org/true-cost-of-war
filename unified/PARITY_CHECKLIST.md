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
- [x] Published localized copy is extracted from the existing 11 calculator sources during preview CI
- [x] Generated parity copy is schema-validated before deployment
- [x] Unified-shell-only UI copy covers the same 11-language manifest

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
- [x] Published hero subtitle and opening lead are source-driven for every locale
- [x] Reference metric descriptions are source-driven for every locale
- [x] Reference methodology tooltip corpus is source-driven for every locale
- [x] Locale-specific word order is preserved in session equivalents rather than assuming English grammar

## Reference surfaces

- [x] Hero-level methodology info control
- [x] Main period-total info control and caption
- [x] Session human equivalents: food / basic healthcare / extreme poverty
- [x] Per-person indirect financial burden card
- [x] Direct / indirect death cards with descriptions and distinct colour roles
- [x] Economic-impact section title + intro
- [x] Infrastructure / YPLL / aggregate cards with reference descriptions
- [x] Opportunity-cost section title + intro
- [x] All 8 opportunity-cost programme rows
- [x] Programme need notes and xN progress bars
- [x] Extra-programme expand/collapse interaction on mobile
- [x] Conservative → Moderate → Systemic slider labels
- [x] Development / remaining-defence allocation bars
- [x] Micro-redistribution mission block
- [x] Peaceful World support CTA
- [x] Philosophy / UNESCO quote block
- [x] Day / month / year scale tiles
- [x] Text summary generation
- [x] Copy-to-clipboard feedback state
- [x] 1080×1080 infographic generation and download
- [x] Sharing controls localized across all 11 supported languages
- [x] RTL-aware infographic text direction for Arabic and Persian
- [x] Mobile summary and progressive disclosure
- [x] Desktop tooltip collision protection
- [x] Mobile inline tooltip container
- [x] Embed mode (`?embed=1`)
- [x] iframe resize contract (`pw2-resize`, `ResizeObserver`, request/response)
- [x] Preview embed smoke harness for RU / EN / AR / FA
- [ ] Full visual RTL validation on AR / FA

## Automated browser gates

- [x] Headless Chromium page-load smoke covers all 11 supported locales
- [x] Focused browser cases cover RU lifetime, EN minute, AR mobile RTL and FA mobile embed
- [x] Scenario chips update the calculator and persist share state into the URL
- [x] Lifetime mode reveals the birth-year control and birth-year edits persist into the URL
- [x] Mobile programme disclosure expands all five initially hidden rows
- [x] Mobile methodology tooltip opens inline and closes with Escape
- [x] Text summary generation and copy feedback execute in a real browser
- [x] Generated infographic decodes as exactly 1080×1080
- [x] Language switching to Arabic updates `lang`, `dir`, visible copy, text summary and generated infographic
- [x] Embed request/response returns a useful `pw2-resize` height inside a real iframe

These checks run against the built preview bundle before GitHub Pages deployment. They are regression gates, not a substitute for final human visual comparison on real desktop and mobile devices.

## Current migration note

The unified preview now carries the major reference interaction and narrative surfaces and no longer relies on an RU/EN-only parity layer. During CI, the wording already published in each localized calculator is extracted into a generated, validated copy corpus and consumed by the shared runtime. Small labels that exist only in the new unified shell live in one explicit 11-language UI-copy module.

Automated browser smoke is now complete across all 11 locales, with interaction-level coverage for URL state, lifetime controls, mobile disclosure, tooltips, sharing, 1080×1080 image generation, Arabic RTL switching and iframe resizing. The remaining work is deliberately concentrated in human device/visual testing, AR/FA visual RTL validation, RU/EN visual calibration against the reference, real-host embed verification, and the final independent parity council review. Detailed visual tuning remains deferred until those gates are stable. Production remains untouched.

## Promotion gates

Do not call the unified candidate production-ready until all of the following are true:

1. Required QA is green.
2. Every critical reference surface above is checked.
3. Desktop and mobile visual comparison is complete.
4. RU/EN plus AR/FA RTL smoke tests pass.
5. Embed mode is verified inside a real host page.
6. Final independent parity review finds no critical divergence.
7. Methodology/data changes, if any, are reviewed separately from the parity migration.

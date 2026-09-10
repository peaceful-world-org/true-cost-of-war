# True Cost of War — Methodology Audit v0.1

Date: 2026-09-10
Status: research working document

This document separates three things that the legacy calculator currently mixes together:

1. observed / published data;
2. modelling assumptions;
3. opportunity-cost benchmarks.

No number in this file changes production behaviour by itself. Runtime values remain frozen in `data/model.json` until a reviewed methodology update is approved.

## Executive findings

### 1. Global military expenditure baseline — UPDATE REQUIRED

Legacy runtime value: **USD 2.44 trillion/year**.

Latest SIPRI release available at this audit: **USD 2.887 trillion in 2025**. SIPRI states that the 2025 data replace previously published SIPRI military-spending data.

Primary source:
- SIPRI, *Trends in World Military Expenditure, 2025*, April 2026: https://www.sipri.org/publications/2026/sipri-fact-sheets/trends-world-military-expenditure-2025
- DOI: https://doi.org/10.55163/ZLHQ1057

Decision for v2: replace the current scalar after methodology review. Historical periods must not be calculated by multiplying the newest annual value by a number of years.

### 2. Direct deaths — REPLACE SCALAR WITH DATA SERIES WHERE POSSIBLE

Legacy runtime value: **150,000 direct deaths/year**.

This is currently used as a constant annual baseline and then extrapolated through time. That is a model assumption, not a historical series.

UCDP now publishes version 26.1 datasets covering organized violence through 2025. Its yearly armed-conflict datasets cover 1946–2025, while several disaggregated categories and battle-related-death series have strongest consistent coverage from 1989 onward.

Primary source:
- UCDP Dataset Download Center, version 26.1: https://ucdp.uu.se/downloads/
- Replication datasets for *Organized violence 1989–2025, and violent political protests* (2026): https://ucdp.uu.se/downloads/replication_data.html

Decision for v2: use real annual observations for periods and categories where a consistent UCDP series is available. Do not present a constant annual death rate multiplied backward in time as observed history. Coverage before 1989 needs a separate, explicit methodology decision.

### 3. Indirect-death multiplier — REVIEW REQUIRED

Legacy runtime value: **4 indirect deaths per direct death**.

The current calculator applies one global fixed multiplier across conflicts and historical periods. This should be treated as a modelling assumption unless a defensible cross-conflict methodology is established.

Decision for v2: do not retain a universal multiplier merely for continuity. Review the literature and, if retained at all, present indirect mortality as an explicitly modelled range or scenario with uncertainty rather than a single observed fact.

### 4. Infrastructure damage — MODEL ASSUMPTION, NOT OBSERVED GLOBAL DATA

Legacy runtime value: **USD 730 billion/year** (USD 732 billion in `ru/calculator.html`).

The user-facing text explains this as a conservative assumption equal to roughly **30% of baseline military expenditure**. No global observed damage series is currently linked to this number in the calculator.

Decision for v2: either support the coefficient with a transparent methodology and uncertainty range, or move this output into a clearly labelled scenario layer. It should not visually read like a measured global statistic.

### 5. Economic value per death — REVIEW / LIKELY DECOMPOSE

Legacy runtime value: **USD 500,000 per death**.

This value is used in the aggregate `Total Economic Setback` together with military expenditure and infrastructure damage. Those quantities represent conceptually different categories.

Decision for v2: review the conceptual validity of monetising deaths in this aggregate. Prefer separate transparent dimensions over one apparently precise total unless the aggregation has a defensible economic framework.

### 6. Average years of life lost — REVIEW REQUIRED

Legacy runtime value: **39 years per death**.

No canonical source/year/scope is attached to this scalar in the current data layer.

Decision for v2: identify the intended population and method. If no robust global conflict-specific estimate exists, remove the universal scalar or present a documented model range.

## Opportunity-cost benchmarks

These figures are not interchangeable with observed spending. Each benchmark needs a clearly defined scope, time horizon and source.

### Education — UPDATE REQUIRED

Legacy runtime value: **USD 39 billion/year**.

UNESCO's Global Education Monitoring work currently reports an average **USD 97 billion annual financing gap** for 79 low- and lower-middle-income countries to achieve their national SDG 4 education targets by 2030.

Primary source:
- UNESCO GEM, education finance: https://www.unesco.org/gem-report/en/education-finance
- Background costing publication: https://www.unesco.org/gem-report/en/publication/can-countries-afford-their-national-sdg-4-benchmarks

Decision for v2: replace or redefine the USD 39 billion benchmark. Use the precise UNESCO scope rather than a broader claim such as 'education for every child' unless separately supported.

### Primary health care — LEGACY VALUE IS WITHIN CURRENT WHO RANGE, BUT SCOPE MUST BE FIXED

Legacy runtime value: **USD 250 billion/year**.

WHO's current fact sheet estimates that achieving primary-health-care targets requires approximately **USD 200–328 billion in additional investment per year** for a more comprehensive package of health services in low- and middle-income countries.

Primary source:
- WHO, *Primary health care*, updated 5 December 2025: https://www.who.int/news-room/fact-sheets/detail/primary-health-care

Decision for v2: USD 250 billion can potentially remain as an illustrative midpoint only if labelled as such. Prefer showing the published WHO range and its exact scope.

### Internet connectivity — UPDATE REQUIRED / SCOPE MISMATCH

Legacy runtime value: **USD 43 billion/year**.

ITU's 2025 high-level estimate puts the financing required to close the global connectivity gap by 2030 at about **USD 1.6 trillion**, covering capital and operating expenditure for the modelled infrastructure drivers.

Primary source:
- ITU, *Connectivity and financing gaps: Assessing the challenge*, 2025: https://www.itu.int/hub/2025/01/connectivity-and-financing-gaps-assessing-the-challenge/

Decision for v2: do not simply replace USD 43 billion with USD 1.6 trillion; the time horizon and scope differ. Redesign the benchmark around a clearly stated target and period.

### Hunger — LEGACY VALUE HAS A PLAUSIBLE SOURCE, BUT CLAIM SCOPE MUST BE NARROW

Legacy runtime value: **USD 50 billion/year**.

FAO has cited modelling in which roughly **USD 39–50 billion per year** in targeted interventions through 2030 could address hunger at large scale. More recent FAO/CFS material stresses that published financing estimates differ radically with scope: lower estimates focus on targeted hunger/nutrition interventions, while structural food-system transformation costs far more.

Primary sources:
- FAO, statement citing USD 39–50 billion/year for targeted interventions: https://www.fao.org/new-york/fao-statements/detail/unga-76-second-committee-agriculture-development-food-security-and-nutrition-%28fao-statement%29/en
- FAO/CFS HLPE-FSN financing synthesis (2025), showing the wide range and scope differences: https://www.fao.org/fileadmin/templates/cfs/CFS53/Plenary_documents/Inf.20_HLPE-FSN_Financing/compiled_EN.pdf

Decision for v2: USD 50 billion may be usable only with the specific targeted-intervention scope and historical source date. Do not label it as the single universal 'cost to end hunger'.

### Water and sanitation — UPDATE / DEFINE TIME HORIZON

Legacy runtime value: **USD 150 billion/year**.

WHO cited a World Bank estimate of about **USD 114 billion/year** in infrastructure investment to meet water and sanitation targets, excluding operation and maintenance costs. Current World Bank material states that universal access to safe drinking water, sanitation and hygiene by 2030 requires an estimated **USD 1.04 trillion** in water and sanitation infrastructure, but that figure is a multi-year requirement rather than a directly interchangeable annual scalar.

Primary sources:
- WHO, 2018 summary of the USD 114 billion/year infrastructure estimate: https://www.who.int/news/item/01-10-2018-who-calls-for-increased-investment-to-reach-the-goal-of-a-toilet-for-all
- World Bank water overview, current multi-year investment requirement: https://www.worldbank.org/ext/en/topic/water

Decision for v2: retire the unsupported USD 150 billion scalar unless its original source is recovered. Choose one clearly scoped target and preserve its time horizon instead of converting different estimates into an apparently exact annual cost.

### Electricity access — UPDATE REQUIRED

Legacy runtime value: **USD 35 billion/year**.

An older IEA financing analysis did estimate **USD 35 billion/year** to enable universal electricity access by 2030, so the legacy number appears to have a credible provenance. However, the target date has moved and newer IEA scenarios differ. The World Energy Outlook 2025 ACCESS scenario estimates roughly **USD 23 billion/year for electricity access until 2035**, plus separate clean-cooking investment.

Primary sources:
- IEA, older analysis containing USD 35 billion/year: https://www.iea.org/reports/financing-clean-energy-transitions-in-emerging-and-developing-economies/financing-clean-power-efficiency-and-electrification
- IEA, *World Energy Outlook 2025 — Achieving access for all*: https://www.iea.org/reports/world-energy-outlook-2025/achieving-access-for-all

Decision for v2: update the benchmark and label whether it represents electricity only or electricity plus clean cooking. Do not mix target years.

### Climate — LEGACY NUMBER MAY MATCH A SPECIFIC ENERGY-TRANSITION SCOPE, NOT 'CLIMATE' GENERALLY

Legacy runtime value: **USD 1.5 trillion/year**.

Current UNFCCC materials describe climate-finance needs in multiple, non-interchangeable ways. A UNFCCC 2025 report citing the Independent High-Level Expert Group notes approximately **USD 2.4 trillion/year** in climate- and nature-related investment needs in developing countries excluding China by 2030. Other UNFCCC material cites approximately **USD 1.5 trillion/year** specifically for transformation of energy systems within that broader investment requirement.

Primary sources:
- UNFCCC, proposals for the Baku to Belém Roadmap to 1.3T: https://unfccc.int/sites/default/files/resource/BB1.3T_CEEW-GFC_Sep.pdf
- UNFCCC Standing Committee on Finance material citing the USD 1.5 trillion energy-system component: https://unfccc.int/sites/default/files/resource/UNFCCC_100bn_Apr2025_Web.pdf

Decision for v2: do not use USD 1.5 trillion as a generic global 'climate cost'. If retained, tie it to the specific geography, target year and energy-system-transformation scope. A broader climate benchmark requires a different definition.

### School construction unit cost — SOURCE REVIEW REQUIRED

Legacy runtime value: **USD 5 million per school**.

A universal school-construction cost is highly context dependent. No canonical source/year/scope has yet been verified in this audit.

Decision for v2: either use a documented reference scenario with location/size assumptions or remove it as a universal conversion factor.

## Historical-mode rule for v2

The current interface offers periods such as 'last 10 years', 'since 1945' and 'during my lifetime'. In the legacy implementation, at least some headline quantities are obtained by multiplying a current annual baseline by elapsed years.

For v2:

- **Observed series**: sum real annual observations for the requested period.
- **Modelled series**: show them separately and explicitly label assumptions.
- **Missing coverage**: say that coverage is incomplete; do not silently fill missing decades with today's rate.
- **Currency basis**: document whether a series uses current USD, constant USD, or nominal USD before summing across years.
- **Uncertainty**: use ranges where source uncertainty is material.

## Data architecture requirements

Every v2 metric should ultimately carry machine-readable metadata similar to:

```json
{
  "id": "global_military_expenditure",
  "kind": "observed",
  "value": 2887000000000,
  "currency": "USD",
  "priceBasis": "source-defined",
  "period": 2025,
  "scope": "world",
  "source": "SIPRI",
  "sourceUrl": "https://www.sipri.org/publications/2026/sipri-fact-sheets/trends-world-military-expenditure-2025",
  "retrieved": "2026-09-10",
  "uncertainty": null,
  "status": "reviewed-candidate"
}
```

The actual production schema should be chosen only after historical-series requirements are fixed.

## Review gates before changing production values

1. Primary-source verification.
2. Scope and time-horizon check.
3. Unit/currency check.
4. Independent methodology review.
5. Regression tests for headline outputs.
6. Localisation update for explanatory copy.
7. QA green on the protected PR.

This audit intentionally favours epistemic clarity over preserving dramatic headline numbers.

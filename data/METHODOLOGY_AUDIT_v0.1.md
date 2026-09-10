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

### Hunger — SOURCE REVIEW REQUIRED

Legacy runtime value: **USD 50 billion/year**.

No canonical source/year/scope has yet been verified in this audit.

Decision for v2: retain only as legacy baseline until a primary-source benchmark is selected and reviewed.

### Water — SOURCE REVIEW REQUIRED

Legacy runtime value: **USD 150 billion/year**.

No canonical source/year/scope has yet been verified in this audit.

Decision for v2: retain only as legacy baseline until a primary-source benchmark is selected and reviewed.

### Electricity — SOURCE REVIEW REQUIRED

Legacy runtime value: **USD 35 billion/year**.

No canonical source/year/scope has yet been verified in this audit.

Decision for v2: retain only as legacy baseline until a primary-source benchmark is selected and reviewed.

### Climate — SOURCE REVIEW REQUIRED

Legacy runtime value: **USD 1.5 trillion/year**.

No canonical source/year/scope has yet been verified in this audit.

Decision for v2: retain only as legacy baseline until a primary-source benchmark is selected and reviewed.

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

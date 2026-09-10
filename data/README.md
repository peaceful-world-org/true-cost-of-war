# Data model

`model.json` is the canonical machine-readable baseline for the numerical values currently embedded in True Cost of War.

Important: this file is a **legacy baseline**, not a methodological endorsement. It exists so the current product can be refactored safely before we update the evidence base. The next methodology phase will review each value, its scope, year, source, uncertainty, and whether it should remain a scalar at all.

## Why this exists

The current application duplicates the same `MODEL` object across localized HTML files. That makes accidental drift easy and makes evidence updates unnecessarily risky. QA now compares each localized model against this canonical baseline.

A known historical exception is recorded explicitly under `legacyOverrides`: `ru/calculator.html` uses a slightly different `annualInfraDamage` value. We preserve that difference for now rather than silently changing production behaviour.

## Migration path

1. Freeze the current numerical behaviour in `model.json` and CI.
2. Audit every metric and attach source/year/scope/uncertainty metadata.
3. Replace scalar historical extrapolation with real historical series where reliable data exists.
4. Move runtime calculation code to consume a shared data layer.
5. Remove duplicated `MODEL` objects and legacy overrides from localized HTML.

Until step 4, `model.json` is a verification source of truth, not yet the runtime source of truth.

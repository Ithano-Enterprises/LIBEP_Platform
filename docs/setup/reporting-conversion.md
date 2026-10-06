# Phase 5: conversion arithmetic foundation

`libep_private.kg_from_factor(measured_quantity, kg_per_unit)` is a private,
side-effect-free PostgreSQL numeric calculation intended for eventual use by
`v_catch_kg`. It is not the reporting view and does not select or store factors.

The helper multiplies explicitly supplied finite numeric values without binary
floating-point rounding. The factor must be finite and positive. Missing quantity
or factor produces NULL, never an invented zero. It does not round the result,
rewrite the measured quantity, decide which unit/species factor applies, or grant
any application access. Non-finite values and invalid supplied factors raise an
error even when the other argument is missing.

Zero and signed quantities have ordinary arithmetic meaning here; whether they
are valid catch records is a separate unresolved schema requirement. This helper
does not settle that question. Calculation fixtures are synthetic values only.

## Integration requirements

Before creating the actual reporting view, agree the factor's evidence source,
unit/species/context applicability, version/effective date, ambiguity handling,
and whether historical reports use the original or a later conversion decision.
Keep original measurements and factor provenance visible in that view.

SQL SUM ignores NULL. A future report must show the number of unresolved records
and label any resolved-only subtotal as partial. Do not turn missing factors into
zero or silently call a partial subtotal the total catch. Which reporting fields
carry these indicators remains part of the accepted view contract.

Application roles cannot directly execute this private helper. When the actual
view is designed, choose and test grants and row visibility explicitly; do not
use a security-definer wrapper as an implicit access-control bypass.

## Incomplete Phase 5 work

- Corrections: who may submit them, approval requirements, precedence/concurrency,
  and the accepted correction record shape.
- Actual catches/corrections tables and v_catches_effective.
- Approved species reference data, free-text/reconciliation records and queue.
- Conversion provenance/versioning and factor selection.
- v_catch_kg and v_reconciliation_queue output contracts and scoped access.
- Reporting totals, partial-data indicators and application integration.

The helper and its 17 SQL assertions do not complete these items. No new write
path, production view, species list or real-world conversion factor is introduced.

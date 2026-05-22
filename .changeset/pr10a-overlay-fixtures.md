---
'@objectstack/objectql': patch
---

ADR-0008 M0 PR-10a: pin overlay-whitelist + canonical-hash invariants
before re-expressing the overlay path as a LayeredRepository. No
runtime change — adds 28 regression tests that fail loud if a future
PR weakens the shared-DB tenancy contract or breaks hash stability.

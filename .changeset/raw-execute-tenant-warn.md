---
'@objectstack/driver-sql': patch
'@objectstack/objectql': patch
---

Document the tenant-isolation bypass on raw `execute()` (both `SqlDriver.execute()` and `engine.execute()`). The behaviour is unchanged — `execute()` has always passed commands through verbatim — but the JSDoc now spells out the security contract so callers know they must inline `WHERE organization_id = ?` themselves or restrict raw execution to genuinely global statements (migrations, control-plane tables).

---
'@objectstack/spec': minor
'@objectstack/core': patch
---

**Rename kernel plugin-sandbox permission schemas to remove a naming footgun** (issue #1383).

`@objectstack/spec/kernel` exported `PermissionSchema` / `PermissionSetSchema`
(and the `Permission` / `PermissionSet` types) for the plugin-sandbox security
model. Their names collided with the metadata-protocol permission set exported
from `@objectstack/spec/security` (`PermissionSetSchema`), making it very easy
to validate the `permission`/`profile` metadata type against the wrong schema
and reject every legal payload.

The kernel symbols are now prefixed with `Plugin` to reflect their specialized
semantics:

| Old (`@objectstack/spec/kernel`) | New |
|:---|:---|
| `PermissionSchema` | `PluginPermissionSchema` |
| `PermissionSetSchema` | `PluginPermissionSetSchema` |
| `Permission` (type) | `PluginPermission` |
| `PermissionSet` (type) | `PluginPermissionSet` |

The metadata `permission`/`profile` types are unchanged — keep using
`PermissionSetSchema` from `@objectstack/spec/security`.

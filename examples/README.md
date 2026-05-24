# ObjectStack Examples Catalog

> **Comprehensive examples demonstrating all ObjectStack protocols and features**

Welcome to the ObjectStack examples catalog! This directory contains carefully crafted examples organized by complexity and use case to help you get started quickly and learn the platform effectively.

## 📚 Quick Navigation

### By Learning Path

| Level | Examples | Description |
|-------|----------|-------------|
| 🟢 **Beginner** | [App Todo](#app-todo), [Plugin BI](#plugin-bi) | Start here - simple, focused examples |
| 🟡 **Intermediate** | [HotCRM](https://github.com/objectstack-ai/hotcrm) | Real-world enterprise application (separate repo) |
| 🔴 **Advanced** | [Server](../apps/objectos/) | Server hosting & plugin orchestration |

### By Protocol Category

| Protocol | Examples | Status |
|----------|----------|--------|
| **Data (ObjectQL)** | [App Todo](./app-todo/), [HotCRM](https://github.com/objectstack-ai/hotcrm) | ✅ Complete |
| **UI (ObjectUI)** | [App Todo](./app-todo/), [HotCRM](https://github.com/objectstack-ai/hotcrm) | ✅ Complete |
| **System (ObjectOS)** | [HotCRM](https://github.com/objectstack-ai/hotcrm) | ✅ Complete |
| **Automation** | [App Todo](./app-todo/), [HotCRM](https://github.com/objectstack-ai/hotcrm) | ✅ Complete |
| **API** | [HotCRM](https://github.com/objectstack-ai/hotcrm) | ✅ Complete |
| **BI / Analytics** | [Plugin BI](./plugin-bi/) | 🔴 Stub |
| **Hub & Marketplace** | _Coming soon_ | 🔴 Planned |

## 🎯 Example Descriptions

### App Todo
**Path:** [`examples/app-todo/`](./app-todo/)  
**Level:** 🟢 Beginner  
**Protocols:** Data, UI, Automation  

A complete task management application demonstrating all core ObjectStack protocols using the by-type directory convention.

**What you'll learn:**
- Object definitions with validations and workflows
- Actions (complete, defer, clone, bulk operations)
- Dashboards with 10 widgets (metrics, charts, tables)
- Reports (6 types: tabular, summary, matrix)
- Automation flows (reminders, escalation, recurring tasks)
- App navigation and branding configuration
- **I18n translations** (English, Chinese, Japanese)
- Package structure with `objectstack.config.ts`

**Directory Structure:**
```
app-todo/
├── objectstack.config.ts      # Main manifest (defineStack)
├── src/
│   ├── objects/                # Object & hook definitions
│   │   ├── task.object.ts
│   │   └── task.hook.ts
│   ├── actions/                # Action definitions
│   │   └── task.actions.ts
│   ├── apps/                   # App navigation
│   │   └── todo.app.ts
│   ├── dashboards/             # Dashboard widgets
│   │   └── task.dashboard.ts
│   ├── reports/                # Report definitions
│   │   └── task.report.ts
│   ├── flows/                  # Automation flows
│   │   └── task.flow.ts
│   └── translations/           # I18n translations (en, zh-CN, ja-JP)
│       └── todo.translation.ts
└── test/
    └── seed.test.ts
```

**Quick Start:**
```bash
cd examples/app-todo
pnpm install
pnpm typecheck
```

---

### App CRM (external)
**Repo:** [github.com/objectstack-ai/hotcrm](https://github.com/objectstack-ai/hotcrm)
**Level:** 🟡 Intermediate
**Protocols:** Data, UI, Automation, AI

**Full-featured CRM** demonstrating enterprise-grade patterns and all major field types. The CRM example has been extracted into its own repository (HotCRM) so it can evolve independently of the framework. Clone it side-by-side to follow along with the docs:

```bash
git clone https://github.com/objectstack-ai/hotcrm.git
cd hotcrm
pnpm install
pnpm dev
```

**What's included:**
- 12 interconnected objects (Account, Contact, Opportunity, Lead, Case, Task, Campaign, Contract, Product, Quote)
- All 28 field types demonstrated
- Multiple view types (Grid, Kanban, Calendar, Gantt)
- Validation rules and workflows
- 3 dashboards (Executive, Sales, Service) plus a unified CRM overview
- 6 reports (by account, contact, lead, opportunity, case, task)
- 5 automation flows (lead conversion, case escalation, opportunity approval, etc.)
- AI agents and RAG pipelines
- Sharing rules, profiles, and role hierarchy
- **I18n translations** (English, Chinese, Japanese, Spanish)
- Multi-driver E2E acceptance harness (sqlite / mongodb / postgres)

---

**Note:** Each example app in the framework monorepo is intentionally minimal. Production-grade reference apps (HotCRM, …) live in dedicated repositories under the [objectstack-ai org](https://github.com/objectstack-ai).

---

### Plugin BI
**Path:** [`examples/plugin-bi/`](./plugin-bi/)  
**Level:** 🟢 Beginner  
**Protocols:** Data, UI (Dashboards)  

**BI Plugin stub** demonstrating how to create an ObjectStack plugin that provides analytics objects and dashboards. Currently a placeholder for adding business intelligence capabilities.

**What you'll learn:**
- Plugin manifest structure (`type: 'plugin'`)
- Extending an app with analytics objects
- Dashboard widget definitions

**Directory Structure:**
```
plugin-bi/
├── objectstack.config.ts  # Plugin manifest (defineStack)
└── package.json
```

**Quick Start:**
```bash
cd examples/plugin-bi
pnpm install
pnpm typecheck
```

---

## 🗺️ Protocol Coverage Map

### Data Protocol (ObjectQL)
| Protocol | Example | Location |
|----------|---------|----------|
| Object Definition | ✅ Complete | [Todo Objects](./app-todo/src/objects/), [HotCRM Objects](https://github.com/objectstack-ai/hotcrm/tree/main/src/objects) |
| Field Types (28 types) | ✅ Complete | [HotCRM Account](https://github.com/objectstack-ai/hotcrm/blob/main/src/objects/account.object.ts) |
| Validation Rules | ✅ Complete | [Todo](./app-todo/src/objects/task.object.ts), [HotCRM](https://github.com/objectstack-ai/hotcrm) |
| Relationships | ✅ Complete | [HotCRM Contact](https://github.com/objectstack-ai/hotcrm/blob/main/src/objects/contact.object.ts) |
| Formulas | ✅ Complete | [HotCRM Account](https://github.com/objectstack-ai/hotcrm/blob/main/src/objects/account.object.ts) |
| Hooks | ✅ Complete | [Todo Hooks](./app-todo/src/objects/task.hook.ts), [HotCRM Hooks](https://github.com/objectstack-ai/hotcrm/tree/main/src/objects) |
| State Machines | ✅ Complete | [HotCRM Lead State](https://github.com/objectstack-ai/hotcrm/blob/main/src/objects/lead.state.ts) |
| Query & Filters | ✅ Complete | [Todo](./app-todo/), [HotCRM](https://github.com/objectstack-ai/hotcrm) |
| Document Storage | 🔴 Missing | _Planned_ |

### UI Protocol (ObjectUI)
| Protocol | Example | Location |
|----------|---------|----------|
| List Views | ✅ Complete | [HotCRM](https://github.com/objectstack-ai/hotcrm) - Grid, Kanban, Calendar, Gantt |
| Form Views | ✅ Complete | [HotCRM](https://github.com/objectstack-ai/hotcrm) - Simple, Tabbed, Wizard |
| Actions | ✅ Complete | [Todo Actions](./app-todo/src/actions/), [HotCRM Actions](https://github.com/objectstack-ai/hotcrm/tree/main/src/actions) |
| Dashboards | ✅ Complete | [Todo Dashboard](./app-todo/src/dashboards/), [HotCRM Dashboards](https://github.com/objectstack-ai/hotcrm/tree/main/src/dashboards) |
| Reports | ✅ Complete | [Todo Reports](./app-todo/src/reports/), [HotCRM Reports](https://github.com/objectstack-ai/hotcrm/tree/main/src/reports) |
| Apps | ✅ Complete | [Todo App](./app-todo/src/apps/todo.app.ts), [HotCRM App](https://github.com/objectstack-ai/hotcrm/blob/main/src/apps/crm.app.ts) |
| Charts | ✅ Complete | [HotCRM Dashboards](https://github.com/objectstack-ai/hotcrm/tree/main/src/dashboards) |
| Widgets | ✅ Complete | [Todo Dashboard](./app-todo/src/dashboards/task.dashboard.ts) |
| Components | 🔴 Missing | _Planned_ |

### System Protocol (ObjectOS)
| Protocol | Example | Location |
|----------|---------|----------|
| Manifest | ✅ Complete | All examples with `objectstack.config.ts` |
| Plugin System | ✅ Complete | [HotCRM](https://github.com/objectstack-ai/hotcrm) |
| Preview Mode | ✅ Complete | [HotCRM](https://github.com/objectstack-ai/hotcrm) — `OS_MODE=preview` |
| Datasources | 🟡 Partial | [HotCRM](https://github.com/objectstack-ai/hotcrm) |
| I18n / Translations | ✅ Complete | [Todo Translations](./app-todo/src/translations/), [HotCRM Translations](https://github.com/objectstack-ai/hotcrm/tree/main/src/translations) |
| Job Scheduling | 🔴 Missing | _Planned_ |
| Metrics | 🔴 Missing | _Planned_ |

### AI Protocol
| Protocol | Example | Location |
|----------|---------|----------|
| Agent | ✅ Complete | [HotCRM Agents](https://github.com/objectstack-ai/hotcrm/tree/main/src/agents) |
| RAG Pipeline | ✅ Complete | [HotCRM RAG](https://github.com/objectstack-ai/hotcrm/tree/main/src/rag) |
| Model Registry | ✅ Complete | _Spec Only_ |

### Automation Protocol
| Protocol | Example | Location |
|----------|---------|----------|
| Workflow Rules | ✅ Complete | [Todo](./app-todo/src/objects/task.object.ts), [HotCRM](https://github.com/objectstack-ai/hotcrm) |
| Flow (Visual) | ✅ Complete | [Todo Flows](./app-todo/src/flows/), [HotCRM Flows](https://github.com/objectstack-ai/hotcrm/tree/main/src/flows) |
| Approval Processes | ✅ Complete | [HotCRM Opportunity Approval](https://github.com/objectstack-ai/hotcrm/blob/main/src/flows/opportunity-approval.flow.ts) |
| Triggers | ✅ Complete | [Todo](./app-todo/), [HotCRM](https://github.com/objectstack-ai/hotcrm) |

### Auth & Permissions
| Protocol | Example | Location |
|----------|---------|----------|
| Profiles | ✅ Complete | [HotCRM Profiles](https://github.com/objectstack-ai/hotcrm/tree/main/src/profiles) |
| Sharing Rules | ✅ Complete | [HotCRM Sharing](https://github.com/objectstack-ai/hotcrm/tree/main/src/sharing) |
| RBAC | 🟡 Partial | [HotCRM](https://github.com/objectstack-ai/hotcrm) |

### API Protocol
| Protocol | Example | Location |
|----------|---------|----------|
| REST Server | ✅ Complete | [HotCRM](https://github.com/objectstack-ai/hotcrm) |
| Custom APIs | ✅ Complete | [HotCRM APIs](https://github.com/objectstack-ai/hotcrm/tree/main/src/apis) |
| GraphQL | 🔴 Missing | _Planned_ |
| WebSocket/Realtime | 🔴 Missing | _Planned_ |

---

## 🚀 Getting Started

### Prerequisites
```bash
# Ensure you have Node.js 18+ and pnpm installed
node --version  # >= 18.0.0
pnpm --version  # >= 8.0.0
```

### Quick Start
```bash
# 1. Clone and install
git clone https://github.com/objectstack-ai/spec.git
cd spec
pnpm install

# 2. Build the spec package
pnpm --filter @objectstack/spec build

# 3. Explore examples
cd examples/app-todo
pnpm typecheck

# 4. Or explore the CRM (separate repository)
git clone https://github.com/objectstack-ai/hotcrm.git
cd hotcrm && pnpm install && pnpm build
```

### Learning Path

#### Path 1: Quick Start (1-2 hours)
1. Read [Todo Example](./app-todo/) - Understand basic structure and conventions
2. Explore [Todo objectstack.config.ts](./app-todo/objectstack.config.ts) - See manifest patterns
3. Browse [HotCRM](https://github.com/objectstack-ai/hotcrm) - Learn advanced features

#### Path 2: Deep Dive (1-2 days)
1. Complete Path 1
2. Study [HotCRM Objects](https://github.com/objectstack-ai/hotcrm/tree/main/src/objects) - Master field types and relationships
3. Review [HotCRM Flows](https://github.com/objectstack-ai/hotcrm/tree/main/src/flows) - Understand automation patterns

---

## 📝 Example Standards

All examples in this directory follow these standards:

### Code Quality
- ✅ **Type-safe**: All examples use TypeScript and pass `typecheck`
- ✅ **Zod-first**: Schemas defined with Zod, types inferred
- ✅ **Naming conventions**: `camelCase` for config, `snake_case` for data
- ✅ **Documented**: Comprehensive inline comments
- ✅ **Best practices**: Follow ObjectStack conventions

### File Structure (By-Type Convention)
```
example-name/
├── README.md              # Comprehensive documentation
├── package.json           # Package definition
├── tsconfig.json          # TypeScript config
├── objectstack.config.ts  # Main manifest (defineStack)
├── src/
│   ├── objects/           # *.object.ts, *.hook.ts, *.state.ts
│   ├── actions/           # *.actions.ts
│   ├── apps/              # *.app.ts
│   ├── dashboards/        # *.dashboard.ts
│   ├── reports/           # *.report.ts
│   ├── flows/             # *.flow.ts
│   └── translations/      # *.translation.ts (i18n bundles)
└── test/
    └── seed.test.ts
```

### Documentation Requirements
Each example MUST have:
- Clear purpose statement
- Prerequisites and dependencies
- Quick start instructions
- Protocol coverage explanation
- Key concepts highlighted
- Related examples linked

---

## 🤝 Contributing Examples

Want to add an example? Great! Please ensure:

1. **Follow the standards** above
2. **Fill a gap** in protocol coverage
3. **Add documentation** (README.md)
4. **Test thoroughly** (must compile and run)
5. **Submit PR** with clear description

See [CONTRIBUTING.md](../CONTRIBUTING.md) for details.

---

## 📚 Additional Resources

- **[Main Documentation](../content/docs/)** - Complete protocol reference
- **[Architecture Guide](../ARCHITECTURE.md)** - System architecture
- **[Quick Reference](../QUICK-REFERENCE.md)** - Fast lookup
- **[Package Dependencies](../PACKAGE-DEPENDENCIES.md)** - Build order

---

## 📄 License

All examples are licensed under Apache 2.0. See [LICENSE](../LICENSE) for details.

---

**Last Updated:** 2026-02-12
**Protocol Version:** 3.0.0
**Total Examples:** 2 in-repo (app-todo, plugin-bi) + 1 external ([HotCRM](https://github.com/objectstack-ai/hotcrm))
**Directory Convention:** By-Type (Salesforce DX style)

# ObjectStack Todo Example

A comprehensive Todo application demonstrating the ObjectStack Protocol with task management, automation, dashboards, and reports.

## 🎯 Purpose

This example serves as a **quick-start reference** for learning ObjectStack basics. It demonstrates:
- Object definition with essential field types, validations, and workflows
- Actions for task management (complete, defer, clone, etc.)
- Dashboard with key metrics and visualizations
- Reports for status, priority, owner, and time tracking analysis
- Automation flows for reminders, escalation, and recurring tasks
- Full configuration using `objectstack.config.ts` with the standard **by-type** layout

For a **comprehensive enterprise example** with advanced features (AI agents, security profiles, sharing rules), see the **[HotCRM reference app](https://github.com/objectstack-ai/hotcrm)** (separate repository).

## 📂 Structure

Follows the **by-type** directory layout — the ObjectStack standard aligned with Salesforce DX:

```
examples/app-todo/
├── src/
│   ├── objects/                     # 📦 Data Models
│   │   ├── task.object.ts           #    Task object definition (fields, validations, workflows)
│   │   └── task.hook.ts             #    Data hooks / triggers
│   ├── actions/                     # ⚡ Buttons & Actions
│   │   └── task.actions.ts          #    Complete, Start, Defer, Clone, Mass Complete, Export
│   ├── apps/                        # 🚀 App Configuration
│   │   └── todo.app.ts              #    Navigation, branding
│   ├── dashboards/                  # 📊 BI Dashboards
│   │   └── task.dashboard.ts        #    Metrics, charts, task lists
│   ├── reports/                     # 📈 Analytics Reports
│   │   └── task.report.ts           #    By status, priority, owner, overdue, time tracking
│   └── flows/                       # 🔄 Automation Flows
│       └── task.flow.ts             #    Reminder, escalation, completion, quick-add
├── test/
│   └── seed.test.ts                 # 🧪 Seed data verification
├── objectstack.config.ts            # Application manifest
└── README.md
```

## 📋 Features Demonstrated

### Object Definition
- **Task Object** (`task`) with 20+ fields covering all common patterns

### Field Types Covered
- ✅ **Text** (`subject`) — Task title (required, searchable)
- ✅ **Markdown** (`description`) — Rich description
- ✅ **Select** (`status`, `priority`, `category`) — Single-select with colors
- ✅ **Multi-Select** (`tags`) — Multiple tag selection
- ✅ **Date / DateTime** (`due_date`, `reminder_date`, `completed_date`)
- ✅ **Boolean** (`is_completed`, `is_overdue`, `is_recurring`)
- ✅ **Number** (`estimated_hours`, `actual_hours`, `recurrence_interval`)
- ✅ **Percent** (`progress_percent`) — Progress tracking
- ✅ **Lookup** (`owner`) — User assignment
- ✅ **Color** (`category_color`) — Color picker with presets
- ✅ **Rich Text** (`notes`) — Formatted notes

### Actions (8)
- **Complete Task** / **Start Task** — Status transitions
- **Defer Task** — Reschedule with reason
- **Set Reminder** / **Clone Task** — Utility actions
- **Mass Complete** / **Delete Completed** / **Export CSV** — Bulk operations

### Dashboard
- 4 Key Metrics (total, completed today, overdue, completion rate)
- Charts (status pie, priority bar, weekly trend line, category donut)
- Task tables (overdue, due today)

### Reports (6)
- Tasks by Status / Priority / Owner
- Overdue Tasks / Completed Tasks
- Time Tracking (estimated vs actual hours matrix)

### Automation Flows (4)
- **Task Reminder** — Daily scheduled reminder for tasks due tomorrow
- **Overdue Escalation** — Auto-escalate tasks overdue by 3+ days
- **Task Completion** — Auto-create next occurrence for recurring tasks
- **Quick Add Task** — Screen flow for fast task creation

### Validations & Workflows
- Completed date required when status is "completed"
- Recurrence type required for recurring tasks
- Auto-set `is_completed`, `completed_date`, `progress_percent` on status change
- Auto-detect overdue tasks and send urgent notifications

## 💡 How to Run

### Prerequisites
- Node.js 18+ and pnpm 8+
- Install from monorepo root: `corepack enable && pnpm install`

### Type Check
```bash
cd examples/app-todo
pnpm typecheck
# Expected: No errors — all types validated against @objectstack/spec
```

### Build
```bash
pnpm --filter @example/app-todo build
# Expected: Build succeeds, generates dist/ output
```

### Explore the Config
Open `objectstack.config.ts` to see how all pieces connect via `defineStack()`.

## 📖 Learning Path

1. **Start Here** — Simple task management with full protocol coverage
2. **Next Step** — [HotCRM](https://github.com/objectstack-ai/hotcrm) — Enterprise features, AI agents, security
3. **Then** — [Official Documentation](../../content/docs/) — Complete protocol reference

## 🔗 Related Resources

- [Project Structure Guide](../../content/prompts/plugin/project-structure.prompt.md) — Standard directory layout
- [Metadata Protocol](../../content/prompts/plugin/metadata.prompt.md) — File suffix system
- [Object Schema Reference](../../packages/spec/src/data/object.zod.ts)
- [Field Types Reference](../../packages/spec/src/data/field.zod.ts)
- [HotCRM](https://github.com/objectstack-ai/hotcrm) — Full-featured enterprise reference (separate repo)

## 📝 License

MIT

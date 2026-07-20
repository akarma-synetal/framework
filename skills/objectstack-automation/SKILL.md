---
name: objectstack-automation
description: >
  Design ObjectStack automation — Flows (visual logic), Triggers,
  Approvals, state machines, scheduled jobs, and webhooks.
  Use when the user is adding `*.flow.ts`, wiring an
  event-driven rule, or modelling an approval chain. Do not use for data
  lifecycle hooks at the object layer (see objectstack-data) or for kernel
  / plugin events (see objectstack-platform). CEL expressions in flow
  conditions / edge guards: load objectstack-formula alongside.
license: Apache-2.0
compatibility: Requires @objectstack/spec 16.x (Zod v4 schemas)
metadata:
  author: objectstack-ai
  version: "1.2"
  domain: automation
  tags: flow, workflow, trigger, approval, state-machine, scheduled, webhook
---

# Automation Design — ObjectStack Automation Protocol

Expert instructions for designing business automation using the ObjectStack
specification. This skill covers Flows (visual logic orchestration), state
machines & approvals, Triggers (event-driven automation), and ETL
pipelines.

---

## When to Use This Skill

- You are building a **visual flow** (auto-launched, screen, or scheduled).
- You need a **state machine** or **approval process** for a business object.
- You are setting up **event-driven triggers** (record create/update/delete).
- You need **scheduled automation** (daily reports, data cleanup).
- You are designing an **ETL pipeline** for data synchronisation.

> **Predicates and conditions are CEL.** Every `condition` / `guard` /
> `entryCondition` / filter `value` in this skill is an **Expression**
> envelope evaluated by `@objectstack/formula`. Use the `P\`...\`` and
> `cel\`...\`` tagged templates from `@objectstack/spec`. See the
> **objectstack-formula** skill for the full CEL contract, stdlib
> (`now()`, `today()`, `daysFromNow(n)`, `daysBetween(a, b)`, `isBlank(v)`, `coalesce(v, fb)`),
> and the legacy → CEL translation table.

---

## Flows — Visual Logic Orchestration

A **Flow** is a directed graph of nodes that execute sequentially or in
parallel. Flows are the primary automation building block in ObjectStack.

### Flow Types

| Type | When to Use |
|:-----|:------------|
| `autolaunched` | Runs without user interaction — triggered by events, APIs, or other flows |
| `screen` | Interactive — presents UI screens to the user (wizards, forms) |
| `schedule` | Runs on a cron/interval cadence declared on the **start node's `config.schedule`** (daily cleanup, weekly reports) — or a **per-record date sweep** via `config.timeRelative`, see *Time-relative triggers* |
| `record_change` | Fires automatically on record create/update/delete (bind via the `start` node's `triggerType`) |
| `api` | Invoked explicitly via the API / `engine.execute()`, **or** bound as an inbound **webhook**: `POST /api/v1/automation/hooks/:flowName/:hookId` (see *Inbound webhook triggers* below) |

### Flow Node Types

Flows are built from **20 built-in node types** (the `FlowNodeAction` seed set —
plugins register more via `registerNodeExecutor`, e.g. `approval` below):

#### Control Flow

| Node | Purpose |
|:-----|:--------|
| `start` | Entry point — every flow has exactly one |
| `end` | Exit point — can have multiple (early exit, error exit) |
| `decision` | Conditional branching — routed by **edge `condition` predicates**, not node config (see the approval example below) |
| `loop` | Iterate a bounded body region over a collection |
| `map` | Sequential multi-instance — invoke a subflow once per item of a collection; each iteration may pause (batch approvals) |
| `parallel_gateway` | Fork execution into parallel branches |
| `join_gateway` | Synchronise parallel branches back together |
| `wait` | Pause execution until a timer elapses or a named signal arrives |
| `boundary_event` | Attach to another node — fires on timeout or error |
| `subflow` | Invoke another flow (reusable composition) |

#### Data Operations

| Node | Purpose |
|:-----|:--------|
| `assignment` | Set variable values |
| `create_record` | Insert a new record |
| `update_record` | Modify existing records |
| `delete_record` | Remove records |
| `get_record` | Fetch records with filters — there is **no `query_record`** node (that name has no executor and throws) |

#### External Integration

| Node | Purpose |
|:-----|:--------|
| `http` | Call an external HTTP API — canonical since protocol 11.0; `http_request` survives only as a deprecation-window alias |
| `notify` | Send a notification through the messaging service (inbox channel by default) |
| `connector_action` | Invoke a pre-built integration connector |
| `script` | Dispatch to a **registered** callable — `config.actionType` (`email`/`slack`) or a registered `config.function`. Inline `config.script` JS is **not** executed (see pitfall 9) |
| `screen` | Display a UI form to the user (screen flows only) |

#### Human Decision

| Node | Purpose |
|:-----|:--------|
| `approval` | Route a record for human sign-off — **suspends** the run until a decision, then continues down the `approve` / `reject` branch (contributed by `plugin-approvals`) |

### Flow Variables

Every flow defines input/output variables. `variables` is an **array** of
`{ name, type, isInput, isOutput }` entries — not a name-keyed map, and there
is no `label` property on a variable:

```typescript
variables: [
  {
    name: 'case_id',
    type: 'text',
    isInput: true,    // passed in when flow is invoked
    isOutput: false,
  },
  {
    name: 'approval_result',
    type: 'boolean',
    isInput: false,
    isOutput: true,   // returned when flow completes
  },
],
```

### Flow Example — Auto-Escalate Overdue Cases

> **Nodes connect via `edges`, not a `next` property.** The engine traverses
> `flow.edges` (`{ source, target }`); a bare `next:` on a node is ignored.
> `update_record` selects rows with **`filter`** — an ObjectQL `where` **map**
> of `field → value` / `field → { $operator: value }`, NOT the UI view-filter
> `[{ field, operator, value }]` triples — and writes with **`fields`**
> (a single call updates *every* matching row — no per-row loop needed).
> `label` is **required** on the flow and on every node.

```typescript
{
  name: 'escalate_overdue_cases',
  label: 'Escalate Overdue Cases',
  type: 'schedule',
  runAs: 'system',   // a scheduled run has no trigger user — elevate explicitly
  nodes: [
    {
      id: 'start',
      type: 'start',
      label: 'Daily at 09:00',
      // The cadence lives HERE, on the start node's config — FlowSchema has NO
      // top-level `schedule` key (one there is silently stripped and the flow
      // never binds). A bare cron string also works: schedule: '0 9 * * *'.
      // Do NOT use the cron`…` tagged template — its envelope is not a
      // recognized schedule shape.
      config: { schedule: { type: 'cron', expression: '0 9 * * *' } },
    },
    {
      id: 'escalate_overdue',
      type: 'update_record',
      label: 'Escalate Overdue Cases',
      config: {
        objectName: 'support_case',
        // which rows to update — `filter` is a `where` map, not filter triples
        filter: {
          status: { $in: ['new', 'open'] },
          due_date: { $lt: '{TODAY()}' },   // template token → today's date at run time
        },
        // what to write — `fields`, not `values`
        fields: { status: 'escalated' },
      },
    },
    {
      id: 'notify_manager',
      type: 'http',
      label: 'Notify Manager',
      config: {
        url: 'https://hooks.slack.com/services/...',
        method: 'POST',
        body: { text: 'Escalated overdue support cases.' },
        timeoutMs: 10000,   // unset = NO timeout at all — always set one
      },
    },
    { id: 'end', type: 'end', label: 'End' },
  ],
  edges: [
    { id: 'e1', source: 'start',            target: 'escalate_overdue' },
    { id: 'e2', source: 'escalate_overdue', target: 'notify_manager' },
    { id: 'e3', source: 'notify_manager',   target: 'end' },
  ],
}
```

---

## State Machines & Approvals

A record's **state machine** locks the legal transitions of its status field
so that automation — increasingly AI-generated — cannot drive a record into an
illegal state.

### State Machine — a `state_machine` validation rule (ADR-0020)

Since **ADR-0020** there is **no `workflow` metadata type** and no
`object.stateMachines` map. A record state machine is **one `state_machine`
validation rule** in the object's `validations` array: a flat `field` +
`{ from: [allowedTo] }` transition table. It is **enforced on the write path** —
an update whose `field` moves to a state not listed for the current state is
rejected with the rule's `message`. A `from` state mapped to `[]` is a declared
dead-end.

```typescript
// On the object definition — crm_opportunity.validations[]
{
  type: 'state_machine',
  name: 'case_lifecycle',
  label: 'Case Lifecycle',
  field: 'status',                 // the field that holds the state
  message: 'Invalid status transition.',
  initialStates: ['new'],          // states a record may be CREATED in (#3165)
  transitions: {
    new:       ['open'],
    open:      ['escalated', 'resolved'],
    escalated: ['open', 'resolved'],
    resolved:  ['open', 'closed'],
    closed:    [],                 // final — no outgoing transitions
  },
}
```

Notes:
- **One rule per field.** Parallel lifecycles (e.g. `status` + `payment_status`)
  are N separate `state_machine` rules, one per field.
- **`initialStates`** (optional, #3165) gates INSERT: a record created with its
  state field outside this list is rejected. `transitions` only governs
  updates, so without it a record can be born mid-flow (e.g. created already
  `resolved`). Omit to keep the legacy no-check-on-insert behavior.
- **Conditional transitions / side effects are NOT part of the machine.** A
  guard is expressed as a sibling `script` / `conditional` validation rule;
  "do something when the state changes" is a **record-triggered Flow**
  (ADR-0019) — a `record_change` flow whose start-node condition gates on the
  transition, e.g. `previous.status != 'escalated' && record.status == 'escalated'`.
- **Introspection:** `GET /metadata/objects/:name/state/:field?from=:state`
  returns the legal next states so UIs/agents can read the transition table
  instead of hard-coding it (`next: null` when no FSM governs the field).
- Predicate conditions in sibling rules evaluate against the merged record in
  the **`record.<field>`** CEL scope (bare field names do not resolve).

### Approvals (Flow Nodes)

Since **ADR-0019** there is no standalone approval-process type. An approval is
authored as an **Approval node** (`type: 'approval'`) on an ordinary flow — the
run **suspends** when it reaches the node and **resumes** down the node's
`approve` / `reject` out-edge once a decision is recorded. Multi-step review is
just successive Approval nodes wired together on the canvas, so the whole review
is one diagram a reviewer (or AI) can read end-to-end.

> The old process-level concepts re-home onto the flow graph + node config — see
> the re-home table below. The approval *state* (`sys_approval_request` /
> `sys_approval_action`, the record lock, the status mirror, approver
> resolution) is unchanged and still owned by `plugin-approvals`.

```typescript
// A record-triggered flow: high-value opportunities need manager sign-off,
// and director sign-off too when the amount clears 500k.
{
  name: 'opportunity_discount_approval',
  label: 'Opportunity Discount Approval',
  type: 'record_change',
  nodes: [
    // Record-change flows bind via the START NODE's config — there is no
    // separate top-level `trigger`. `triggerType` is one of
    // `record-(before|after)-(create|update|delete)`; `condition` (bare CEL)
    // gates whether the flow launches.
    {
      id: 'start',
      type: 'start',
      label: 'On Opportunity Update',
      config: {
        objectName: 'opportunity',
        triggerType: 'record-after-update',
        condition: cel`record.amount > 100000`,
      },
    },
    {
      id: 'manager_review',
      type: 'approval',
      label: 'Sales Manager Review',
      config: {
        approvers: [{ type: 'position', value: 'sales_manager' }],
        behavior: 'first_response',            // or 'unanimous' / 'quorum' / 'per_group'
        lockRecord: true,                      // lock the record while pending
        approvalStatusField: 'approval_status', // mirror pending|approved|rejected|recalled onto the row
      },
    },
    // Decision routing lives on the OUT-EDGES, not in node config: the engine
    // evaluates each out-edge's `condition` and follows every match — and an
    // out-edge with NO condition ALWAYS runs (all such edges execute in
    // PARALLEL). Guard every branch with a condition — see e4/e5 below.
    { id: 'needs_director', type: 'decision', label: 'Needs Director?' },
    {
      id: 'director_signoff',
      type: 'approval',
      label: 'Sales Director Sign-off',
      config: {
        approvers: [{ type: 'position', value: 'sales_director' }],
        behavior: 'unanimous',
        approvalStatusField: 'approval_status',
      },
    },
    { id: 'mark_won', type: 'update_record', label: 'Mark Won',
      config: { objectName: 'opportunity', filter: { id: '{record.id}' }, fields: { stage: 'closed_won' } } },
    { id: 'approved', type: 'end', label: 'Approved' },
    { id: 'rejected', type: 'end', label: 'Rejected' },
  ],
  edges: [
    { id: 'e1', source: 'start',          target: 'manager_review',
      // entry criteria re-homes onto the edge entering the approval node:
      condition: cel`record.amount > 100000` },
    { id: 'e2', source: 'manager_review',  target: 'needs_director',   label: 'approve' },
    { id: 'e3', source: 'manager_review',  target: 'rejected',         label: 'reject'  },
    // Decision branches: mutually-exclusive edge `condition` predicates.
    // Without them BOTH branches would execute (unguarded edges run in parallel).
    { id: 'e4', source: 'needs_director',  target: 'director_signoff', label: 'true',
      condition: cel`record.amount > 500000` },
    { id: 'e5', source: 'needs_director',  target: 'mark_won',         label: 'false',
      condition: cel`record.amount <= 500000` },
    { id: 'e6', source: 'director_signoff', target: 'mark_won',        label: 'approve' },
    { id: 'e7', source: 'director_signoff', target: 'rejected',        label: 'reject'  },
    { id: 'e8', source: 'mark_won',         target: 'approved' },
  ],
}
```

### Send-back for revision (ADR-0044)

Approval centers also model **send back for revision** (退回修改) — distinct from
`reject` (terminate) and from a comment thread (which keeps the request pending).
Send-back is a **flow movement**: the request finalizes as `returned`, the run
walks a **`revise`** out-edge to a `wait` node where the record unlocks and the
submitter reworks it, and an explicit *resubmit* re-enters the approval node over
a **declared back-edge**, opening round N+1 with a fresh approver slate.

```
approval ──approve──▶ …
         ──reject───▶ …
         ──revise───▶ wait (signal; record unlocked, submitter edits)
                        └──resubmit──[type:'back']──▶ approval   (round N+1)
```

Three pieces author it:

1. **`revise` out-edge** — a third branch label alongside `approve` / `reject`,
   targeting an ordinary `wait` node (signal flavour).
2. **`type: 'back'` resubmit edge** — the edge from the wait node back into the
   approval node MUST be typed `'back'`. This is the *only* thing that legalizes
   the cycle: `registerFlow` validates the graph **minus `back` edges** as a DAG,
   so an **unmarked** cycle is rejected — you opt in, edge by edge. At run time a
   back-edge traverses normally (it just re-enters the node).
3. **`maxRevisions`** on the approval `config` (default `3`) — the budget of
   send-backs per run; exceeding it **auto-rejects** (resumes down the `reject`
   edge). `maxRevisions: 0` disables send-back, so never pair `0` with a `revise`
   edge.

```typescript
{
  id: 'manager_review', type: 'approval', label: 'Manager Review',
  config: { approvers: [{ type: 'position', value: 'manager' }], lockRecord: true, maxRevisions: 2 },
},
// The signal keys may also live in the spec-canonical node-level
// `waitEventConfig` block (FlowNodeSchema); the wait executor reads
// `waitEventConfig` first and falls back to these loose `config` keys.
{ id: 'wait_revision', type: 'wait', label: 'Awaiting Revision',
  config: { eventType: 'signal', signalName: 'budget_revision' } },
// …among the approval's edges…
{ id: 'rev',  source: 'manager_review', target: 'wait_revision',  label: 'revise' },
{ id: 'back', source: 'wait_revision',  target: 'manager_review', label: 'resubmit', type: 'back' },
```

> Two mistakes the compile-time flow lint flags: a `revise` edge whose wait node
> never loops back (a dead end `registerFlow` accepts but that leaves the
> submitter nowhere to resubmit), and a resubmit edge left **without**
> `type: 'back'` (an unmarked cycle `registerFlow` rejects). Resubmit is an
> explicit verb (`POST /api/v1/approvals/requests/:id/resubmit`), never a
> record-save. See the `showcase_budget_approval` flow in the showcase app in
> the framework repo for the canonical shape.

### Re-homing the old process model

If you've seen the pre-ADR-0019 `ApprovalProcess.create({...})` shape, every
concept maps onto the flow:

| Old process concept | Now |
|:--------------------|:----|
| `steps: [...]` (linear list) | successive **Approval nodes** joined by edges |
| `entryCriteria` (process or step) | a `condition` on the **edge entering** the node |
| `onApprove` / `onReject` actions | downstream **nodes** wired to the `approve` / `reject` out-edge |
| `rejectionBehavior: 'back_to_previous'` | a **back-edge** to an earlier node |
| `rejectionBehavior: 'reject_process'` | the `reject` edge routed to an `end` node |
| `approvers` / `behavior` / `lockRecord` / `approvalStatusField` / `escalation` | the Approval node's `config` (`ApprovalNodeConfigSchema`) |

There is no `approvals: [...]` stack collection anymore — approval flows live in
your normal `flows: [...]`.

### Recording a decision

A decision is recorded through `ApprovalService.decide()` (or the REST routes
`POST /api/v1/approvals/requests/:id/approve` | `/reject`). That finalizes the
`sys_approval_request` and **resumes** the suspended run down the matching
branch — you never resume the flow by hand.

### Approver Types

| `type` | Resolves to |
|:-------|:------------|
| `user`       | A specific user id (`value` = user id) |
| `position`   | Holders of a position — `value` = the position machine name, resolved via `sys_user_position` (ADR-0090 D3) |
| `org_membership_level` | The better-auth **org-membership tier** — `value` is one of `owner`/`admin`/`member`, and nothing else. **NOT** a position: `{ type: 'org_membership_level', value: 'sales_manager' }` matches nobody; use `position`. Spelled `role` before ADR-0090 D3 — that spelling is deprecated, still resolves, and is removed in the next major |
| `team`       | Members of a flat `sys_team` |
| `department` | A department + all descendant departments |
| `manager`    | The submitter's manager (`sys_user.manager_id`) |
| `field`      | User id read from a record field (`value` = field name) |
| `queue`      | A data-ownership queue |

### Node Config (`ApprovalNodeConfigSchema`)

| Field | Purpose |
|:------|:--------|
| `approvers` | Who may act (≥ 1 — see Approver Types above). Each approver may carry an optional **`group`** label (e.g. `{ type: 'position', value: 'auditor', group: 'finance' }`) — with `behavior: 'per_group'`, approvers sharing a label form one group; unlabelled approvers each form their own |
| `behavior` | `first_response` (first approver decides), `unanimous` (all must approve), `quorum` (`minApprovals` of N — M-of-N collective sign-off), or `per_group` (EACH approver `group` must reach `minApprovals` — one-from-each-group sign-off, 会签). In every mode a single rejection finalizes the node as `rejected`. Default `first_response` |
| `minApprovals` | Approvals required — total for `quorum`, per group for `per_group`. Default `1`; clamped at runtime to the resolvable approver count so a misconfiguration can never deadlock |
| `lockRecord` | Lock the triggering record from edits while pending. Default `true` |
| `approvalStatusField` | Business-object field to mirror `pending`/`approved`/`rejected`/`recalled` onto (should be readonly) |
| `escalation` | Optional per-node SLA — `{ enabled, timeoutHours, action: reassign\|auto_approve\|auto_reject\|notify, escalateTo?, notifySubmitter }`. `escalateTo` is a **position machine name** (expanded to its holders via `sys_user_position`, ADR-0090 D3) or a specific user id — never a membership tier. `reassign` without `escalateTo` degrades to notify (linted) |
| `maxRevisions` | ADR-0044 — max **send-backs-for-revision** per run before auto-reject. Default `3`; `0` disables send-back. Only meaningful when the node has a `revise` out-edge |

### Branching, side-effects & rejection

These are wired on the **graph**, not in node config:

- **Conditional step** — put a `decision` node before the Approval node, or a
  `condition` on the edge entering it (the old per-step `entryCriteria`).
- **On approve / on reject** — wire downstream nodes (`update_record`,
  `http`, a `notify` node, …) to the `approve` / `reject` out-edge.
- **Roll back on reject** — route the `reject` edge as a **back-edge** to an
  earlier node so the submitter can revise (the old `back_to_previous`).
- **Send back for revision (ADR-0044)** — distinct from a plain reject: an
  Approval node can emit a third decision **`revise`** on a `revise`-labeled
  out-edge that routes to a rework wait point. The submitter edits and
  resubmits, re-entering the node via an edge `type: 'back'` (a declared
  back-edge — traversed at run time but excluded from DAG cycle validation).
  `maxRevisions` (node config, default `3`) caps the loop before auto-reject.
- **Hard reject** — route the `reject` edge to an `end` node (the old
  `reject_process`).

### Approval Best Practices

1. **Gate entry on the edge** (`condition` into the Approval node) so the flow
   only pauses for records that actually need sign-off.
2. **Set `approvalStatusField`** to mirror status onto the row — views and
   formulas can then filter on it without joining `sys_approval_request`.
3. **Keep `lockRecord: true`** unless you have a strong reason to allow
   edits while pending — otherwise approvers chase a moving target.
4. **Model rejection as a visible branch** — a back-edge to revise, or an `end`
   node to terminate. The path is on the diagram, not hidden in config.
5. **Notify from downstream nodes** wired to the `approve` / `reject` edges
   rather than expecting the node to send mail itself.

---

## Triggers — Event-Driven Automation

A `record_change` flow fires automatically on a data event. There is **no
standalone trigger object and no top-level `trigger` / `event` key** — the
binding lives entirely in the flow's **`start` node `config`**, which the
automation engine parses (`resolveTriggerBinding`) and wires to the matching
ObjectQL lifecycle hook.

### Prerequisite — enable the `triggers` capability

Record-change, schedule, **and inbound-webhook (`api`)** triggers ship behind the
`triggers` capability. **Without it the flows register but never fire.** Add it
to the package config:

```typescript
defineStack({
  // …
  requires: ['automation', 'triggers'],
  //   + 'job'   for scheduled (cron) flows
  //   + 'queue' for inbound-webhook ('api') flows — the trigger-api plugin
  //             depends on the queue service; without it every inbound POST
  //             returns 503 queue_unavailable.
});
```

### Inbound webhook (`api`) triggers (ADR-0041 Tier 1)

An `api` flow can be bound to an inbound HTTP endpoint:
`POST /api/v1/automation/hooks/:flowName/:hookId`. Configure it on the **start
node `config`** (the start `config` is a free-form record, so these keys are
read at runtime, not Zod-validated):

| `config` key | Purpose |
|:-------------|:--------|
| `hookId` | URL path token (default `'default'`). **Rotate it to revoke** a leaked endpoint |
| `secret` | HMAC-SHA256 shared secret. Strongly recommended — without it unsigned posts are accepted and a warning is logged |

- **Signature:** sender sends `x-objectstack-signature: sha256=<hex>` (GitHub/Stripe style).
- **Idempotency:** `x-idempotency-key` dedupes retries — author the flow to be idempotent (delivery is at-least-once).
- **Queue-backed:** the endpoint ACKs `202` and enqueues; the flow runs on the consumer, never in-band. Requires the `queue` service (see prerequisite).
- The JSON body surfaces to the flow as the trigger record (`record.*` / bare fields) plus `params`.

### Trigger Types (start-node `config.triggerType`)

| `triggerType` | Fires | ObjectQL hook |
|:------|:------|:------|
| `record-before-create` | before insert (can modify/reject) | `beforeInsert` |
| `record-after-create` | after insert | `afterInsert` |
| `record-before-update` | before update | `beforeUpdate` |
| `record-after-update` | after update | `afterUpdate` |
| `record-before-delete` | before delete | `beforeDelete` |
| `record-after-delete` | after delete | `afterDelete` |

### Trigger Configuration — on the `start` node

```typescript
{
  name: 'notify_on_escalation',
  label: 'Notify on Escalation',
  type: 'record_change',
  nodes: [
    {
      id: 'start',
      type: 'start',
      label: 'On Case Escalated',
      config: {
        objectName: 'support_case',
        triggerType: 'record-after-update',
        // bare CEL; gates whether the flow launches on the event
        condition: cel`previous.status != 'escalated' && record.status == 'escalated'`,
      },
    },
    // …downstream nodes, connected via `edges`
  ],
}
```

> **`previous`** and **`record`** are the CEL variables available in update
> triggers — `previous.x` is the value before the change, `record.x` is the
> value after. (Salesforce-flavor `OLD` / `NEW` were removed in M9.5 and now
> evaluate to `null`.) See [objectstack-formula](../objectstack-formula/SKILL.md).

### Time-relative triggers — scheduled per-record date sweep

**Don't** express "act N days before/after a date" (renewal reminders, "expiring
soon", overdue sweeps) as a `record_change` flow gated on date-equality
(`end_date == daysFromNow(60)`) — that predicate is only evaluated when the
record *happens to change*, so unattended it almost never fires. Use a
**declarative time-relative trigger**: a `schedule`-type flow whose `start` node
carries a **`timeRelative`** descriptor is swept on a schedule (daily by default)
and launched **once per record** whose date field falls in the window. The record
is on the context, so the start `condition` and `{record.*}` interpolation work
exactly as for a record-change flow — and because the window is evaluated every
day, a threshold is never missed.

```typescript
{
  name: 'renewal_alert',
  label: 'Renewal Alert',
  type: 'schedule',
  runAs: 'system',              // a sweep has no trigger user — elevate explicitly
  nodes: [
    {
      id: 'start', type: 'start', label: 'Daily Sweep',
      config: {
        timeRelative: {
          object: 'contracts',
          dateField: 'end_date',
          offsetDays: [60, 30, 7],   // fire exactly at T-60 / T-30 / T-7
          // — or — withinDays: 30    // "expiring within 30 days" (negative = overdue lookback)
          filter: { status: 'active' },  // optional, ANDed with the date window
          // maxRecords: 1000            // optional per-sweep cap (default 1000)
        },
        // Optional sweep cadence; omit for daily 08:00 UTC. Plain shape only:
        // schedule: { type: 'cron', expression: '0 8 * * *' }
      },
    },
    // …downstream nodes (notify, update_record, …)
  ],
  edges: [ /* start → downstream */ ],
}
```

Exactly one of `offsetDays` (discrete T-minus days) or `withinDays` (a range;
negative = overdue) is required. Ships in `@objectstack/trigger-schedule` —
needs `requires: ['automation', 'triggers']` **plus `'job'`** (the sweep cadence
runs on the job service). Full descriptor schema:
`node_modules/@objectstack/spec/src/automation/time-relative-trigger.zod.ts`.

---

## Best Practices

### Flow Design

1. **Keep flows small and composable.** Use `subflow` nodes to break complex
   logic into reusable parts.
2. **Always handle errors.** Add `boundary_event` nodes for timeout and error
   scenarios.
3. **Use variables for all dynamic values.** Never hard-code record IDs or
   API keys in node config.
4. **Prefer `get_record` over multiple `http` calls** when the data
   lives in ObjectStack.
5. **Always set `timeoutMs` on `http` nodes.** Unset means **no timeout at
   all** — a hung endpoint stalls the run indefinitely.

### State Machine Design (ADR-0020)

1. **Author it as a `state_machine` validation rule** on the object, not a
   `workflow` metadata type (retired) — one rule per state field.
2. **Define explicit transitions** — `{ from: [allowedTo] }`. A state mapped to
   `[]` is a final/dead-end state.
3. **Don't rely on implicit "any → any"** — an update to a `from` state not
   listed as a key is treated leniently (no lock), so list every state you want
   guarded.
4. **Put guards in a sibling `script` / `conditional` rule**, not in the
   transition table (the machine stays a flat table).
5. **Put side-effects (emails, notifications, task creation) in a
   record-triggered Flow** (ADR-0019), not on the transition.

### Trigger Design

1. **Prefer `record-after-*` triggers** unless you need to modify/reject the record.
2. **Avoid infinite loops:** Do not update the same object in a
   `record-after-update` trigger without a guard condition.
3. **Use the start-node `condition`** to narrow when the trigger fires — avoid
   running expensive logic on every save.

---

## Common Pitfalls

1. **Circular flow references.** Flow A calls Flow B which calls Flow A. Use
   a depth counter or `visited` set to detect cycles.
2. **Unmatched `parallel_gateway` / `join_gateway`.** Every fork must have a
   corresponding join.
3. **Missing `end` node.** Every path through the flow must terminate.
4. **`record-before-*` trigger throwing unhandled errors.** This silently
   prevents the record operation — always provide a user-friendly error message.
5. **Scheduled flows without idempotency.** If the flow runs twice
   accidentally, the result should be the same.

### Valid-but-silently-wrong (passes build, fails at runtime)

These are *legal* metadata that authors — AI especially — get wrong. Most are now
caught by `objectstack build` (a hard error, or an advisory warning), but write
them right the first time:

6. **Flow node VALUE interpolation uses SINGLE braces.** Value fields on a node's
   `config` (`fields`, `inputs`, notify `message`/`title`, …) interpolate
   `{token}`:
   - `{var}` / `{record.title}` — variable / record field
   - `{record.tags.0}` — **array index** (e.g. a `multiple: true` lookup, stored as an array)
   - `{$User.Id}` / `{NOW()}` / `{TODAY() + 30}` — current user / date macros
   - anything without `{…}` is a **literal**

   ❌ `body: '{{ai_reply}}'` — double-brace is the *formula / template-field* dialect, **not** flow values
   ❌ `ticket: '$source.id'` — a bare `$ref` is a literal string, not interpolated
   ✅ `body: '{ai_reply}'`, `ticket: '{source.id}'`

7. **`create_record`'s `outputVariable` holds the created RECORD, not its id.**
   Reference a field explicitly.
   ❌ `update_record … fields: { ref: '{newRec}' }` → yields the whole record object
   ✅ `fields: { ref: '{newRec.id}' }`

8. **Time-relative rules ("alert N days before a date") are SCHEDULE flows, not
   record-change date-equality.** `record.end_date == daysFromNow(60)` on a
   `record-*` trigger only fires if the record happens to be written on that exact
   day — unattended rules never run. **And date EQUALITY never matches anyway**: a
   `date` field carries a time component, so `field == daysFromNow(N)` (or
   `{ $in: [daysFromNow(N), …] }`) compares two differently-timed timestamps and
   silently returns nothing (build warns `flow-date-equality-filter`).
   ✅ A daily `schedule` flow whose `get_record` filters each tier as a one-day
   **window** (`$gte`/`$lt`), never an equality:
   ```ts
   filter: { status: 'active', $or: [
     { end_date: { $gte: '{TODAY() + 7}',  $lt: '{TODAY() + 8}'  } },
     { end_date: { $gte: '{TODAY() + 30}', $lt: '{TODAY() + 31}' } },
     { end_date: { $gte: '{TODAY() + 60}', $lt: '{TODAY() + 61}' } },
   ] }
   ```
   (Use `{TODAY() + N}` template tokens in CRUD-node filter values — a
   `cel\`…\`` envelope is not evaluated there and would be compared as a
   literal object.)
   Abutting windows tile the timeline so each record matches exactly one tier —
   fires once, idempotent, no guard field. For "days remaining" in the message,
   `daysBetween(today(), record.end_date)`.

9. **`script` nodes must name a callable.** Set `config.actionType` to a built-in
   side-effect (`email` / `slack`) **or** `config.function` to a function
   registered via `defineStack({ functions: { my_fn: (ctx) => … } })`. An empty
   `script` node — or one pointing at an unregistered function — fails loudly.
   Inline `config.script` JS is **not executed** by the built-in runtime (no
   server-side sandbox) — move logic into a registered `function`.

   **A flow `function` is a PURE compute step — it does NOT read/write the
   database.** It receives `ctx.input` and **returns** a value; `config.outputVariable`
   exposes that value as a flow variable, and a later **declarative** node persists
   it. Keep data effects on the flow graph (visible, governed, build-checkable):

   ```ts
   // ❌ DON'T: expect the function to update the record itself (it has no data API)
   // ✅ DO: function returns values → outputVariable → update_record persists
   { id: 'ai', type: 'script', config: {
       function: 'helpdesk.aiTriageStub',     // returns { ai_category, ai_sentiment, … }
       inputs: { ticketId: '{record.id}' },   // inputs are interpolated
       outputVariable: 'ai',
   } },
   { id: 'apply', type: 'update_record', config: {
       objectName: 'helpdesk_ticket',
       filter: { id: '{record.id}' },
       fields: { ai_category: '{ai.ai_category}', ai_sentiment: '{ai.ai_sentiment}' },
   } },
   ```

   `defineStack({ functions: { 'helpdesk.aiTriageStub': (ctx) => ({ ai_category: 'other', … }) } })`.
   If you genuinely need data-lifecycle **side effects** (read/write other records),
   that's an L2 **hook** (objectstack-data) — hooks get `ctx.api`; flow functions don't.

10. **Conditions are bare CEL — only the stdlib is callable.** `now()`,
    `today()`, `daysFromNow(n)`, `daysAgo(n)`, `daysBetween(a, b)`, `isBlank(v)`,
    `coalesce(a, b)`, `abs/round/min/max`, `upper/lower/contains/matches`, plus CEL
    built-ins (`has`, `size`, `int`, `string`, …) — see **objectstack-formula** for the full table.
    An UNKNOWN function (`PRIOR()`, a typo'd name) **fails the build**. And never
    wrap a field reference in `{…}` inside a condition — that's a template brace
    and fails as CEL: write `record.x`, not `{record.x}`.

---

## CRM Automation Blueprint

For enterprise automation design, align with this CRM-style structure:

| Automation Type | Typical Location | Pattern |
|:--|:--|:--|
| Screen flow | `src/flows/*.flow.ts` | Use explicit `variables`, node graph (`nodes` + `edges`), and decision branches |
| Approval flow | `src/flows/*.flow.ts` | A flow with `approval` node(s); set `approvers` / `behavior` / `lockRecord` / `approvalStatusField` in node `config`, branch on `approve` / `reject` edges |
| Flow registry | `src/flows/index.ts` | Export `allFlows: Flow[]` and register centrally in `defineStack({ flows })` |
| Action-to-flow bridge | `src/actions/*.actions.ts` | Trigger screen flows via `Action.type = 'flow'` for user-driven automation entry |

Default approach for metadata apps: model business lifecycle in Flow/Approval
metadata first; reserve custom code for edge-case integrations.

---

## Verify your work

Flow predicates fail **silently at runtime** when malformed: a typo'd field
name, an unknown function, or a `{…}`-wrapped reference in a condition
evaluates to `null`/`false`, so the flow "fires" but does nothing — and nothing
errors at edit time. (Bare field refs like `status == 'open'` DO resolve in
start/decision/edge conditions — the engine flattens the trigger record's
fields into scope — but `record.status == 'open'` remains the canonical style.)
Catch it at author time before reporting a flow done:

```bash
os validate     # CEL/predicate validation (record.<field> existence) + schema
# or: os build  # the same gates, plus emits dist/
```

This runs the ADR-0032 expression gate over every flow condition, edge guard,
validation rule and sharing rule, exiting non-zero with a
located, corrective message. Remember conditions are **bare CEL**
(`record.status == 'x'`); only string node fields use `{…}` templates — see
objectstack-formula. In a scaffolded project this is `npm run validate`.

---

## References

See [references/_index.md](./references/_index.md) for the full list of Zod
schemas (with one-line descriptions) — pointers into
`node_modules/@objectstack/spec/src/`. Always `Read` the source for exact field
shapes; do not rely on memory of property names.


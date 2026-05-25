// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.
//
// Snapshot-style assertions for the bundled HITL inbox view.
//
// These guard the shape that Studio relies on:
//   - drawer navigation wired to a named detail view
//   - relative-time renderers on proposed_at / decided_at
//   - JSON widget on tool_input / result
//   - status-tab list views are filtered correctly
//   - row actions point at the object's approve/reject API actions
//
// If Studio ever changes the contract (e.g. renames a widget) we update
// here in one place and the failure is loud.

import { describe, it, expect } from 'vitest';
import { AiPendingActionView } from '../views/ai-pending-action.view.js';

describe('AiPendingActionView', () => {
  it('exposes a drawer detail view named "detail" with all key sections', () => {
    expect(AiPendingActionView.formViews?.detail).toBeDefined();
    const detail = AiPendingActionView.formViews!.detail!;
    expect(detail.type).toBe('drawer');
    const sectionLabels = (detail.sections ?? []).map((s) => s.label);
    expect(sectionLabels).toEqual(
      expect.arrayContaining(['Proposal', 'Tool input', 'Conversation context', 'Decision']),
    );
  });

  it('renders tool_input with a JSON widget so operators see structured args', () => {
    const detail = AiPendingActionView.formViews!.detail!;
    const toolInputSection = detail.sections!.find((s) => s.label === 'Tool input')!;
    const toolInputField = toolInputSection.fields.find(
      (f) => typeof f !== 'string' && f.field === 'tool_input',
    );
    expect(toolInputField).toBeDefined();
    expect(typeof toolInputField === 'object' && toolInputField.widget).toBe('json');
  });

  it('renders relative timestamps on proposed_at / decided_at columns', () => {
    const cols = AiPendingActionView.list!.columns as Array<{ field: string; type?: string }>;
    const proposedAt = cols.find((c) => c.field === 'proposed_at');
    const decidedAt = cols.find((c) => c.field === 'decided_at');
    expect(proposedAt?.type).toBe('datetime-relative');
    expect(decidedAt?.type).toBe('datetime-relative');
  });

  it('opens the drawer on row click instead of navigating to a page', () => {
    expect(AiPendingActionView.list!.navigation?.mode).toBe('drawer');
    expect(AiPendingActionView.list!.navigation?.view).toBe('detail');
  });

  it('wires per-row approve/reject buttons on the pending tab', () => {
    const pending = AiPendingActionView.listViews!.pending!;
    expect(pending.rowActions).toEqual(
      expect.arrayContaining(['approve_pending_action', 'reject_pending_action']),
    );
    expect(pending.filter).toEqual([{ field: 'status', operator: '=', value: 'pending' }]);
  });

  it('filters every named status tab correctly', () => {
    const tabs = AiPendingActionView.listViews!;
    expect(tabs.pending!.filter![0].value).toBe('pending');
    expect(tabs.executed!.filter![0].value).toBe('executed');
    expect(tabs.rejected!.filter![0].value).toBe('rejected');
    expect(tabs.failed!.filter![0].value).toBe('failed');
  });

  it('every tab opens the same shared detail drawer', () => {
    const tabs = AiPendingActionView.listViews!;
    for (const tab of Object.values(tabs)) {
      expect(tab.navigation?.mode).toBe('drawer');
      expect(tab.navigation?.view).toBe('detail');
    }
  });
});

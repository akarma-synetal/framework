// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_notification — Per-User Inbox Notification
 *
 * Personal, unread-trackable notifications. Distinct from
 * `sys_activity` (per-record, append-only narrative) and
 * `sys_audit_log` (compliance-grade structured diff). Each row
 * targets exactly one user (`recipient_id`) and is the source of
 * truth for the header bell badge.
 *
 * Typical writers: comment mention, record assignment, lead-convert
 * completion, flow notifications. Typical readers: header bell,
 * notification center.
 *
 * @namespace sys
 */
export const SysNotification = ObjectSchema.create({
  name: 'sys_notification',
  label: 'Notification',
  pluralLabel: 'Notifications',
  icon: 'bell',
  isSystem: true,
  managedBy: 'system',
  description: 'Per-user notification inbox entries',
  displayNameField: 'title',
  titleFormat: '{title}',
  compactLayout: ['title', 'type', 'is_read', 'created_at'],

  /**
   * Row-level inbox actions. Use `visible` CEL expressions to ensure
   * `mark_read` only shows on unread rows and vice-versa, mirroring the
   * mark-as-read affordances in GitHub / Linear inboxes. The toolbar-level
   * `mark_all_read` is intentionally omitted server-side: it requires a
   * bulk update primitive that doesn't yet exist on the REST surface, and
   * the popover already handles the multi-row case client-side via N
   * single-row PATCHes (see `InboxPopover.tsx` -> AppHeader `markAllRead`).
   */
  actions: [
    {
      name: 'mark_read',
      label: 'Mark as Read',
      icon: 'check',
      variant: 'secondary',
      mode: 'custom',
      locations: ['list_item'],
      type: 'api',
      method: 'PATCH',
      target: '/api/v1/data/sys_notification/{id}',
      bodyExtra: { is_read: true },
      visible: '!record.is_read',
      successMessage: 'Notification marked as read',
      refreshAfter: true,
    },
    {
      name: 'mark_unread',
      label: 'Mark as Unread',
      icon: 'bell-dot',
      variant: 'secondary',
      mode: 'custom',
      locations: ['list_item'],
      type: 'api',
      method: 'PATCH',
      target: '/api/v1/data/sys_notification/{id}',
      bodyExtra: { is_read: false, read_at: null },
      visible: 'record.is_read',
      successMessage: 'Notification marked as unread',
      refreshAfter: true,
    },
  ],

  listViews: {
    unread: {
      type: 'grid',
      name: 'unread',
      label: 'Unread',
      data: { provider: 'object', object: 'sys_notification' },
      // Title + actor first (the "who/what" the user actually scans);
      // type stays as a categorising chip; created_at right-aligned.
      columns: ['title', 'actor_name', 'type', 'created_at'],
      filter: [
        { field: 'recipient_id', operator: 'equals', value: '{current_user_id}' },
        { field: 'is_read', operator: 'equals', value: false },
      ],
      sort: [{ field: 'created_at', order: 'desc' }],
      pagination: { pageSize: 50 },
      emptyState: { title: 'Inbox zero', message: 'No unread notifications.' },
    },
    mine: {
      type: 'grid',
      name: 'mine',
      label: 'Mine',
      data: { provider: 'object', object: 'sys_notification' },
      columns: ['title', 'actor_name', 'type', 'is_read', 'created_at'],
      filter: [{ field: 'recipient_id', operator: 'equals', value: '{current_user_id}' }],
      sort: [{ field: 'created_at', order: 'desc' }],
      pagination: { pageSize: 50 },
      // Group by notification category so mention/assignment storms don't
      // hide system or task_due rows. Users still toggle to flat via the
      // toolbar Group control if they prefer chronology only.
      grouping: { fields: [{ field: 'type', order: 'asc', collapsed: false }] },
    },
    all_notifications: {
      type: 'grid',
      name: 'all_notifications',
      label: 'All',
      data: { provider: 'object', object: 'sys_notification' },
      columns: ['title', 'recipient_id', 'actor_name', 'type', 'is_read', 'created_at'],
      sort: [{ field: 'created_at', order: 'desc' }],
      pagination: { pageSize: 100 },
    },
  },

  fields: {
    id: Field.text({
      label: 'Notification ID',
      required: true,
      readonly: true,
      group: 'System',
    }),

    // ── Routing ──────────────────────────────────────────────────
    recipient_id: Field.lookup('sys_user', {
      label: 'Recipient',
      required: true,
      searchable: true,
      description: 'User the notification is delivered to',
      group: 'Routing',
    }),

    // ── Content ──────────────────────────────────────────────────
    type: Field.select(
      ['mention', 'assignment', 'comment_reply', 'lead_converted', 'task_due', 'system'],
      {
        label: 'Type',
        required: true,
        defaultValue: 'system',
        description: 'Notification category — drives icon + sort priority',
        group: 'Content',
      },
    ),

    title: Field.text({
      label: 'Title',
      required: true,
      maxLength: 255,
      searchable: true,
      group: 'Content',
    }),

    body: Field.textarea({
      label: 'Body',
      required: false,
      description: 'Optional secondary text (one-line summary)',
      group: 'Content',
    }),

    // ── Source linkage ───────────────────────────────────────────
    source_object: Field.text({
      label: 'Source Object',
      required: false,
      maxLength: 100,
      description: 'Object name of the related record (e.g. lead, opportunity)',
      group: 'Source',
    }),

    source_id: Field.text({
      label: 'Source Record',
      required: false,
      maxLength: 100,
      description: 'Record id within source_object',
      group: 'Source',
    }),

    url: Field.url({
      label: 'Deep Link',
      required: false,
      description: 'Optional URL to navigate to when clicked',
      group: 'Source',
    }),

    actor_id: Field.lookup('sys_user', {
      label: 'Actor',
      required: false,
      description: 'User who caused the notification (mentioner, assigner)',
      group: 'Source',
    }),

    actor_name: Field.text({
      label: 'Actor Name',
      required: false,
      group: 'Source',
    }),

    // ── Read state ───────────────────────────────────────────────
    is_read: Field.boolean({
      label: 'Read',
      defaultValue: false,
      description: 'True once recipient acknowledges',
      group: 'State',
    }),

    read_at: Field.datetime({
      label: 'Read At',
      required: false,
      group: 'State',
    }),

    // ── Lifecycle ────────────────────────────────────────────────
    created_at: Field.datetime({
      label: 'Created At',
      required: true,
      defaultValue: 'NOW()',
      readonly: true,
      group: 'System',
    }),

    updated_at: Field.datetime({
      label: 'Updated At',
      required: false,
      group: 'System',
    }),
  },

  indexes: [
    { fields: ['recipient_id', 'is_read', 'created_at'] },
    { fields: ['recipient_id', 'created_at'] },
    { fields: ['source_object', 'source_id'] },
  ],
});

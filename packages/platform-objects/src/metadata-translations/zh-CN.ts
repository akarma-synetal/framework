// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { TranslationData } from '@objectstack/spec/system';

/**
 * Simplified Chinese (zh-CN) — Metadata-Type Form Translations
 *
 * Scope: the `metadataForms.*` namespace for the top-5 form-bearing
 * metadata types (object / field / agent / flow / view). Section keys
 * mirror the `name` set in each `*.form.ts` definition shipped from
 * `@objectstack/spec`.
 *
 * Path convention:
 *   metadataForms.<type>.{label,description}
 *   metadataForms.<type>.sections.<section.name>.{label,description}
 *   metadataForms.<type>.fields.<dot-path>.{label,helpText,placeholder}
 *
 * `dot-path` is dot-notation: top-level fields use the field name
 * directly; composite/repeater children prefix with the parent field
 * (e.g. `capabilities.trackHistory`, `fields.items.label`).
 */
export const zhCN: TranslationData = {
  metadataForms: {
    object: {
      label: '对象',
      description: '业务对象定义',
      sections: {
        basics: { label: '基础信息', description: '标识与显示信息' },
        fields: { label: '字段', description: '业务数据字段列表' },
        capabilities: { label: '功能开关', description: '系统级行为配置' },
        advanced: { label: '高级设置', description: '存储、命名空间等' },
      },
      fields: {
        name: { label: '名称', helpText: 'snake_case 唯一标识符', placeholder: '如：account' },
        label: { label: '显示名', placeholder: '如：客户' },
        pluralLabel: { label: '复数显示名', placeholder: '如：客户列表' },
        description: { label: '描述', helpText: '对象的业务用途说明' },
        namespace: { label: '命名空间' },
        'capabilities.trackHistory': { label: '记录变更历史' },
        'capabilities.searchable': { label: '可搜索' },
        'capabilities.exportable': { label: '可导出' },
        'capabilities.auditable': { label: '可审计' },
        'fields.name': { label: '字段名', placeholder: 'snake_case' },
        'fields.label': { label: '字段显示名' },
        'fields.type': { label: '字段类型' },
      },
    },

    field: {
      label: '字段',
      description: '对象字段定义',
      sections: {
        basics: { label: '基础信息' },
        configuration: { label: '配置' },
        formula: { label: '公式' },
        advanced: { label: '高级设置' },
      },
      fields: {
        name: { label: '名称', helpText: 'snake_case 唯一标识符' },
        label: { label: '显示名' },
        type: { label: '字段类型' },
        required: { label: '必填' },
        unique: { label: '唯一' },
        defaultValue: { label: '默认值' },
        description: { label: '描述' },
        formula: { label: '公式表达式' },
      },
    },

    agent: {
      label: 'AI 代理',
      description: '智能助手定义',
      sections: {
        identity: { label: '身份信息', description: '代理的名称与描述' },
        ai_configuration: { label: 'AI 配置', description: '模型与提示词' },
        capabilities: { label: '能力配置', description: '可用工具与技能' },
        access: { label: '访问控制', description: '权限与共享' },
      },
      fields: {
        name: { label: '名称' },
        label: { label: '显示名' },
        description: { label: '描述' },
        model: { label: '模型' },
        systemPrompt: { label: '系统提示词' },
        tools: { label: '工具' },
        skills: { label: '技能' },
      },
    },

    flow: {
      label: '流程',
      description: '可视化业务流程',
      sections: {
        basics: { label: '基础信息' },
        canvas: { label: '画布' },
        execution: { label: '执行配置' },
      },
      fields: {
        name: { label: '名称' },
        label: { label: '显示名' },
        description: { label: '描述' },
        trigger: { label: '触发器' },
        steps: { label: '步骤' },
      },
    },

    view: {
      label: '视图',
      description: '数据展示视图',
      sections: {
        basics: { label: '基础信息' },
        columns_filters: { label: '列与筛选' },
        table_options: { label: '表格选项' },
        kanban: { label: '看板配置' },
        calendar: { label: '日历配置' },
        gantt: { label: '甘特图配置' },
        gallery: { label: '画廊配置' },
        timeline: { label: '时间线配置' },
        chart: { label: '图表配置' },
        navigation_sharing: { label: '导航与共享' },
      },
      fields: {
        name: { label: '名称' },
        label: { label: '显示名' },
        object: { label: '所属对象' },
        type: { label: '视图类型' },
        columns: { label: '列' },
        filters: { label: '筛选条件' },
        sortBy: { label: '排序字段' },
      },
    },
  },
};

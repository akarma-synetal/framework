// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Report Definitions Barrel
 */
export { AccountsByIndustryTypeReport } from './account.report';
export {
  CasesByStatusPriorityReport,
  SlaPerformanceReport,
  CasesOpenedByDayPriorityReport,
} from './case.report';
export { ContactsByAccountReport } from './contact.report';
export { LeadsBySourceReport, LeadInflowByMonthSourceReport } from './lead.report';
export {
  OpportunitiesByStageReport,
  WonOpportunitiesByOwnerReport,
  PipelineCoverageByQuarterReport,
  OpportunityFunnelByOwnerStageReport,
} from './opportunity.report';
export { TasksByOwnerReport } from './task.report';

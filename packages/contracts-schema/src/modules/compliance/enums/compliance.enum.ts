
export enum ComplianceRecordStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  VALID = 'valid',
  EXPIRED = 'expired',
  RENEWAL_DUE = 'renewal_due',
  RENEWED = 'renewed',
  UNDER_REVIEW = 'under_review',
  REJECTED = 'rejected',
  NON_COMPLIANT = 'non_compliant',
  WAIVED = 'waived',
  CANCELLED = 'cancelled',
}

export enum ComplianceCategory {
  HSE = 'hse',
  ENVIRONMENTAL = 'environmental',
  PETROLEUM_LICENSING = 'petroleum_licensing',
  TAX_AND_ROYALTY = 'tax_and_royalty',
  LABOUR_AND_SAFETY = 'labour_and_safety',
  LOCAL_CONTENT = 'local_content',
  COMMUNITY_RELATIONS = 'community_relations',
  SECURITY_AND_PROTECTION = 'security_and_protection',
  INSURANCE_AND_INDEMNITY = 'insurance_and_indemnity',
  FINANCIAL_REPORTING = 'financial_reporting',
  ANTI_CORRUPTION = 'anti_corruption',
  DATA_AND_REPORTING = 'data_and_reporting',
}

export enum AppliesToParty {
  CONTRACTOR = 'contractor',
  SUBCONTRACTOR = 'subcontractor',
  SUPPLIER = 'supplier',
  CONSULTANT = 'consultant',
  OPERATOR = 'operator',
  JV_PARTNER = 'jv_partner',
  HOST_COMMUNITY = 'host_community',
  REGULATOR = 'regulator',
  INSURER = 'insurer',
  ALL_PARTIES = 'all_parties',
}

export enum ComplianceFrequency {
  ONCE = 'once',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  HALF_YEARLY = 'half_yearly',
  YEARLY = 'yearly',
  EVENT_BASED = 'event_based',
  CONTINUOUS = 'continuous',
}
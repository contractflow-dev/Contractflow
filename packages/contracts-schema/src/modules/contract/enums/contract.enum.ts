
export enum EPartyType {
  CLIENT = 'client',
  CONTRACTOR = 'contractor',
  SUBCONTRACTOR = 'subcontractor',
  VENDOR = 'vendor',
  OTHER = 'other',
}

export enum EContractRole{
    CONTRACTOR_PROJECT_LEAD = 'Contractor Project Lead',
    CONTRACTOR_SITE_SUPERVISOR = 'Contractor Site Supervisor',
    CLIENT_PROJECT_MANAGER = 'Client Project Manager',
    CLIENT_SITE_ENGINEER = 'Client Site Engineer',
    HSE_OFFICER = 'HSE Officer',
    HSE_MANAGER = 'HSE Manager',
    FINANCE_OFFICER = 'Finance Officer',
    FINANCE_DIRECTOR = 'Finance Director'
}
export enum EFromStatus {
    DRAFT = 'draft',
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    UNDER_REVIEW = 'under_review'
}
export enum EToStatus {
    DRAFT = 'draft',
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    UNDER_REVIEW = 'under_review'
}
export enum EContractType{
    SERVICE= 'service', 
    SUPPLY= 'supply', 
    EPC= 'epc', 
    MAINTENANCE= 'maintenance'
}
export enum EContractStatus{
    DRAFT= 'draft', 
    ACTIVE= 'active', 
    SUSPENDED= 'suspended', 
    COMPLETED= 'completed'
}


export enum PartyType {
  CLIENT = 'client',
  CONTRACTOR = 'contractor',
  SUBCONTRACTOR = 'subcontractor',
  VENDOR = 'vendor',
  OTHER = 'other',
}

export enum ContractRole{
    CONTRACTOR_PROJECT_LEAD = 'Contractor Project Lead',
    CONTRACTOR_SITE_SUPERVISOR = 'Contractor Site Supervisor',
    CLIENT_PROJECT_MANAGER = 'Client Project Manager',
    CLIENT_SITE_ENGINEER = 'Client Site Engineer',
    HSE_OFFICER = 'HSE Officer',
    HSE_MANAGER = 'HSE Manager',
    FINANCE_OFFICER = 'Finance Officer',
    FINANCE_DIRECTOR = 'Finance Director'
}
export enum FromStatus {
    DRAFT = 'draft',
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    UNDER_REVIEW = 'under_review'
}
export enum ToStatus {
    DRAFT = 'draft',
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    UNDER_REVIEW = 'under_review'
}
export enum ContractType{
    SERVICE= 'service', 
    SUPPLY= 'supply', 
    EPC= 'epc', 
    MAINTENANCE= 'maintenance'
}
export enum ContractStatus{
    DRAFT= 'draft', 
    ACTIVE= 'active', 
    SUSPENDED= 'suspended', 
    COMPLETED= 'completed'
}
export enum CurrencyType{
    NAIRA='NGN', 
    DOLLAR='USD', 
    EURO='EUR', 
    POUND='GBP'
}
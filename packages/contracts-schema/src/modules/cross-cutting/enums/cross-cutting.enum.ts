export enum EEntityType {
  CONTRACT = 'contract',
  DOCUMENT = 'document',
  COMMENT = 'comment',
  OTHER = 'other',
}
export enum ECommentVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

export enum EDocumentEntityType{
    CERTIFICATE="certificate",  
    HSE="HSE",
    CONTRACT="contract",
    INVOICE="invoice",
    REPORT="report",
    OTHER="other"
}
export enum EDocumentCategory {
    CERTIFICATE="certificate",  
    HSE="HSE",
    CONTRACT="contract",
    INVOICE="invoice",
    REPORT="report",
    OTHER="other"
}
export enum EDocumentVisibility{
    PUBLIC="public",
    PRIVATE="private"
}
export enum EDocumentStatus{
    VALID="Valid", 
    EXPIRING="Expiring", 
    EXPIRED="Expired",
    VERIFICATION_PENDING="Verification Pending", 
    VERIFIED="Verified", 
    REJECTED="Rejected",
}
export enum ENotificationChannel {
    PUSH = "push",
    SMS = "sms",
    EMAIL = "email"
}
export enum ENotificationStatus{
    SENT = "sent",
    DELIVERED = "delivered",
    PENDING = "pending",
    FAILED = "failed",
    READ = "read"
}
export enum EConversationType {
  COMMENT = 'comment',
  MESSAGE = 'message',
}
export enum EConversationWorkspace {
    Project = 'project',
    Finance = 'finance',
    HSE = 'hse',
}
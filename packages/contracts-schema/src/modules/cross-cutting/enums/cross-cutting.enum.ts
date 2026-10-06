export enum EntityType {
  CONTRACT = 'contract',
  DOCUMENT = 'document',
  COMMENT = 'comment',
  OTHER = 'other',
}
export enum CommentVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

export enum DocumentEntityType{
    CERTIFICATE="certificate",  
    HSE="HSE",
    CONTRACT="contract",
    INVOICE="invoice",
    REPORT="report",
    OTHER="other"
}
export enum DocumentCategory {
    CERTIFICATE="certificate",  
    HSE="HSE",
    CONTRACT="contract",
    INVOICE="invoice",
    REPORT="report",
    OTHER="other"
}
export enum DocumentVisibility{
    PUBLIC="public",
    PRIVATE="private"
}
export enum DocumentStatus{
    VALID="Valid", 
    EXPIRING="Expiring", 
    EXPIRED="Expired",
    VERIFICATION_PENDING="Verification Pending", 
    VERIFIED="Verified", 
    REJECTED="Rejected",
}
export enum NotificationChannel {
    PUSH = "push",
    SMS = "sms",
    EMAIL = "email"
}
export enum NotificationStatus{
    SENT = "sent",
    DELIVERED = "delivered",
    PENDING = "pending",
    FAILED = "failed",
    READ = "read"
}
export enum ConversationType {
  COMMENT = 'comment',
  MESSAGE = 'message',
}
export enum ConversationWorkspace {
    Project = 'project',
    Finance = 'finance',
    HSE = 'hse',
}
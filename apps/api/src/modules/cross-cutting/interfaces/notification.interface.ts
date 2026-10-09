import { ENotificationChannel, ENotificationStatus } from "@contractflow/contracts-schema"

export interface INotificationEntity {
    recipientUserId : string
    contractId : string
    notificationType : string
    title : string
    body : string
    entityType : string
    entityId : string
    channel : ENotificationChannel
    status : ENotificationStatus
    sentAt : Date
    readAt : Date
}
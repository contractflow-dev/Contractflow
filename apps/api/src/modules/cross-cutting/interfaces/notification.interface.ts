import { NotificationChannel, NotificationStatus } from "../entities/notification.entity"

export interface INotificationEntity {
    recipientUserId : string
    contractId : string
    notificationType : string
    title : string
    body : string
    entityType : string
    entityId : string
    channel : NotificationChannel
    status : NotificationStatus
    sentAt : Date
    readAt : Date
}
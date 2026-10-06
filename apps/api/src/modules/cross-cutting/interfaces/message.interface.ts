
export interface IMessageEntity {
    conversationId : string
    senderCompanyUserId : string
    body : string
    attachements : Record<string, any>
    sentAt : Date
    editedAt : Date
    deletedAt : Date
}
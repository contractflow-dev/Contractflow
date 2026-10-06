import { ConversationType, ConversationWorkspace } from "@contractflow/contracts-schema"

export interface IConversationEntity {
    conversationType : ConversationType
    contractId : string
    workspace : ConversationWorkspace
    title : string
    conversationCreatedAt : Date
    createdBy_id : string
}
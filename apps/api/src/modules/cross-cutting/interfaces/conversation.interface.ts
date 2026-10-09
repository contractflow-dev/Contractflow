import { EConversationType, EConversationWorkspace } from "@contractflow/contracts-schema"

export interface IConversationEntity {
    conversationType : EConversationType
    contractId : string
    workspace : EConversationWorkspace
    title : string
    conversationCreatedAt : Date
    createdBy_id : string
}
import { CommentVisibility, EntityType } from "@contractflow/contracts-schema"

export interface ICommentEntity {
    contractId : string
    authorCompanyUserId : string
    parentCommentId : string
    entityType : EntityType
    entityId : string
    body : string
    visibility : CommentVisibility
}
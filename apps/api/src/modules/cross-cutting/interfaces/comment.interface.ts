import { CommentVisibility, EntityType } from "../entities/comment.entity"

export interface ICommentEntity {
    contractId : string
    authorCompanyUserId : string
    parentCommentId : string
    entityType : EntityType
    entityId : string
    body : string
    visibility : CommentVisibility
}
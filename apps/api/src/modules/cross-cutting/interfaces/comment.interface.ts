import { ECommentVisibility, EEntityType } from "@contractflow/contracts-schema"

export interface ICommentEntity {
    contractId : string
    authorCompanyUserId : string
    parentCommentId : string
    entityType : EEntityType
    entityId : string
    body : string
    visibility : ECommentVisibility
}
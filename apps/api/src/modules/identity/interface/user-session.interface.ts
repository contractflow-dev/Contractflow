
export interface IUserSessionEntity {
    userId : string
    refreshTokenHash : string
    ipAddress : string
    userAgent : string
    expiresAt : Date
    revokedAt : Date
}
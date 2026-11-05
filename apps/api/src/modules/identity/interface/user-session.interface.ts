export interface IUserSessionEntity {
  userId: string;
  refreshTokenHash: string;
  ipAddress: string | null;
  userAgent: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

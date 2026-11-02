export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  isPlatformAdmin: boolean;
}

export interface AuthenticatedSession {
  user: AuthenticatedUser;
  sessionId: string;
}

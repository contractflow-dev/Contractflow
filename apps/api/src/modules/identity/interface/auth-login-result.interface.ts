import { AppUserResponseDto } from '../dto/app-user/responses/app-user-response.dto';

export interface AuthLoginResult {
  user: AppUserResponseDto;
  sessionToken: string;
  expiresAt: Date;
}

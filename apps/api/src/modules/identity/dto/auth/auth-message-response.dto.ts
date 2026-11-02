import type { AuthMessageResponse } from '@contractflow/contracts-schema';

export class AuthMessageResponseDto implements AuthMessageResponse {
  message: string;
}

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AuthMessageResponse,
  ChangePasswordRequest,
  IGetAppUserResponse,
  UpdateMyProfileRequest,
} from '@contractflow/contracts-schema';
import { AppUserResponseDto } from '../../dto/app-user/responses/app-user-response.dto';
import type { IUpdateAppUserProfileInput } from '../../interface/app-user.interface';
import {
  APP_USER_ACCOUNT_UNIT_OF_WORK,
  type IAppUserAccountUnitOfWork,
} from '../../interface/app-user-account-persistence.interface';
import { PasswordService } from '../auth/password.service';

export const PASSWORD_CHANGED_MESSAGE =
  'Your password has been changed. Other devices have been signed out.';

const PROFILE_FIELDS = [
  'firstName',
  'middleName',
  'lastName',
  'phoneNumber',
  'timezone',
] as const satisfies ReadonlyArray<keyof IUpdateAppUserProfileInput>;

/**
 * The signed-in user's own account (user stories "set up my profile and edit
 * it at any time" and "change my password at any point"). Every method acts
 * only on the authenticated user's id, which comes from the session, never
 * from the request.
 */
@Injectable()
export class AppUserService {
  constructor(
    @Inject(APP_USER_ACCOUNT_UNIT_OF_WORK)
    private readonly unitOfWork: IAppUserAccountUnitOfWork,
    private readonly passwords: PasswordService,
  ) {}

  /** The user's own profile, with client-appropriate fields only. */
  async getProfile(userId: string): Promise<IGetAppUserResponse> {
    return this.unitOfWork.execute(async ({ users }) => {
      const user = await users.findProfileById(userId);
      if (!user) throw userNotFound();
      return AppUserResponseDto.fromEntity(user);
    });
  }

  /**
   * Changes only the profile fields provided. Email, status and platform
   * rights are not profile fields and can't be changed here.
   */
  async updateProfile(
    userId: string,
    changes: UpdateMyProfileRequest,
  ): Promise<IGetAppUserResponse> {
    const data: IUpdateAppUserProfileInput = {};
    for (const field of PROFILE_FIELDS) {
      const value = changes[field];
      if (value !== undefined) data[field] = value;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one profile field is required.');
    }

    return this.unitOfWork.execute(async ({ users }) => {
      await users.updateProfile(userId, data);
      const user = await users.findProfileById(userId);
      if (!user) throw userNotFound();
      return AppUserResponseDto.fromEntity(user);
    });
  }

  /**
   * Checks the current password, stores the new one, and signs the user out
   * of every other session. The session making the request stays signed in.
   */
  async changePassword(
    userId: string,
    currentSessionId: string,
    request: ChangePasswordRequest,
  ): Promise<AuthMessageResponse> {
    // Hashing is slow, so it happens before the transaction takes any locks.
    const storedHash = await this.unitOfWork.execute(({ users }) =>
      users.findPasswordHash(userId),
    );
    if (!storedHash) throw userNotFound();
    // 400, not 401: the session is valid, and a 401 would sign the web app out.
    if (!(await this.passwords.verify(request.currentPassword, storedHash))) {
      throw new BadRequestException('Your current password is incorrect.');
    }
    if (await this.passwords.verify(request.newPassword, storedHash)) {
      throw new BadRequestException(
        'Choose a new password that is different from your current one.',
      );
    }
    const newHash = await this.passwords.hash(request.newPassword);

    await this.unitOfWork.execute(async ({ users, sessions }) => {
      // The row lock makes a concurrent change wait; if one finished first,
      // the password checked above is no longer the stored one.
      const lockedHash = await users.findPasswordHashForUpdate(userId);
      if (!lockedHash) throw userNotFound();
      if (lockedHash !== storedHash) {
        throw new ConflictException(
          'Your password was changed in another session. Sign in again and retry.',
        );
      }
      const now = new Date();
      await users.updatePasswordHash(userId, newHash);
      await sessions.revokeAllActiveForUserExcept(userId, currentSessionId, now);
    });

    return { message: PASSWORD_CHANGED_MESSAGE };
  }
}

function userNotFound(): NotFoundException {
  return new NotFoundException('User was not found.');
}

import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
    });
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    try {
      return await argon2.verify(encodedHash, password);
    } catch {
      return false;
    }
  }
}

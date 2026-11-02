import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
    });
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    // 1. Try new argon2 hashes (new users after this branch)
    if (encodedHash.startsWith('$argon2')) {
      try {
        return await argon2.verify(encodedHash, password);
      } catch {
        return false;
      }
    }

    // 2. Fallback to legacy scrypt hashes (all users created on main / Neon)
    try {
      const [algorithm, saltHex, keyHex] = encodedHash.split(':');
      if (algorithm !== 'scrypt' || !saltHex || !keyHex) return false;

      const salt = Buffer.from(saltHex, 'hex');
      const expectedKey = Buffer.from(keyHex, 'hex');
      if (salt.length !== 16 || expectedKey.length !== 64) return false;

      const actualKey = (await scrypt(
        password,
        salt,
        expectedKey.length,
      )) as Buffer;
      return timingSafeEqual(expectedKey, actualKey);
    } catch {
      return false;
    }
  }
}
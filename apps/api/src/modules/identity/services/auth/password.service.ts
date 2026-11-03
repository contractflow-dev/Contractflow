import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  // auth.service.ts calls verify(), but we also keep compare() for compatibility
  async verify(password: string, hash: string): Promise<boolean> {
    return this.compare(password, hash);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    if (!hash) return false;
    try {
      // New: argon2id / argon2i / argon2d
      if (hash.startsWith('$argon2')) {
        return await argon2.verify(hash, password);
      }

      // Old: scrypt $scrypt$n=...$salt$hash or $scrypt$salt$hash
      if (hash.startsWith('$scrypt$')) {
        return await this.verifyScrypt(password, hash);
      }

      // If we still encounter bcrypt hashes from very old users,
      // try bcryptjs if installed, otherwise fail safely
      if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const bcrypt = require('bcryptjs') as any;
          return await bcrypt.compare(password, hash);
        } catch {
          // bcryptjs not installed - cannot verify this legacy hash
          return false;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  private async verifyScrypt(password: string, stored: string): Promise<boolean> {
    const parts = stored.split('$').filter(Boolean);
    let n = 16384, r = 8, p = 1;
    let saltB64: string, hashB64: string;

    if (parts[1]?.includes('n=')) {
      const params = parts[1].split(',');
      n = parseInt(params.find(v => v.startsWith('n='))!.split('=')[1], 10);
      r = parseInt(params.find(v => v.startsWith('r='))!.split('=')[1], 10);
      p = parseInt(params.find(v => v.startsWith('p='))!.split('=')[1], 10);
      saltB64 = parts[2];
      hashB64 = parts[3];
    } else {
      saltB64 = parts[1];
      hashB64 = parts[2];
    }

    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');

    return new Promise((resolve, reject) => {
      crypto.scrypt(password, salt, expected.length, { N: n, r, p, maxmem: 32 * 1024 * 1024 }, (err, derived) => {
        if (err) return reject(err);
        try {
          resolve(crypto.timingSafeEqual(derived, expected));
        } catch {
          resolve(false);
        }
      });
    });
  }
}
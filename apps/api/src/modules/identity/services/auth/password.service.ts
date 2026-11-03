import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async compare(password: string, hash: string): Promise<boolean> {
    if (!hash) return false;

    try {
      // New: argon2id/argon2i
      if (hash.startsWith('$argon2')) {
        return await argon2.verify(hash, password);
      }

      // Old: bcrypt $2a$, $2b$, $2y$
      if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
        return await bcrypt.compare(password, hash);
      }

      // Old: scrypt $scrypt$n=16384,r=8,p=1$salt$hash  or $scrypt$ salt$hash
      if (hash.startsWith('$scrypt$')) {
        return await this.verifyScrypt(password, hash);
      }

      return false;
    } catch {
      return false;
    }
  }

  private async verifyScrypt(password: string, stored: string): Promise<boolean> {
    // Format: $scrypt$n=16384,r=8,p=1$<salt_b64>$<hash_b64>
    const parts = stored.split('$').filter(Boolean);
    // parts[0]=scrypt, parts[1]=n=..., parts[2]=salt, parts[3]=hash  OR
    // parts[0]=scrypt, parts[1]=salt, parts[2]=hash
    let n = 16384, r = 8, p = 1;
    let saltB64: string, hashB64: string;

    if (parts[1]?.includes('n=')) {
      const params = parts[1].split(',');
      n = parseInt(params.find(v => v.startsWith('n='))!.split('=')[1]);
      r = parseInt(params.find(v => v.startsWith('r='))!.split('=')[1]);
      p = parseInt(params.find(v => v.startsWith('p='))!.split('=')[1]);
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
        resolve(crypto.timingSafeEqual(derived, expected));
      });
    });
  }
}
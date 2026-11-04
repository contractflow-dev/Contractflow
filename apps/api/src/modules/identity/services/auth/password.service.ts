import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
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
    } catch { return false; }
  }

  private decodeMaybe(s: string): Buffer {
    s = s.trim();
    // try base64
    try { const b = Buffer.from(s, 'base64'); if (b.length > 8) return b; } catch {}
    // try base64url
    try { const b = Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'), 'base64'); if (b.length > 8) return b; } catch {}
    // try hex
    try { if (/^[0-9a-fA-F]+$/.test(s)) { const b = Buffer.from(s, 'hex'); if (b.length > 8) return b; } } catch {}
    return Buffer.from(s, 'base64');
  }

  private async verifyScrypt(password: string, stored: string): Promise<boolean> {
    // Supports:
    // $scrypt$n=16384,r=8,p=1$salt$hash
    // $scrypt$16384$8$1$salt$hash
    // $scrypt$salt$hash (defaults n=16384,r=8,p=1)
    const parts = stored.split('$').filter(Boolean); // ['scrypt', ...]
    let n = 16384, r = 8, p = 1;
    let saltStr: string, hashStr: string;

    if (parts.length === 5 && !parts[1].includes('n=')) {
      // $scrypt$16384$8$1$salt$hash
      n = parseInt(parts[1],10); r = parseInt(parts[2],10); p = parseInt(parts[3],10);
      saltStr = parts[4]; hashStr = parts[5] || parts[4]; // safety
      if (parts.length >= 6) { saltStr = parts[4]; hashStr = parts[5]; }
    } else if (parts[1]?.includes('n=')) {
      const map: any = {};
      parts[1].split(',').forEach(kv => { const [k,v]=kv.split('='); map[k]=v; });
      n = parseInt(map.n,10) || n; r = parseInt(map.r,10) || r; p = parseInt(map.p,10) || p;
      saltStr = parts[2]; hashStr = parts[3];
    } else {
      // $scrypt$salt$hash
      saltStr = parts[1]; hashStr = parts[2];
    }

    if (!saltStr || !hashStr) return false;

    const salt = this.decodeMaybe(saltStr);
    const expected = this.decodeMaybe(hashStr);
    if (salt.length < 8 || expected.length < 16) return false;

    return new Promise((resolve) => {
      crypto.scrypt(password, salt, expected.length, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, derived) => {
        if (err) { resolve(false); return; }
        try { resolve(derived.length === expected.length && crypto.timingSafeEqual(derived, expected)); }
        catch { resolve(false); }
      });
    });
  }
}
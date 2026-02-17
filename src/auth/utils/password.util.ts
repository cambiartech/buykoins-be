import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export class PasswordUtil {
  private static readonly SALT_ROUNDS = 10;

  /** Generate a random password (e.g. for TikTok-only users who never use password login). */
  static generateRandom(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash a password
   */
  static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Compare password with hash
   */
  static async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}


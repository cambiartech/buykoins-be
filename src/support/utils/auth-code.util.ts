/**
 * Utility for generating onboarding auth codes
 */
export class AuthCodeUtil {
  /**
   * Generate a 6-8 digit auth code
   */
  static generate(length: number = 6): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  /**
   * Generate expiration date (default: 15 minutes)
   */
  static getExpirationDate(minutes: number = 15): Date {
    const date = new Date();
    date.setMinutes(date.getMinutes() + minutes);
    return date;
  }

  /**
   * Check if code is expired
   */
  static isExpired(expiresAt: Date | null): boolean {
    if (!expiresAt) return true;
    return new Date() > new Date(expiresAt);
  }
}


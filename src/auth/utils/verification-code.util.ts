/**
 * Generate a 6-digit verification code
 */
export class VerificationCodeUtil {
  static generate(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  static isExpired(expiresAt: Date | string): boolean {
    const expirationDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    const now = new Date();
    const isExpired = now > expirationDate;
    
    // Debug logging
    if (isExpired) {
      const diffMs = now.getTime() - expirationDate.getTime();
      const diffMinutes = Math.round(diffMs / 60000);
      console.log(`⏰ Code expired: ${diffMinutes} minute(s) ago`);
      console.log(`   Now: ${now.toISOString()}`);
      console.log(`   Expires: ${expirationDate.toISOString()}`);
    }
    
    return isExpired;
  }

  static getExpirationDate(minutes: number = 15): Date {
    // Simply add minutes to current time - JavaScript Date handles this correctly
    // The timestamp is always UTC internally, so this is safe
    const now = new Date();
    return new Date(now.getTime() + (minutes * 60 * 1000));
  }
}


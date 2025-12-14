/**
 * Utility for generating and managing guest IDs for anonymous users
 */
export class GuestIdUtil {
  /**
   * Generate a unique guest ID
   * Format: guest_<timestamp>_<random>
   */
  static generate(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `guest_${timestamp}_${random}`;
  }

  /**
   * Validate guest ID format
   */
  static isValid(guestId: string): boolean {
    return /^guest_\d+_[a-z0-9]+$/.test(guestId);
  }

  /**
   * Extract timestamp from guest ID
   */
  static getTimestamp(guestId: string): number | null {
    const match = guestId.match(/^guest_(\d+)_/);
    return match ? parseInt(match[1], 10) : null;
  }
}


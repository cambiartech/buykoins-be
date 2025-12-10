/**
 * Generate a unique username from email
 * Format: firstname_lastname_1234 or email_prefix_1234
 */
export class UsernameGenerator {
  static generate(firstName?: string, lastName?: string, email?: string): string {
    let base = 'user';
    
    if (firstName && lastName) {
      // Use first name and last name
      base = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`;
    } else if (firstName) {
      base = firstName.toLowerCase();
    } else if (email) {
      // Extract prefix from email (before @)
      const emailPrefix = email.split('@')[0];
      base = emailPrefix.toLowerCase();
    }
    
    // Remove special characters and spaces
    base = base.replace(/[^a-z0-9_]/g, '');
    
    // Add random 4-digit suffix
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    
    return `${base}_${randomSuffix}`;
  }
}


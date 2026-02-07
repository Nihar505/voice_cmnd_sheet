// Encryption utilities for secure token storage
// Uses AES-256-GCM encryption

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Get encryption key from environment
const getEncryptionKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  return crypto.scryptSync(key, 'salt', KEY_LENGTH);
};

/**
 * Encrypts sensitive data (OAuth tokens)
 */
export function encrypt(text: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Combine iv + encrypted + tag
    return iv.toString('hex') + encrypted + tag.toString('hex');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts encrypted data
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey();

    // Extract iv, encrypted text, and tag
    const iv = Buffer.from(encryptedData.slice(0, IV_LENGTH * 2), 'hex');
    const tag = Buffer.from(encryptedData.slice(-TAG_LENGTH * 2), 'hex');
    const encrypted = encryptedData.slice(IV_LENGTH * 2, -TAG_LENGTH * 2);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Generates a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hashes a password using bcrypt-compatible method
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a password against a hash
 */
export function verifyPassword(password: string, hashedPassword: string): boolean {
  const [salt, originalHash] = hashedPassword.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

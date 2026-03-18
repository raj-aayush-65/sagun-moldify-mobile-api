/**
 * Simple Encryption Service
 *
 * Uses a shared secret key approach - simple but effective for demonstration.
 * API sends a secret key to the app, app uses it to encrypt passwords.
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RsaKeyService implements OnModuleInit {
  private readonly logger = new Logger(RsaKeyService.name);

  // Simple shared secret - in production, use a proper key management system
  private sharedSecret: string = 'sagun-moldify-secret-key-2024';

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    // Get secret from environment - REQUIRED
    const envSecret = this.configService.get<string>('ENCRYPTION_SECRET');

    if (!envSecret) {
      throw new Error('ENCRYPTION_SECRET environment variable is required');
    }

    this.sharedSecret = envSecret;
    this.logger.log('Encryption secret loaded from environment');
  }

  /**
   * Get the shared secret for the app
   * App will use this to encrypt passwords
   */
  getPublicKey(): string {
    // Return the shared secret - simple string
    return this.sharedSecret;
  }

  /**
   * Decrypt password using the shared secret
   * XOR decryption (same as encryption since XOR is symmetric)
   */
  decrypt(encryptedData: string): string {
    try {
      // The app sends: { encryptedData: "base64-xor-ciphertext", salt: "random-salt" }
      const parsed = JSON.parse(encryptedData);

      if (!parsed.encryptedData || !parsed.salt) {
        throw new Error('Invalid encrypted data format');
      }

      // Decode base64
      const encrypted = Buffer.from(parsed.encryptedData, 'base64').toString('utf8');

      // Decrypt using XOR with secret + salt
      const decrypted = this.xorDecrypt(encrypted, this.sharedSecret + parsed.salt);

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption error', error);
      throw new Error('Failed to decrypt password');
    }
  }

  /**
   * XOR-based decryption
   */
  private xorDecrypt(data: string, key: string): string {
    let result = '';
    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i);
      const keyByte = key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode ^ keyByte);
    }
    return result;
  }

  /**
   * Check if encryption is configured
   */
  isConfigured(): boolean {
    return !!this.sharedSecret;
  }
}

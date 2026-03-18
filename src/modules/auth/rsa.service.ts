/**
 * RSA Key Service - Handles RSA key pair generation and management
 *
 * Generates RSA key pair on startup:
 * - Public key: served to clients for password encryption
 * - Private key: stored securely in environment variables, used for decryption
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface RSAKeyPair {
  publicKey: string;
  privateKey: string;
}

@Injectable()
export class RsaKeyService implements OnModuleInit {
  private publicKey: string;
  private privateKey: string;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    // Try to load existing keys from environment
    this.loadOrGenerateKeys();
  }

  private loadOrGenerateKeys() {
    const envPublicKey = this.configService.get<string>('RSA_PUBLIC_KEY');
    const envPrivateKey = this.configService.get<string>('RSA_PRIVATE_KEY');

    if (envPublicKey && envPrivateKey) {
      console.log('✅ Loading RSA keys from environment');
      this.publicKey = envPublicKey;
      this.privateKey = envPrivateKey;
    } else {
      console.log('⚠️ RSA keys not found in environment. Generating new keys...');
      console.log('⚠️ IMPORTANT: Add these keys to your environment variables:');

      const keys = this.generateKeyPair();
      this.publicKey = keys.publicKey;
      this.privateKey = keys.privateKey;

      // Log the keys for configuration (in development only)
      console.log('\n--- RSA PUBLIC KEY (add to env) ---');
      console.log(this.publicKey);
      console.log('\n--- RSA PRIVATE KEY (add to env) ---');
      console.log(this.privateKey);
      console.log('\n');
    }
  }

  private generateKeyPair(): RSAKeyPair {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'pkcs1',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs1',
        format: 'pem',
      },
    });

    return { publicKey, privateKey };
  }

  /**
   * Get the public key for clients
   */
  getPublicKey(): string {
    return this.publicKey;
  }

  /**
   * Decrypt data using the private key
   */
  decrypt(encryptedData: string): string {
    try {
      const decrypted = crypto.privateDecrypt(
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        Buffer.from(encryptedData, 'base64')
      );
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('RSA decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Check if RSA keys are configured
   */
  isConfigured(): boolean {
    return !!(this.publicKey && this.privateKey);
  }
}

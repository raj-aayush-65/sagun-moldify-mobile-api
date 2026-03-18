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
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
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
   * Tries OAEP first (new keys), then falls back to PKCS1 (old keys)
   */
  decrypt(encryptedData: string): string {
    // Try OAEP first (for new SPKI/PKCS8 format keys)
    try {
      const decrypted = crypto.privateDecrypt(
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        Buffer.from(encryptedData, 'base64')
      );
      return decrypted.toString('utf8');
    } catch (oaepError) {
      // OAEP failed, try PKCS1 (for old PKCS1 format keys)
      try {
        const decrypted = crypto.privateDecrypt(
          {
            key: this.privateKey,
            padding: crypto.constants.RSA_PKCS1_PADDING,
          },
          Buffer.from(encryptedData, 'base64')
        );
        return decrypted.toString('utf8');
      } catch (pkcs1Error) {
        console.error('RSA decryption error (both OAEP and PKCS1 failed):', pkcs1Error);
        throw new Error('Failed to decrypt data - invalid key format');
      }
    }
  }

  /**
   * Check if RSA keys are configured
   */
  isConfigured(): boolean {
    return !!(this.publicKey && this.privateKey);
  }
}

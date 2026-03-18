/**
 * RSA Key Service - Handles RSA key pair generation and management
 *
 * Uses RSA for password encryption:
 * - Public key (n, e): sent to app for encryption
 * - Private key (n, d): kept on server for decryption
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface RSAPublicKeyComponents {
  n: string; // modulus as hex string
  e: string; // exponent as hex string
}

@Injectable()
export class RsaKeyService implements OnModuleInit {
  private readonly logger = new Logger(RsaKeyService.name);

  private publicKey: crypto.KeyObject;
  private privateKey: crypto.KeyObject;

  // Store key components for app export
  private publicKeyComponents: RSAPublicKeyComponents | null = null;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.loadOrGenerateKeys();
  }

  private loadOrGenerateKeys() {
    const envPublicKey = this.configService.get<string>('RSA_PUBLIC_KEY');
    const envPrivateKey = this.configService.get<string>('RSA_PRIVATE_KEY');

    // Check if keys are valid (not placeholders)
    const hasValidKeys =
      envPublicKey &&
      envPrivateKey &&
      envPublicKey.includes('-----BEGIN') &&
      !envPublicKey.includes('Paste your') &&
      envPrivateKey.includes('-----BEGIN') &&
      !envPrivateKey.includes('Paste your');

    if (hasValidKeys) {
      this.logger.log('✅ Loading RSA keys from environment');
      try {
        this.publicKey = crypto.createPublicKey(envPublicKey);
        this.privateKey = crypto.createPrivateKey(envPrivateKey);

        // Extract key components for app
        this.extractPublicKeyComponents();
      } catch (error) {
        this.logger.error('Failed to load RSA keys from environment, generating new keys', error);
        this.generateNewKeys();
      }
    } else {
      this.logger.warn('⚠️ RSA keys not found or invalid in environment. Generating new keys...');
      this.generateNewKeys();
    }
  }

  private generateNewKeys() {
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

    this.publicKey = crypto.createPublicKey(publicKey);
    this.privateKey = crypto.createPrivateKey(privateKey);

    // Extract key components for app
    this.extractPublicKeyComponents();

    this.logger.log('Generated new RSA key pair');
  }

  /**
   * Extract public key components (n, e) from the key for the app
   */
  private extractPublicKeyComponents() {
    try {
      // Export public key as DER
      const publicKeyDer = this.publicKey.export({ type: 'spki', format: 'der' });

      // Parse DER to extract n and e
      const components = this.parseRSAPublicKeyDER(publicKeyDer);
      this.publicKeyComponents = components;

      this.logger.debug('Public key components extracted', {
        nLength: components.n.length,
        e: components.e,
      });
    } catch (error) {
      this.logger.error('Failed to extract public key components', error);
      throw new Error('Failed to extract RSA public key components from your environment keys');
    }
  }

  /**
   * Parse RSA public key from DER format
   * Extracts modulus (n) and exponent (e)
   */
  private parseRSAPublicKeyDER(der: Buffer): RSAPublicKeyComponents {
    const hex = der.toString('hex');

    // Find the BITSTRING containing the RSA key
    // The structure is: SEQUENCE { algorithm, BITSTRING { SEQUENCE { n, e } } }
    let pos = 0;

    // Skip outer SEQUENCE
    if (hex.substring(pos, pos + 2) === '30') {
      const len = parseInt(hex.substring(pos + 2, pos + 4), 16);
      const actualLen = len >= 0x80 ? parseInt(hex.substring(pos + 2, pos + 4), 16) - 0x80 + 2 : 2;
      pos += 2 + (len >= 0x80 ? 2 : 0);
    }

    // Skip algorithm SEQUENCE
    if (hex.substring(pos, pos + 2) === '30') {
      const len = parseInt(hex.substring(pos + 2, pos + 4), 16);
      pos += 2 + (len >= 0x80 ? 2 : 0);
    }

    // Now at BITSTRING (tag 0x03)
    // Find the key SEQUENCE inside (tag 0x30)
    let keySeqPos = -1;
    for (let i = pos; i < hex.length - 4; i += 2) {
      if (hex.substring(i, i + 2) === '30' && hex.substring(i + 2, i + 4) !== '30') {
        // Check if it's followed by a reasonable length
        const len = parseInt(hex.substring(i + 2, i + 4), 16);
        if (len < 0x80 || i + 4 + (len - 0x80) < hex.length) {
          keySeqPos = i;
          break;
        }
      }
    }

    if (keySeqPos === -1) {
      throw new Error('Could not parse RSA public key DER structure');
    }

    pos = keySeqPos + 2;
    const keyLen = parseInt(hex.substring(pos, pos + 2), 16);
    pos += 2;

    // First INTEGER is n (modulus)
    if (hex.substring(pos, pos + 2) === '02') {
      const nLen = parseInt(hex.substring(pos + 2, pos + 4), 16);
      pos += 4;

      let nHex = hex.substring(pos, pos + nLen * 2);
      // Remove leading 00 if present (for positive numbers)
      if (nHex.startsWith('00')) {
        nHex = nHex.substring(2);
      }

      pos += nLen * 2;

      // Next INTEGER is e (exponent)
      if (hex.substring(pos, pos + 2) === '02') {
        const eLen = parseInt(hex.substring(pos + 2, pos + 4), 16);
        pos += 4;
        const eHex = hex.substring(pos, pos + eLen * 2);

        return { n: nHex, e: eHex };
      }
    }

    throw new Error('Could not parse RSA key components from DER');
  }

  /**
   * Get the public key for the app
   * Returns JSON with n and e components for encryption
   */
  getPublicKey(): string {
    // Return the public key components as JSON
    // The app will use these to encrypt passwords
    return JSON.stringify(this.publicKeyComponents);
  }

  /**
   * Decrypt data using the private key
   * Uses PKCS1 padding (compatible with most RSA implementations)
   */
  decrypt(encryptedData: string): string {
    try {
      let buffer: Buffer;

      // Try different encodings
      try {
        buffer = Buffer.from(encryptedData, 'hex');
      } catch {
        try {
          buffer = Buffer.from(encryptedData, 'base64');
        } catch {
          // Try raw string
          buffer = Buffer.from(encryptedData, 'utf8');
        }
      }

      // Decrypt using Node.js crypto
      const decrypted = crypto.privateDecrypt(
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        buffer
      );

      return decrypted.toString('utf8');
    } catch (error) {
      this.logger.error('RSA decryption error', error);
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

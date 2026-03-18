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
        this.logger.error('Failed to load RSA keys from environment', error);
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

      // Parse DER to extract n and e using proper ASN.1 parsing
      const components = this.parseRSAPublicKeyDER(publicKeyDer);
      this.publicKeyComponents = components;

      this.logger.log('Public key components extracted successfully', {
        nLength: components.n.length,
        e: components.e,
      });
    } catch (error) {
      this.logger.error('Failed to extract public key components', error);
      throw new Error('Failed to extract RSA public key components from your environment keys');
    }
  }

  /**
   * Parse RSA public key from DER format using ASN.1
   * This properly extracts modulus (n) and public exponent (e)
   */
  private parseRSAPublicKeyDER(der: Buffer): RSAPublicKeyComponents {
    // RSA SPKI structure:
    // SEQUENCE {
    //   SEQUENCE { algorithmIdentifier }
    //   BITSTRING {
    //     [0] {
    //       SEQUENCE { n INTEGER, e INTEGER }
    //     }
    //   }
    // }

    let pos = 0;

    // Read outer SEQUENCE
    if (der[pos] !== 0x30) throw new Error('Invalid DER: expected SEQUENCE');
    pos++;
    pos += this.readLength(der, pos);

    // Read algorithm SEQUENCE
    if (der[pos] !== 0x30) throw new Error('Invalid DER: expected algorithm SEQUENCE');
    pos++;
    pos += this.readLength(der, pos);

    // Skip algorithm identifier (usually OID + NULL)
    // Just skip until we hit BITSTRING (0x03)
    while (der[pos] !== 0x03 && pos < der.length) {
      pos++;
      pos += this.readLength(der, pos);
    }

    // Now should be BITSTRING
    if (der[pos] !== 0x03) throw new Error('Invalid DER: expected BITSTRING');
    pos++;
    const bitStringLen = this.readLength(der, pos);
    pos += this.readLength(der, pos);

    // Skip the "unused bits" byte (should be 0x00)
    pos++;

    // Now read the key SEQUENCE
    if (der[pos] !== 0x30) throw new Error('Invalid DER: expected key SEQUENCE');
    pos++;
    pos += this.readLength(der, pos);

    // Read n (modulus) - INTEGER tag is 0x02
    if (der[pos] !== 0x02) throw new Error('Invalid DER: expected INTEGER for n');
    pos++;
    const nLen = this.readLength(der, pos);
    pos += this.readLength(der, pos);

    // Check if n has leading 0x00 (for positive big integers)
    if (der[pos] === 0x00) {
      pos++; // skip leading zero
    }
    const nHex = der.slice(pos, pos + nLen - 1).toString('hex');
    pos += nLen - 1;

    // Read e (exponent) - INTEGER tag is 0x02
    if (der[pos] !== 0x02) throw new Error('Invalid DER: expected INTEGER for e');
    pos++;
    const eLen = this.readLength(der, pos);
    pos += this.readLength(der, pos);
    const eHex = der.slice(pos, pos + eLen).toString('hex');

    return { n: nHex, e: eHex };
  }

  /**
   * Read ASN.1 DER length
   */
  private readLength(buf: Buffer, pos: number): number {
    if (buf[pos] < 0x80) {
      return 1;
    }
    const numBytes = buf[pos] & 0x7f;
    let len = 0;
    for (let i = 0; i < numBytes; i++) {
      len = (len << 8) | buf[pos + 1 + i];
    }
    return numBytes + 1;
  }

  /**
   * Get the public key for the app
   * Returns JSON with n and e components for encryption
   */
  getPublicKey(): string {
    return JSON.stringify(this.publicKeyComponents);
  }

  /**
   * Decrypt data using the private key
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

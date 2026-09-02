import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export type EncryptedMetaToken = { ciphertext: string; iv: string; tag: string };

function encryptionKey(encodedKey: string) {
  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32) throw new Error('META_TOKEN_ENCRYPTION_KEY must be a base64 encoded 32-byte key');
  return key;
}

export function newOAuthState() {
  return randomBytes(32).toString('base64url');
}

export function hashOAuthState(state: string) {
  return createHash('sha256').update(state, 'utf8').digest('hex');
}

export function encryptMetaToken(token: string, encodedKey: string): EncryptedMetaToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(encodedKey), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptMetaToken(value: EncryptedMetaToken, encodedKey: string) {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(encodedKey), Buffer.from(value.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

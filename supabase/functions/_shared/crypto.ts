/**
 * Advanced encryption utilities using AES-256-GCM
 * Provides stronger encryption for OAuth tokens
 */

const b64ToBytes = (b64: string): Uint8Array =>
  Uint8Array.from(atob(b64), c => c.charCodeAt(0));

const bytesToB64 = (u8: Uint8Array): string => 
  btoa(String.fromCharCode(...u8));

/**
 * Get encryption key from environment variables
 * Supports OAUTH_ENC_KEY (primary) or ENCRYPTION_KEY (fallback)
 * Validates key size (16, 24, or 32 bytes for AES-128/192/256)
 */
export async function getEncryptionKey(): Promise<CryptoKey | null> {
  const raw = Deno.env.get("OAUTH_ENC_KEY") ?? Deno.env.get("ENCRYPTION_KEY") ?? "";
  if (!raw) return null;
  
  let bytes: Uint8Array;
  try { 
    bytes = b64ToBytes(raw); 
  } catch { 
    return null; 
  }
  
  // Validate key size: 16 (AES-128), 24 (AES-192), 32 (AES-256)
  if (![16, 24, 32].includes(bytes.length)) return null;
  
  return crypto.subtle.importKey("raw", bytes.slice(), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/**
 * Encrypt object as JSON using AES-GCM
 * Format: base64(iv).base64(ciphertext)
 * IV is 12 bytes (96 bits) as recommended for AES-GCM
 */
export async function encryptJson(obj: unknown): Promise<string> {
  const key = await getEncryptionKey();
  if (!key) throw new Error("ENCRYPTION_KEY_INVALID");
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(obj));
  
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  
  return `${bytesToB64(iv)}.${bytesToB64(new Uint8Array(ciphertext))}`;
}

/**
 * Decrypt AES-GCM encrypted data back to object
 * Input format: base64(iv).base64(ciphertext)
 */
export async function decryptJson(encryptedData: string): Promise<unknown> {
  const key = await getEncryptionKey();
  if (!key) throw new Error("ENCRYPTION_KEY_INVALID");
  
  const [ivB64, ctB64] = encryptedData.split('.');
  if (!ivB64 || !ctB64) throw new Error("INVALID_ENCRYPTED_FORMAT");
  
  const iv = b64ToBytes(ivB64);
  const ciphertext = b64ToBytes(ctB64);
  
  // Convert ciphertext to proper ArrayBuffer for crypto API
  const ctArrayBuffer = new ArrayBuffer(ciphertext.length);
  new Uint8Array(ctArrayBuffer).set(ciphertext);
  
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ctArrayBuffer);
  const decryptedText = new TextDecoder().decode(plaintext);
  
  return JSON.parse(decryptedText);
}

/**
 * Check if encryption key is available and valid
 */
export async function hasValidEncryptionKey(): Promise<boolean> {
  const key = await getEncryptionKey();
  return key !== null;
}
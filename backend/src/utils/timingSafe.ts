/**
 * SECURITY FIX: CWE-208 - Timing Attack Prevention
 * Timing-safe comparison utilities to prevent timing attacks
 */

import crypto from 'crypto';

/**
 * Timing-safe string comparison
 * Uses crypto.timingSafeEqual to prevent timing attacks
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  // Normalize lengths to prevent length-based timing attacks
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');

  // If lengths differ, compare against a dummy buffer of the same length
  // to maintain constant time
  if (bufferA.length !== bufferB.length) {
    // Create dummy buffer with same length as bufferA
    const dummyBuffer = Buffer.alloc(bufferA.length);
    crypto.timingSafeEqual(bufferA, dummyBuffer);
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

/**
 * Timing-safe buffer comparison
 * Direct wrapper around crypto.timingSafeEqual for buffers
 *
 * @param a - First buffer to compare
 * @param b - Second buffer to compare
 * @returns true if buffers are equal, false otherwise
 */
export function timingSafeEqualBuffer(a: Buffer, b: Buffer): boolean {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    return false;
  }

  if (a.length !== b.length) {
    // Create dummy buffer for constant-time comparison
    const dummyBuffer = Buffer.alloc(a.length);
    try {
      crypto.timingSafeEqual(a, dummyBuffer);
    } catch {
      // Ignore error, we just want constant time
    }
    return false;
  }

  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Timing-safe token validation
 * Compares tokens with constant time to prevent timing attacks
 *
 * @param providedToken - Token provided by user
 * @param expectedToken - Expected token value
 * @returns true if tokens match, false otherwise
 */
export function validateTokenTimingSafe(
  providedToken: string | undefined | null,
  expectedToken: string | undefined | null
): boolean {
  // Handle null/undefined cases in constant time
  if (!providedToken || !expectedToken) {
    // Still do a dummy comparison to maintain timing
    if (providedToken && !expectedToken) {
      timingSafeEqual(providedToken, providedToken);
    }
    return false;
  }

  return timingSafeEqual(providedToken, expectedToken);
}

/**
 * Timing-safe hash comparison for passwords/secrets
 * Compares hashed values with constant time
 *
 * @param providedHash - Hash provided by user
 * @param expectedHash - Expected hash value
 * @returns true if hashes match, false otherwise
 */
export function compareHashTimingSafe(
  providedHash: string,
  expectedHash: string
): boolean {
  if (!providedHash || !expectedHash) {
    return false;
  }

  // Convert to buffers and compare
  const bufferA = Buffer.from(providedHash, 'utf8');
  const bufferB = Buffer.from(expectedHash, 'utf8');

  return timingSafeEqualBuffer(bufferA, bufferB);
}

/**
 * Timing-safe array comparison
 * Compares arrays element by element in constant time
 *
 * @param a - First array
 * @param b - Second array
 * @returns true if arrays are equal, false otherwise
 */
export function timingSafeEqualArray<T extends string | number>(
  a: T[],
  b: T[]
): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    return false;
  }

  // Check length in constant time
  let result = a.length === b.length;

  // Compare all elements even if lengths differ (constant time)
  const maxLength = Math.max(a.length, b.length);
  for (let i = 0; i < maxLength; i++) {
    const elemA = i < a.length ? String(a[i]) : '';
    const elemB = i < b.length ? String(b[i]) : '';

    // Use timing-safe comparison for each element
    const elementsEqual = timingSafeEqual(elemA, elemB);
    result = result && elementsEqual;
  }

  return result;
}


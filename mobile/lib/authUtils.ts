// BiteSync Auth Utilities - Password Validation & Rate Limiting
// Place this in mobile/lib/authUtils.ts

interface PasswordStrengthResult {
  isValid: boolean;
  errors: string[];
  score: number; // 0-100
}

/**
 * Validate password strength
 * Requirements:
 * - Minimum 8 characters (increased from 6)
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character or strong enough without
 */
export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const errors: string[] = [];
  let score = 0;

  // Length check
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  } else {
    score += 20;
  }

  // Uppercase check
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score += 20;
  }

  // Lowercase check
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score += 20;
  }

  // Number check
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 20;
  }

  // Special character or very long (bonus)
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 20;
  } else if (password.length >= 12) {
    score += 15;
  } else {
    score += 5;
  }

  return {
    isValid: errors.length === 0,
    errors,
    score: Math.min(100, score),
  };
}

/**
 * Simple rate limiter using AsyncStorage
 * Prevents brute force attacks on auth endpoints
 */
export class RateLimiter {
  private storageKey: string;
  private maxAttempts: number;
  private windowMs: number;

  constructor(key: string = 'auth_attempts', maxAttempts: number = 5, windowMs: number = 900000) {
    this.storageKey = key;
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs; // 15 minutes default
  }

  async isAllowed(): Promise<boolean> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const data = await AsyncStorage.getItem(this.storageKey);
      const attempts = data ? JSON.parse(data) : { count: 0, resetTime: Date.now() };

      const now = Date.now();
      const isExpired = now - attempts.resetTime > this.windowMs;

      if (isExpired) {
        // Reset window
        await AsyncStorage.setItem(this.storageKey, JSON.stringify({ count: 1, resetTime: now }));
        return true;
      }

      if (attempts.count >= this.maxAttempts) {
        return false;
      }

      // Increment counter
      attempts.count += 1;
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(attempts));
      return true;
    } catch (error) {
      console.error('RateLimiter error:', error);
      return true; // Fail open, don't block if storage fails
    }
  }

  async getRemainingAttempts(): Promise<number> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const data = await AsyncStorage.getItem(this.storageKey);
      const attempts = data ? JSON.parse(data) : { count: 0 };
      return Math.max(0, this.maxAttempts - attempts.count);
    } catch {
      return this.maxAttempts;
    }
  }

  async reset(): Promise<void> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('RateLimiter reset error:', error);
    }
  }
}

/**
 * Email validation - RFC 5322 simplified
 */
export function validateEmail(email: string): { isValid: boolean; error?: string } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Invalid email format' };
  }
  if (email.length > 254) {
    return { isValid: false, error: 'Email is too long' };
  }
  return { isValid: true };
}

/**
 * Username validation
 */
export function validateUsername(username: string): { isValid: boolean; error?: string } {
  if (username.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters' };
  }
  if (username.length > 30) {
    return { isValid: false, error: 'Username must be at most 30 characters' };
  }
  if (!/[a-zA-Z]/.test(username)) {
    return { isValid: false, error: 'Username must contain at least one letter' };
  }
  if (/^[0-9]+$/.test(username)) {
    return { isValid: false, error: 'Username cannot be only numbers' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, hyphens, and underscores' };
  }
  return { isValid: true };
}

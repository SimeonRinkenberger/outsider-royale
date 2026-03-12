import { z } from 'zod';

/**
 * Shared password validation schema.
 * Used across Auth, AccountSettings, and Stats to enforce consistent requirements.
 */
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain a special character');

export const getPasswordRequirements = (password: string) => ({
  minLength: password.length >= 8,
  hasLowercase: /[a-z]/.test(password),
  hasUppercase: /[A-Z]/.test(password),
  hasNumber: /[0-9]/.test(password),
  hasSpecial: /[^a-zA-Z0-9]/.test(password),
});

export const PASSWORD_REQUIREMENT_LABELS = [
  { key: 'minLength' as const, label: 'At least 8 characters' },
  { key: 'hasLowercase' as const, label: 'Lowercase letter' },
  { key: 'hasUppercase' as const, label: 'Uppercase letter' },
  { key: 'hasNumber' as const, label: 'Number' },
  { key: 'hasSpecial' as const, label: 'Special character (!@#$...)' },
] as const;

/**
 * Sanitize user-provided text input for display.
 * Strips control characters and trims whitespace.
 */
export function sanitizeTextInput(input: string, maxLength = 100): string {
  // Strip control characters except common whitespace
  const cleaned = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return cleaned.trim().slice(0, maxLength);
}

/**
 * Validate display name format.
 */
export function isValidDisplayName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 50;
}

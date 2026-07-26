/**
 * Password strength rules, in ONE place so every flow that sets a password
 * (register, reset_password, update_password) enforces the same policy.
 *
 * A password must:
 *   - be at least 8 characters long
 *   - contain at least 1 uppercase letter
 *   - contain at least 1 number
 *   - contain at least 1 special character
 */
export interface PasswordStrengthResult {
  valid: boolean;
  /** Human-readable clauses for each unmet rule, e.g. "contain at least 1 number". */
  errors: string[];
}

interface PasswordRule {
  test: (password: string) => boolean;
  message: string;
}

const PASSWORD_RULES: PasswordRule[] = [
  {
    test: (password) => password.length >= 8,
    message: 'be at least 8 characters long',
  },
  {
    test: (password) => /[A-Z]/.test(password),
    message: 'contain at least 1 uppercase letter',
  },
  {
    test: (password) => /[0-9]/.test(password),
    message: 'contain at least 1 number',
  },
  {
    test: (password) => /[^A-Za-z0-9]/.test(password),
    message: 'contain at least 1 special character',
  },
];

/**
 * Validate a password against the strength policy. Reusable anywhere a password
 * is supplied. Returns which rules (if any) failed.
 */
export function validatePasswordStrength(
  password: string,
): PasswordStrengthResult {
  const value = typeof password === 'string' ? password : '';
  const errors = PASSWORD_RULES.filter((rule) => !rule.test(value)).map(
    (rule) => rule.message,
  );

  return { valid: errors.length === 0, errors };
}

/** Build a single "Password must ..." message from failed-rule clauses. */
export function buildPasswordStrengthMessage(errors: string[]): string {
  return `Password must ${errors.join(', ')}.`;
}

/**
 * Severity of an audit event. Drives triage + dashboard highlighting:
 *   - NORMAL: routine activity (a profile edit, a login).
 *   - MEDIUM: privileged or money-adjacent actions worth reviewing (KYC
 *     decisions, a user suspension).
 *   - HIGH: security- or integrity-critical events (reconciliation
 *     discrepancy, manual ledger adjustment, repeated auth failures).
 */
export enum AuditLevel {
  NORMAL = 'normal',
  MEDIUM = 'medium',
  HIGH = 'high',
}

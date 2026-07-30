/**
 * The module/domain an audit event belongs to — the "slug" used to filter the
 * audit trail per surface. Extend this as new domains start emitting logs.
 */
export enum AuditCategory {
  USER = 'user',
  ADMIN = 'admin',
  TRANSACTION = 'transaction',
  KYC = 'kyc',
  AUTH = 'auth',
  WALLET = 'wallet',
  SYSTEM = 'system',
}

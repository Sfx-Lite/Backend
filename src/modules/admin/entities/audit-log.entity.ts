/**
 * The AuditLog entity now lives in the dedicated audit module. This re-export
 * preserves the old import path for any existing references.
 *
 * @see modules/audit/entities/audit-log.entity.ts
 */
export { AuditLog } from '../../audit/entities/audit-log.entity';

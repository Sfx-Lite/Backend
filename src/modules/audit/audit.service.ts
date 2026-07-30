import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  EntityManager,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';

import { AuditLog } from './entities/audit-log.entity';
import { AuditCategory } from './enums/audit-category.enum';
import { AuditLevel } from './enums/audit-level.enum';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs.query.dto';

/**
 * The input every call site passes to `saveLog`. `level` defaults to NORMAL;
 * everything except `action` + `category` is optional so a one-liner is enough
 * at the call site.
 */
export interface SaveLogInput {
  /** Stable verb for the event, e.g. "user.suspended". */
  action: string;
  /** Owning domain / filter slug. */
  category: AuditCategory;
  /** Severity; defaults to NORMAL. */
  level?: AuditLevel;
  /** Who did it — admin, user, or null/omitted for system jobs. */
  actorId?: string | null;
  /** The kind of record acted on, e.g. "user", "kyc_submission". */
  entity?: string | null;
  entityId?: string | null;
  /** Any JSON context — before/after, reason, amounts. */
  metadata?: Record<string, unknown> | null;
}

/** A page of audit rows plus the total, for the admin trail. */
export interface PagedAuditLogs {
  items: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * AuditService — the single write path for the audit trail plus the read side
 * the admin dashboard consumes. Every module records privileged or noteworthy
 * activity here via `saveLog`.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly logs: Repository<AuditLog>,
  ) {}

  /**
   * Record one audit event. THE reusable helper — call it from any endpoint.
   *
   * Pass a `manager` to enlist the write in the caller's DB transaction, so the
   * log and the action it describes commit or roll back together (the right
   * choice for money/KYC decisions that must be atomic with their audit row).
   *
   * Called WITHOUT a manager it is best-effort: a logging failure is swallowed
   * and logged, never allowed to break the user-facing request. In that case it
   * resolves to null.
   */
  async saveLog(
    input: SaveLogInput,
    manager?: EntityManager,
  ): Promise<AuditLog | null> {
    const repo = manager ? manager.getRepository(AuditLog) : this.logs;

    const row = repo.create({
      action: input.action,
      category: input.category,
      level: input.level ?? AuditLevel.NORMAL,
      actorId: input.actorId ?? null,
      entity: input.entity ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? null,
    });

    if (manager) {
      // Enlisted in the caller's transaction — let failures propagate so the
      // whole action rolls back with its missing audit row.
      return repo.save(row);
    }

    try {
      return await repo.save(row);
    } catch (error) {
      this.logger.error(
        `Failed to write audit log "${input.action}"`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  /** GET /audit-logs — filterable, paginated trail, newest first. */
  async list(query: ListAuditLogsQueryDto): Promise<PagedAuditLogs> {
    const { limit, offset, category, level, actorId, entity, from, to } = query;

    const where: FindOptionsWhere<AuditLog> = {};
    if (category !== undefined) where.category = category;
    if (level !== undefined) where.level = level;
    if (actorId !== undefined) where.actorId = actorId;
    if (entity !== undefined) where.entity = entity;

    if (from && to) {
      where.createdAt = Between(new Date(from), new Date(to));
    } else if (from) {
      where.createdAt = MoreThanOrEqual(new Date(from));
    } else if (to) {
      where.createdAt = LessThanOrEqual(new Date(to));
    }

    const [items, total] = await this.logs.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { items, total, limit, offset };
  }

  /** GET /audit-logs/:id — a single audit entry. */
  async findById(id: string): Promise<AuditLog> {
    const log = await this.logs.findOne({ where: { id } });
    if (!log) {
      throw new NotFoundException('Audit log not found');
    }
    return log;
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { sendResponse } from '../../common/utils/response.util';
import { UsersService } from '../users/users.service';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { Beneficiary } from './entities/beneficiary.entity';
import { BeneficiaryType } from './enums/beneficiary-type.enum';

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

/**
 * BeneficiariesService — Squad C (Payments). A user's saved payees, so the send
 * screen can offer a pick-list instead of retyping a username/address each time.
 *
 * INTERNAL beneficiaries are validated against the users table on save and, on
 * read, enriched with the payee's current username + profileImage (so the FE can
 * render an avatar and tap-to-fill the recipient). EXTERNAL beneficiaries are
 * wallet addresses.
 */
@Injectable()
export class BeneficiariesService {
  constructor(
    @InjectRepository(Beneficiary)
    private readonly beneficiaries: Repository<Beneficiary>,
    private readonly users: UsersService,
  ) {}

  /** POST /beneficiaries — save a payee for the caller. */
  async create(userId: string, dto: CreateBeneficiaryDto) {
    const identifier = dto.identifier.trim();
    let name = dto.name?.trim() || identifier;

    if (dto.type === BeneficiaryType.INTERNAL) {
      const payee = await this.users.findByUsername(identifier);
      if (!payee) {
        throw new NotFoundException(
          `No user found with username "${identifier}"`,
        );
      }
      if (payee.id === userId) {
        throw new BadRequestException(
          'You cannot save yourself as a beneficiary',
        );
      }
      // Prefer the canonical username casing and a sensible default label.
      name = dto.name?.trim() || payee.username;
    } else {
      if (!EVM_ADDRESS.test(identifier)) {
        throw new BadRequestException(
          'External beneficiary identifier must be a valid 0x wallet address',
        );
      }
    }

    // One saved entry per (user, identifier) — the entity has a unique index.
    const existing = await this.beneficiaries.findOne({
      where: { userId, identifier },
    });
    if (existing) {
      throw new ConflictException('This beneficiary is already saved');
    }

    const saved = await this.beneficiaries.save(
      this.beneficiaries.create({ userId, name, type: dto.type, identifier }),
    );

    const [view] = await this.toViews([saved]);
    return sendResponse(view, 'Beneficiary saved successfully');
  }

  /**
   * GET /beneficiaries — the caller's saved payees, newest first. Internal
   * beneficiaries include the payee's current username + profileImage so the FE
   * can show an avatar and tap one to fill the recipient.
   */
  async list(userId: string) {
    const rows = await this.beneficiaries.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const views = await this.toViews(rows);
    return sendResponse(views, 'Beneficiaries retrieved successfully');
  }

  /** DELETE /beneficiaries/:id — remove one of the caller's saved payees. */
  async remove(userId: string, id: string) {
    const result = await this.beneficiaries.delete({ id, userId });
    if (!result.affected) {
      throw new NotFoundException('Beneficiary not found');
    }
    return sendResponse(null, 'Beneficiary removed successfully');
  }

  /** Shape rows into API views, batch-resolving internal payees' avatars. */
  private async toViews(rows: Beneficiary[]) {
    const usernames = rows
      .filter((b) => b.type === BeneficiaryType.INTERNAL)
      .map((b) => b.identifier);
    const profiles = await this.users.findPublicProfilesByUsernames(usernames);

    return rows.map((b) => {
      const isInternal = b.type === BeneficiaryType.INTERNAL;
      const profile = isInternal ? profiles.get(b.identifier) : undefined;
      return {
        id: b.id,
        name: b.name,
        type: b.type,
        identifier: b.identifier,
        // For internal payees expose the username + avatar for the send screen.
        username: isInternal ? b.identifier : null,
        profileImage: profile?.profileImage ?? null,
        createdAt: b.createdAt,
      };
    });
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BeneficiariesService } from './beneficiaries.service';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';

/** A representative saved internal beneficiary, for Swagger examples. */
const EXAMPLE_BENEFICIARY = {
  id: 'c1d2e3f4-a5b6-7890-cdef-1234567890ab',
  name: 'Bob (rent)',
  type: 'internal',
  identifier: 'bob',
  username: 'bob',
  profileImage: 'https://cdn.example.com/avatars/bob.jpg',
  createdAt: '2026-07-24T12:30:00.000Z',
};

/**
 * BeneficiariesController — Squad C. A user's saved payees. The caller is read
 * from the JWT (`sub`); a user only ever sees and edits their own beneficiaries.
 */
@ApiTags('beneficiaries')
@ApiBearerAuth()
@Controller('beneficiaries')
export class BeneficiariesController {
  constructor(private readonly beneficiaries: BeneficiariesService) {}

  // POST /api/v1/beneficiaries
  @Post()
  @ApiOperation({
    summary: 'Save a beneficiary',
    description:
      'Save another SFx user (internal, by username) or a wallet address ' +
      '(external). Internal usernames are validated to exist; you cannot save ' +
      'yourself, and each payee can only be saved once.',
  })
  @ApiBody({ type: CreateBeneficiaryDto })
  @ApiCreatedResponse({
    description: 'Beneficiary saved.',
    schema: {
      example: {
        status: true,
        message: 'Beneficiary saved successfully',
        data: EXAMPLE_BENEFICIARY,
      },
    },
  })
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateBeneficiaryDto,
  ) {
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.beneficiaries.create(userId, dto);
  }

  // GET /api/v1/beneficiaries
  @Get()
  @ApiOperation({
    summary: 'List the caller’s saved beneficiaries',
    description:
      'Returns saved payees newest-first. Internal beneficiaries include the ' +
      'payee’s current `username` and `profileImage`, so the send screen can ' +
      'show an avatar and tap one to fill the recipient.',
  })
  @ApiOkResponse({
    description: 'Saved beneficiaries.',
    schema: {
      example: {
        status: true,
        message: 'Beneficiaries retrieved successfully',
        data: [EXAMPLE_BENEFICIARY],
      },
    },
  })
  async list(@CurrentUser('sub') userId: string) {
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.beneficiaries.list(userId);
  }

  // DELETE /api/v1/beneficiaries/:id
  @Delete(':id')
  @ApiOperation({ summary: 'Remove a saved beneficiary' })
  @ApiParam({ name: 'id', description: 'The beneficiary’s UUID.', format: 'uuid' })
  @ApiOkResponse({
    description: 'Beneficiary removed.',
    schema: {
      example: {
        status: true,
        message: 'Beneficiary removed successfully',
        data: null,
      },
    },
  })
  @ApiNotFoundResponse({ description: 'No such beneficiary for this user.' })
  async remove(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.beneficiaries.remove(userId, id);
  }
}

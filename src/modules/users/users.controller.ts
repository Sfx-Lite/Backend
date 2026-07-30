import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { UpdateKycStatusDto } from './dto/update-kyc-status.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserRole } from './enums/user-role.enum';
import { UsersService } from './users.service';

/** The profile payload the profile page consumes, for Swagger examples. */
const EXAMPLE_PROFILE = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  username: 'johndoe',
  email: 'john@example.com',
  mobileNumber: '+2348012345678',
  firstName: 'John',
  middleName: null,
  lastName: 'Doe',
  profileImage: 'https://cdn.example.com/avatars/johndoe.jpg',
  streetAddress1: '12 Marina Road',
  streetAddress2: null,
  city: 'Lagos',
  state: 'Lagos',
  country: 'NG',
  tier: 1,
  role: 'user',
  kycStatus: 'unverified',
  isPin: false,
};

/** The richer payload admin endpoints return, for Swagger examples. */
const EXAMPLE_ADMIN_USER = {
  ...EXAMPLE_PROFILE,
  suspended: false,
  suspendedAt: null,
  createdAt: '2026-07-01T09:00:00.000Z',
  updatedAt: '2026-07-15T12:30:00.000Z',
};

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get the authenticated user’s profile',
    description:
      'Returns the current user’s profile for the profile page, including ' +
      'their account `tier` (1, 2 or 3; default 1). Requires a valid access ' +
      'token. The response includes the user’s current `kycStatus` ' +
      '(unverified / pending / verified / rejected).',
  })
  @ApiOkResponse({
    description: 'Profile retrieved successfully.',
    schema: {
      example: {
        status: true,
        message: 'Profile retrieved successfully',
        data: EXAMPLE_PROFILE,
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  getProfile(@CurrentUser('sub') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('profile')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update the authenticated user’s profile',
    description:
      'Updates the editable profile fields (first/middle/last name, address, ' +
      'city, state, country, and mobileNumber). mobileNumber must be a valid ' +
      'E.164 number and unique across users. username and email are not ' +
      'editable — they are not accepted by this endpoint. Requires a valid ' +
      'access token.',
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiOkResponse({
    description: 'Profile updated successfully.',
    schema: {
      example: {
        status: true,
        message: 'Profile updated successfully',
        data: { ...EXAMPLE_PROFILE, city: 'Abuja', state: 'FCT' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Patch('update_password')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update the authenticated user’s password',
    description:
      'Verifies the supplied oldPassword against the stored password before ' +
      'setting newPassword. Requires a valid access token.',
  })
  @ApiBody({ type: UpdatePasswordDto })
  @ApiOkResponse({
    description: 'Password updated successfully.',
    schema: {
      example: {
        status: true,
        message: 'Password updated successfully',
        data: null,
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing/invalid access token, or incorrect current password.',
  })
  updatePassword(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdatePasswordDto,
  ) {
    return this.usersService.updatePassword(userId, dto);
  }

  @Get('search/:username')
  @Public()
  @ApiOperation({
    summary: 'Check whether a username is available',
    description:
      'Public endpoint for live "username available / taken" feedback on the ' +
      'signup form, and for resolving a recipient on the send screen. Returns ' +
      'the queried username, an `available` boolean, and — when the username ' +
      'is taken — the owner’s `profileImage` (null if they have none).',
  })
  @ApiParam({
    name: 'username',
    required: true,
    example: 'johndoe',
    description: 'The username to check for availability.',
  })
  @ApiOkResponse({
    description:
      'Availability result — { status, message, data: { username, available, profileImage } }.',
    schema: {
      example: {
        status: true,
        message: 'Username is already taken',
        data: {
          username: 'johndoe',
          available: false,
          profileImage: 'https://cdn.example.com/avatars/johndoe.jpg',
        },
      },
    },
  })
  checkUsername(@Param('username') username: string) {
    return this.usersService.checkUsername(username);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List all users (admin)',
    description:
      'Admin-only. Returns a paginated, filterable list of users. Supports ' +
      'limit/offset paging, free-text search over username and email, and ' +
      'filtering by role, kycStatus and suspension state.',
  })
  @ApiOkResponse({
    description: 'Users retrieved successfully.',
    schema: {
      example: {
        status: true,
        message: 'Users retrieved successfully',
        data: {
          users: [EXAMPLE_ADMIN_USER],
          total: 1,
          limit: 20,
          offset: 0,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Caller is not an admin.' })
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.usersService.listUsers(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get a specific user by id (admin)',
    description: 'Admin-only. Returns full detail for a single user.',
  })
  @ApiParam({ name: 'id', description: 'The user’s UUID.', format: 'uuid' })
  @ApiOkResponse({
    description: 'User retrieved successfully.',
    schema: {
      example: {
        status: true,
        message: 'User retrieved successfully',
        data: EXAMPLE_ADMIN_USER,
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Caller is not an admin.' })
  @ApiNotFoundResponse({ description: 'No user with that id.' })
  getUserById(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getUserById(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Toggle a user’s suspension status (admin)',
    description:
      'Admin-only. Flips the account’s suspension state — suspends an active ' +
      'user (stamps suspendedAt) and unsuspends a suspended one (clears it). ' +
      'The response’s `suspended` flag reflects the new state.',
  })
  @ApiParam({ name: 'id', description: 'The user’s UUID.', format: 'uuid' })
  @ApiOkResponse({
    description: 'User status toggled successfully.',
    schema: {
      example: {
        status: true,
        message: 'User suspended successfully',
        data: { ...EXAMPLE_ADMIN_USER, suspended: true },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Caller is not an admin.' })
  @ApiNotFoundResponse({ description: 'No user with that id.' })
  toggleUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.usersService.toggleUserStatus(id, adminId);
  }

  @Patch(':id/kyc-status')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a user’s KYC status (admin)',
    description:
      'Admin-only. Overrides the user’s kycStatus (unverified / pending / ' +
      'verified / rejected).',
  })
  @ApiParam({ name: 'id', description: 'The user’s UUID.', format: 'uuid' })
  @ApiBody({ type: UpdateKycStatusDto })
  @ApiOkResponse({
    description: 'KYC status updated successfully.',
    schema: {
      example: {
        status: true,
        message: 'KYC status updated successfully',
        data: { ...EXAMPLE_ADMIN_USER, kycStatus: 'verified' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Caller is not an admin.' })
  @ApiNotFoundResponse({ description: 'No user with that id.' })
  updateKycStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKycStatusDto,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.usersService.updateKycStatus(id, dto, adminId);
  }
}

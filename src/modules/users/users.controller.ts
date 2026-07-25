import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

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
      'token.',
  })
  @ApiOkResponse({ description: 'Profile retrieved successfully.' })
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
  @ApiOkResponse({ description: 'Profile updated successfully.' })
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
  @ApiOkResponse({ description: 'Password updated successfully.' })
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
      'signup form. Returns the queried username and an `available` boolean.',
  })
  @ApiParam({
    name: 'username',
    required: true,
    example: 'johndoe',
    description: 'The username to check for availability.',
  })
  @ApiOkResponse({
    description:
      'Availability result — { status, message, data: { username, available } }.',
    schema: {
      example: {
        status: true,
        message: 'Username is available',
        data: { username: 'johndoe', available: true },
      },
    },
  })
  checkUsername(@Param('username') username: string) {
    return this.usersService.checkUsername(username);
  }
}

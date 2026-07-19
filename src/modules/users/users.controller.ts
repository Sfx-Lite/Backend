import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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

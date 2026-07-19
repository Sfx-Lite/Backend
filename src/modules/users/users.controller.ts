import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('search/:username')
  @Public()
  @ApiOperation({ summary: 'Check whether a username is available' })
  checkUsername(@Param('username') username: string) {
    return this.usersService.checkUsername(username);
  }
}

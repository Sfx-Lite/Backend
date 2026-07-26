import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { type StringValue } from 'ms';

import { env } from '../../config/env';
import { EmailModule } from '../email/email.module';
import { User } from '../users/entities/user.entity';
import { WalletsModule } from '../wallets/wallets.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    WalletsModule,
    EmailModule,
    JwtModule.register({
      secret: env.jwt.accessSecret,
      signOptions: {
        expiresIn: env.jwt.accessExpiresIn as StringValue,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}

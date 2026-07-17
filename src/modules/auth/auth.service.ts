import {
  ConflictException,
  Injectable,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleProfile } from './interfaces/google-profile.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) { }

  register(dto: RegisterDto) {
    void dto;
    throw new NotImplementedException(
      'AuthService.register — Squad A to implement',
    );
  }

  login(dto: LoginDto) {
    void dto;
    throw new NotImplementedException(
      'AuthService.login — Squad A to implement',
    );
  }

  refresh(refreshToken: string) {
    void refreshToken;
    throw new NotImplementedException(
      'AuthService.refresh — Squad A to implement',
    );
  }

  async googleLogin(profile: GoogleProfile) {
    if (!profile.email || !profile.googleId) {
      throw new UnauthorizedException(
        'Google account did not provide the required profile information',
      );
    }

    const normalizedEmail = profile.email.trim().toLowerCase();

    // Existing account already linked with this Google account.
    const userByGoogleId = await this.usersRepository.findOne({
      where: { googleId: profile.googleId },
    });

    if (userByGoogleId) {
      return userByGoogleId;
    }

    // BE-13: link Google to an existing email/password account.
    const userByEmail = await this.usersRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (userByEmail) {
      if (
        userByEmail.googleId &&
        userByEmail.googleId !== profile.googleId
      ) {
        throw new ConflictException(
          'This email is already linked to another Google account',
        );
      }

      userByEmail.googleId = profile.googleId;

      if (!userByEmail.firstName && profile.firstName) {
        userByEmail.firstName = profile.firstName;
      }

      if (!userByEmail.lastName && profile.lastName) {
        userByEmail.lastName = profile.lastName;
      }

      return this.usersRepository.save(userByEmail);
    }

    // BE-12: create a new Google-only account.
    const username = await this.generateUniqueUsername(
      normalizedEmail,
      profile.firstName,
    );

    const newUser = this.usersRepository.create({
      username,
      email: normalizedEmail,
      googleId: profile.googleId,
      passwordHash: null,
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
    });

    return this.usersRepository.save(newUser);
  }

  private async generateUniqueUsername(
    email: string,
    firstName?: string,
  ): Promise<string> {
    const emailName = email.split('@')[0];

    const baseUsername = (firstName || emailName || 'user')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 40);

    const safeBase = baseUsername || 'user';

    const existingUser = await this.usersRepository.findOne({
      where: { username: safeBase },
    });

    if (!existingUser) {
      return safeBase;
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const suffix = Math.floor(100000 + Math.random() * 900000).toString();

      const candidate = `${safeBase.slice(0, 43)}_${suffix}`;

      const duplicate = await this.usersRepository.findOne({
        where: { username: candidate },
      });

      if (!duplicate) {
        return candidate;
      }
    }

    throw new ConflictException('Could not generate a unique username');
  }
}

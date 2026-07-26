import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

import { validatePasswordStrength } from '../utils/password.util';

/**
 * Reusable class-validator decorator enforcing the shared password policy
 * (see validatePasswordStrength). Use on any DTO password field:
 *
 *   @IsStrongPassword()
 *   password!: string;
 *
 * The failure message names exactly which rules were not met.
 */
export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return (
            typeof value === 'string' && validatePasswordStrength(value).valid
          );
        },
        defaultMessage(args: ValidationArguments): string {
          const errors =
            typeof args.value === 'string'
              ? validatePasswordStrength(args.value).errors
              : ['be a valid string'];

          return `Password must ${errors.join(', ')}.`;
        },
      },
    });
  };
}

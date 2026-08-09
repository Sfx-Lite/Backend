/**
 * @deprecated PIN-based login 2FA was replaced by email-OTP 2FA.
 * Use {@link VerifyLoginOtpDto} from './verify-login-otp.dto' instead. This
 * alias is kept only for backward compatibility and can be removed once no
 * callers reference it.
 */
export {
  VerifyLoginOtpDto,
  VerifyLoginOtpDto as VerifyPin2faDto,
} from './verify-login-otp.dto';

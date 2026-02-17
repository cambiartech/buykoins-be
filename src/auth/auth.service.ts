import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { User, UserStatus, OnboardingStatus, WalletStatus } from '../users/entities/user.entity';
import { Admin, AdminRole, AdminStatus } from '../admins/entities/admin.entity';
import { EmailService } from '../email/email.service';
import { PasswordUtil } from './utils/password.util';
import { VerificationCodeUtil } from './utils/verification-code.util';
import { UsernameGenerator } from './utils/username-generator.util';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user?: any;
  admin?: any;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject('SEQUELIZE') private sequelize: Sequelize,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  /**
   * User Signup
   */
  async signup(signupDto: SignupDto) {
    const { email, password, phone, firstName, lastName } = signupDto;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await PasswordUtil.hash(password);

    // Generate verification code
    const verificationCode = VerificationCodeUtil.generate();
    const verificationCodeExpiresAt = VerificationCodeUtil.getExpirationDate(15);

    // Generate username (use firstName/lastName if provided, otherwise use email)
    const username = UsernameGenerator.generate(firstName, lastName, email);

    // Create user - use setDataValue for field-mapped properties after creation
    const userData: any = {
      email,
      password: hashedPassword,
      username,
      balance: 0,
    };
    
    if (phone) {
      userData.phone = phone;
    }
    
    if (firstName) {
      userData.firstName = firstName;
    }
    
    if (lastName) {
      userData.lastName = lastName;
    }
    
    const user = await User.create(userData);
    
    // Use raw SQL to set timezone-sensitive fields to avoid conversion issues
    const sequelize = (User as any).sequelize || (user as any).sequelize;
    const expiresAtUTC = verificationCodeExpiresAt.toISOString();
    
    await sequelize.query(
      `UPDATE users 
       SET email_verified = false,
           verification_code = :code,
           verification_code_expires_at = :expiresAt::timestamp with time zone,
           onboarding_status = 'pending',
           status = 'active',
           wallet_status = 'active',
           joined_at = NOW()
       WHERE id = :userId`,
      {
        replacements: {
          code: verificationCode,
          expiresAt: expiresAtUTC,
          userId: user.id,
        },
        type: QueryTypes.UPDATE,
      }
    );
    
    // Reload to get the saved values
    await user.reload();

    // Send verification email (OTP) only. Welcome email is sent after OTP is verified (see verifyEmail).
    try {
      await this.emailService.sendVerificationCode(email, verificationCode);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      console.log('\n📧 VERIFICATION CODE (dev):', verificationCode);
    }

    return {
      userId: user.id,
      email: user.email,
      username: user.username,
      verificationCodeSent: true,
      verificationExpiresAt: verificationCodeExpiresAt,
    };
  }

  /**
   * Verify Email
   */
  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const { email, verificationCode } = verifyEmailDto;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Get verification code - query directly from database
    // Now that column is TIMESTAMP WITH TIME ZONE, it handles timezones correctly
    const sequelize = (user as any).sequelize;
    const result = await sequelize.query(
      `SELECT 
         verification_code, 
         verification_code_expires_at
       FROM users 
       WHERE id = :userId`,
      {
        replacements: { userId: user.id },
        type: QueryTypes.SELECT,
      }
    ) as any[];
    
    const dbVerificationCode = result[0]?.verification_code;
    // Convert to Date - PostgreSQL returns it as a string
    const dbVerificationCodeExpiresAt = result[0]?.verification_code_expires_at 
      ? new Date(result[0].verification_code_expires_at)
      : null;

    if (!dbVerificationCode) {
      throw new BadRequestException('No verification code found. Please request a new one.');
    }

    // Use the database value for comparison
    const codeToCompare = dbVerificationCode;
    const expiresAtToCheck = dbVerificationCodeExpiresAt;

    if (codeToCompare !== verificationCode) {
      throw new BadRequestException('Invalid verification code');
    }

    // Check expiration - make sure we have a valid date
    if (!expiresAtToCheck) {
      throw new BadRequestException('Verification code expiration not found');
    }

    // Convert to Date - dbVerificationCodeExpiresAt is already a Date from raw SQL
    const expirationDate = dbVerificationCodeExpiresAt instanceof Date 
      ? dbVerificationCodeExpiresAt 
      : new Date(dbVerificationCodeExpiresAt);

    // Get current time in UTC
    const now = new Date();
    
    // Compare using timestamps (UTC milliseconds) - most reliable
    const nowTimestamp = now.getTime();
    const expirationTimestamp = expirationDate.getTime();
    const diffMs = expirationTimestamp - nowTimestamp;
    const diffMinutes = Math.round(diffMs / 60000);
    
    // Debug logging
    console.log('🔍 Expiration Check:');
    console.log('  Raw expiration from DB:', dbVerificationCodeExpiresAt);
    console.log('  Expiration Date object:', expirationDate);
    console.log('  Current time (UTC):', now.toISOString());
    console.log('  Expiration time (UTC):', expirationDate.toISOString());
    console.log('  Current timestamp (ms):', nowTimestamp);
    console.log('  Expiration timestamp (ms):', expirationTimestamp);
    console.log('  Time difference (ms):', diffMs);
    console.log('  Time difference (minutes):', diffMinutes);
    console.log('  Is expired?', nowTimestamp > expirationTimestamp);
    
    // Check if expired
    if (nowTimestamp > expirationTimestamp) {
      throw new BadRequestException(`Verification code expired ${Math.abs(diffMinutes)} minute(s) ago`);
    }
    
    console.log('✅ Code is valid - expires in', diffMinutes, 'minutes');

    // Verify email
    user.emailVerified = true;
    (user as any).verificationCode = null;
    (user as any).verificationCodeExpiresAt = null;
    await user.save();

    // Send welcome email only after email is verified (not at signup).
    try {
      await this.emailService.sendWelcomeAfterSignup(user.email, user.firstName);
    } catch (error) {
      console.error('Failed to send welcome-after-verification email:', error);
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, 'user');

    return {
      userId: user.id,
      email: user.email,
      emailVerified: true,
      ...tokens,
    };
  }

  /**
   * Resend Verification Code
   */
  async resendVerificationCode(email: string) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Generate new verification code
    const verificationCode = VerificationCodeUtil.generate();
    const verificationCodeExpiresAt = VerificationCodeUtil.getExpirationDate(15);

    // Use raw SQL update with explicit UTC timezone to avoid conversion issues
    const sequelize = (user as any).sequelize;
    const expiresAtUTC = verificationCodeExpiresAt.toISOString();
    
    await sequelize.query(
      `UPDATE users 
       SET verification_code = :code, 
           verification_code_expires_at = :expiresAt::timestamp with time zone,
           updated_at = NOW()
       WHERE id = :userId`,
      {
        replacements: {
          code: verificationCode,
          expiresAt: expiresAtUTC,
          userId: user.id,
        },
        type: QueryTypes.UPDATE,
      }
    );

    // Reload from database to get the actual saved values
    await user.reload();

    console.log('🔄 Resent verification code - New code:', verificationCode);
    console.log('🔄 New expiration (set):', verificationCodeExpiresAt.toISOString());
    const savedExpiresAt = (user as any).getDataValue('verificationCodeExpiresAt') || user.verificationCodeExpiresAt;
    console.log('🔄 New expiration (from DB):', savedExpiresAt ? new Date(savedExpiresAt).toISOString() : 'null');

    // Send verification email
    try {
      await this.emailService.sendVerificationCode(email, verificationCode);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw new BadRequestException('Failed to send verification email');
    }

    return {
      verificationExpiresAt: verificationCodeExpiresAt,
    };
  }

  /**
   * User Login
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    try {
      const { email, password } = loginDto;

      const user = await User.findOne({ where: { email } });
      if (!user) {
        const exception = new UnauthorizedException('Invalid credentials');
        (exception as any).errorCode = 'AUTH_CREDENTIALS_INVALID';
        throw exception;
      }

      // Check if email is verified
      if (!user.emailVerified) {
        const exception = new UnauthorizedException('Please verify your email before logging in');
        (exception as any).errorCode = 'AUTH_EMAIL_NOT_VERIFIED';
        throw exception;
      }

      // Check if user is suspended
      if (user.status === UserStatus.SUSPENDED) {
        const exception = new UnauthorizedException('Account has been suspended');
        (exception as any).errorCode = 'AUTH_ACCOUNT_SUSPENDED';
        throw exception;
      }

      // Verify password
      const isPasswordValid = await PasswordUtil.compare(password, user.password);
      if (!isPasswordValid) {
        const exception = new UnauthorizedException('Invalid credentials');
        (exception as any).errorCode = 'AUTH_CREDENTIALS_INVALID';
        throw exception;
      }

      // Generate tokens
      const tokens = await this.generateTokens(user.id, user.email, 'user');

      // Update last login (if needed)
      // user.lastLoginAt = new Date();
      // await user.save();

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          username: user.username || null,
          firstName: user.firstName || null,
          lastName: user.lastName || null,
          phone: user.phone || null,
          onboardingStatus: user.onboardingStatus,
          earnings: parseFloat(user.earnings?.toString() || '0'),
          wallet: parseFloat(user.wallet?.toString() || '0'),
          balance: parseFloat(user.earnings?.toString() || '0'), // Backward compatibility
          emailVerified: user.emailVerified,
        },
      };
    } catch (error) {
      // Log the error for debugging
      console.error('Login error:', error);
      
      // If it's already a known exception, re-throw it
      if (error instanceof UnauthorizedException || 
          error instanceof BadRequestException ||
          error instanceof NotFoundException) {
        throw error;
      }
      
      // For unknown errors, throw a generic error
      throw new BadRequestException(
        error.message || 'An error occurred during login',
      );
    }
  }

  /**
   * Admin Login
   */
  async adminLogin(adminLoginDto: AdminLoginDto): Promise<AuthResponse> {
    const { email, password } = adminLoginDto;

    const admin = await Admin.findOne({ where: { email } });
    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if admin is disabled
    if (admin.status !== AdminStatus.ACTIVE) {
      throw new UnauthorizedException('Admin account is disabled');
    }

    // Verify password
    const isPasswordValid = await PasswordUtil.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(
      admin.id,
      admin.email,
      'admin',
      admin.role,
    );

    // Update last login
    admin.lastLoginAt = new Date();
    await admin.save();

    return {
      ...tokens,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        firstName: admin.firstName,
        lastName: admin.lastName,
      },
    };
  }

  /**
   * Social Login (Google/TikTok) - Placeholder for future implementation
   */
  async socialLogin(socialLoginDto: SocialLoginDto): Promise<AuthResponse> {
    const { provider, accessToken, email } = socialLoginDto;

    // TODO: Implement OAuth verification
    // For now, this is a placeholder
    throw new BadRequestException(
      `Social login with ${provider} is not yet implemented`,
    );
  }

  /**
   * Link TikTok identity to an existing user (after TikTok OAuth callback).
   * Fails if this TikTok account is already linked to another user.
   */
  async linkTikTokToUser(
    userId: string,
    openId: string,
    displayName?: string,
    avatarUrl?: string,
  ): Promise<void> {
    const user = await User.findByPk(userId);
    if (!user) throw new NotFoundException('User not found');

    const existing = await User.findOne({ where: { tiktokOpenId: openId } });
    if (existing && existing.id !== userId) {
      throw new ConflictException('This TikTok account is already linked to another user.');
    }

    await user.update({
      tiktokOpenId: openId,
      tiktokDisplayName: displayName ?? null,
      tiktokAvatarUrl: avatarUrl ?? null,
    } as any);
  }

  /**
   * Sign in or sign up with TikTok (no existing JWT). Find user by tiktok_open_id or create one.
   * Returns user and tokens for session. Used by OAuth callback when state has no sub.
   */
  async findOrCreateUserByTikTok(
    openId: string,
    displayName?: string,
    avatarUrl?: string,
  ): Promise<{ user: User; token: string; refreshToken: string }> {
    let user = await User.findOne({ where: { tiktokOpenId: openId } });
    if (user) {
      if (user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Account is not active');
      }
      await user.update({
        tiktokDisplayName: displayName ?? user.tiktokDisplayName,
        tiktokAvatarUrl: avatarUrl ?? user.tiktokAvatarUrl,
      } as any);
    } else {
      const emailLocal = `tiktok_${openId.replace(/[^a-zA-Z0-9._-]/g, '')}`.slice(0, 64);
      const email = `${emailLocal}@users.buykoins.com`;
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) {
        await existingEmail.update({
          tiktokOpenId: openId,
          tiktokDisplayName: displayName ?? null,
          tiktokAvatarUrl: avatarUrl ?? null,
        } as any);
        user = existingEmail;
      } else {
        const username = UsernameGenerator.generate(displayName || undefined, undefined, email);
        const hashedPassword = await PasswordUtil.hash(PasswordUtil.generateRandom());
        user = await User.create({
          email,
          password: hashedPassword,
          username,
          firstName: displayName || null,
          emailVerified: true,
          status: UserStatus.ACTIVE,
          onboardingStatus: OnboardingStatus.PENDING,
          tiktokOpenId: openId,
          tiktokDisplayName: displayName ?? null,
          tiktokAvatarUrl: avatarUrl ?? null,
        } as any);
      }
    }
    const tokens = await this.generateTokens(user.id, user.email, 'user');
    return { user, ...tokens };
  }

  /**
   * Refresh Token
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      // Verify user/admin still exists and is active
      if (payload.type === 'admin') {
        const admin = await Admin.findByPk(payload.sub);
        if (!admin || admin.status !== AdminStatus.ACTIVE) {
          throw new UnauthorizedException('Admin account not found or inactive');
        }
        return this.generateTokens(admin.id, admin.email, 'admin', admin.role);
      } else {
        const user = await User.findByPk(payload.sub);
        if (!user || user.status !== UserStatus.ACTIVE) {
          throw new UnauthorizedException('User account not found or inactive');
        }
        return this.generateTokens(user.id, user.email, 'user');
      }
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Generate JWT tokens
   */
  private async generateTokens(
    id: string,
    email: string,
    type: 'user' | 'admin',
    role?: string,
  ) {
    try {
      const payload = {
        sub: id,
        email,
        type,
        ...(role && { role }),
      };

      const jwtSecret = this.configService.get<string>('jwt.secret') || 'default-secret';
      const jwtExpiresIn = (this.configService.get<string>('jwt.expiresIn') || '24h') as string;
      const refreshSecret = this.configService.get<string>('jwt.refreshSecret') || 'default-refresh-secret';
      const refreshExpiresIn = (this.configService.get<string>('jwt.refreshExpiresIn') || '7d') as string;

      if (!jwtSecret || jwtSecret === 'default-secret') {
        console.warn('⚠️  Using default JWT secret. Please set JWT_SECRET in .env');
      }

      const [token, refreshToken] = await Promise.all([
        this.jwtService.signAsync(payload, {
          secret: jwtSecret,
          expiresIn: jwtExpiresIn,
        } as any),
        this.jwtService.signAsync(payload, {
          secret: refreshSecret,
          expiresIn: refreshExpiresIn,
        } as any),
      ]);

      return { token, refreshToken };
    } catch (error) {
      console.error('Token generation error:', error);
      throw new BadRequestException('Failed to generate authentication tokens');
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    // Get user
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await PasswordUtil.compare(
      currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Check if new password is different from current password
    const isSamePassword = await PasswordUtil.compare(
      newPassword,
      user.password,
    );
    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    // Hash new password
    const hashedNewPassword = await PasswordUtil.hash(newPassword);

    // Update password
    user.password = hashedNewPassword;
    await user.save();

    return {
      message: 'Password changed successfully',
    };
  }
}


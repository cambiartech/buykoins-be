import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Res,
  Req,
} from '@nestjs/common';
import * as express from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { TikTokAuthService } from './tiktok-auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tiktokAuthService: TikTokAuthService,
  ) {}

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 requests per hour
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 requests per 15 minutes
  @ApiOperation({ summary: 'Verify user email with verification code' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per hour
  @ApiOperation({ summary: 'Resend email verification code' })
  @ApiResponse({ status: 200, description: 'Verification code resent' })
  async resendVerification(@Body() resendDto: ResendVerificationDto) {
    return this.authService.resendVerificationCode(resendDto.email);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 requests per hour
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }


  @Public()
  @Post('social-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Social login (Google/TikTok)' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 400, description: 'Social login not implemented yet' })
  async socialLogin(@Body() socialLoginDto: SocialLoginDto) {
    return this.authService.socialLogin(socialLoginDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Public()
  @Get('tiktok')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Start TikTok OAuth (link account or sign in with TikTok)' })
  @ApiQuery({ name: 'returnUrl', required: false, description: 'URL to redirect after callback (e.g. frontend onboarding page)' })
  @ApiResponse({ status: 302, description: 'Redirects to TikTok authorize page' })
  async tiktokStart(
    @Query('returnUrl') returnUrl: string | undefined,
    @Req() req: express.Request,
    @Res() res: express.Response,
  ) {
    if (!this.tiktokAuthService.isConfigured()) {
      return res.status(503).json({ message: 'TikTok login is not configured.' });
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('[TikTok] redirect_uri sent to TikTok (must match portal exactly):', this.tiktokAuthService.redirectUri);
    }
    const safeReturnUrl = returnUrl?.trim() || '/';
    const codeVerifier = this.tiktokAuthService.generateCodeVerifier();
    const statePayload = {
      returnUrl: safeReturnUrl || '/',
      nonce: Math.random().toString(36).slice(2) + Date.now(),
      codeVerifier,
      ...((req as any).user?.id && { sub: (req as any).user.id }),
    };
    const stateToken = this.tiktokAuthService.createStateToken(statePayload);
    const url = this.tiktokAuthService.buildAuthorizeUrl(stateToken, codeVerifier);
    return res.redirect(302, url);
  }

  @Public()
  @Get('tiktok/callback')
  @ApiOperation({ summary: 'TikTok OAuth callback (exchange code, link user, redirect)' })
  @ApiQuery({ name: 'code', description: 'Authorization code from TikTok' })
  @ApiQuery({ name: 'state', description: 'State token from start' })
  @ApiResponse({ status: 302, description: 'Redirects to returnUrl with linked=1 or error' })
  async tiktokCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() res: express.Response,
  ) {
    const appendParams = (base: string, params: Record<string, string>) => {
      const q = new URLSearchParams(params).toString();
      if (base.startsWith('http')) {
        const u = new URL(base);
        u.search = u.search ? u.search + '&' + q : q;
        return u.toString();
      }
      return base + (base.includes('?') ? '&' : '?') + q;
    };

    if (error) {
      const returnUrl = (() => {
        try {
          const payload = this.tiktokAuthService.verifyStateToken(state || '');
          return payload.returnUrl || '/';
        } catch {
          return '/';
        }
      })();
      const redirect = appendParams(returnUrl, {
        tiktok_error: error,
        tiktok_error_description: errorDescription || error,
      });
      return res.redirect(302, redirect);
    }

    if (!code || !state) {
      return res.redirect(302, appendParams('/', { tiktok_error: 'missing_code_or_state' }));
    }

    try {
      const payload = this.tiktokAuthService.verifyStateToken(state);
      if (!payload.codeVerifier) {
        throw new Error('Missing code_verifier in state; PKCE is required. Try the flow again.');
      }
      const tokenRes = await this.tiktokAuthService.exchangeCodeForToken(code, payload.codeVerifier);
      const userInfo = await this.tiktokAuthService.getUserInfo(tokenRes.access_token);

      const returnUrl = payload.returnUrl || '/';

      if (payload.sub) {
        await this.authService.linkTikTokToUser(
          payload.sub,
          userInfo.open_id,
          userInfo.display_name,
          userInfo.avatar_url,
        );
        const redirect = appendParams(returnUrl, { tiktok_linked: '1' });
        return res.redirect(302, redirect);
      }

      // Sign in or sign up with TikTok (no JWT was sent at start)
      const { token, refreshToken } = await this.authService.findOrCreateUserByTikTok(
        userInfo.open_id,
        userInfo.display_name,
        userInfo.avatar_url,
      );
      const redirect = appendParams(returnUrl, {
        tiktok_login: '1',
        token,
        refresh_token: refreshToken,
      });
      return res.redirect(302, redirect);
    } catch (e: any) {
      const returnUrl = (() => {
        try {
          const payload = this.tiktokAuthService.verifyStateToken(state);
          return payload.returnUrl || '/';
        } catch {
          return '/';
        }
      })();
      const message = e?.message || 'TikTok link failed';
      const redirect = appendParams(returnUrl, { tiktok_error: 'callback_failed', tiktok_error_description: message });
      return res.redirect(302, redirect);
    }
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 requests per hour
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    schema: {
      example: {
        success: true,
        message: 'Password changed successfully',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  @ApiResponse({ status: 400, description: 'New password same as current password' })
  async changePassword(
    @CurrentUser() user: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    const result = await this.authService.changePassword(
      user.id,
      changePasswordDto,
    );
    return {
      success: true,
      ...result,
    };
  }
}


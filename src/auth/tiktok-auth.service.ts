import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

const TIKTOK_STATE_JWT_AUD = 'tiktok-oauth-state';

/** PKCE: 64-char high-entropy string (A-Za-z0-9-._~) */
const PKCE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

export interface TikTokStatePayload {
  sub?: string; // userId when linking to existing account
  returnUrl: string;
  nonce: string;
  /** PKCE code_verifier (required by TikTok v2 web); sent back on callback to exchange code. */
  codeVerifier?: string;
}

/** Generate code_challenge from code_verifier (S256 = base64url(SHA256(verifier)) no padding). */
function toCodeChallenge(verifier: string): string {
  const hash = crypto.createHash('sha256').update(verifier, 'utf8').digest();
  const base64 = hash.toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface TikTokTokenResponse {
  open_id: string;
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface TikTokUserInfo {
  open_id: string;
  display_name?: string;
  avatar_url?: string;
  avatar_url_100?: string;
}

@Injectable()
export class TikTokAuthService {
  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {}

  get clientKey(): string {
    return this.configService.get<string>('tiktok.clientKey') || '';
  }

  get redirectUri(): string {
    return this.configService.get<string>('tiktok.redirectUri') || '';
  }

  get scope(): string {
    return this.configService.get<string>('tiktok.scope') || 'user.info.basic';
  }

  get authorizeUrl(): string {
    return this.configService.get<string>('tiktok.authorizeUrl') || 'https://www.tiktok.com/v2/auth/authorize/';
  }

  get tokenUrl(): string {
    return this.configService.get<string>('tiktok.tokenUrl') || 'https://open.tiktokapis.com/v2/oauth/token/';
  }

  get userInfoUrl(): string {
    return this.configService.get<string>('tiktok.userInfoUrl') || 'https://open.tiktokapis.com/v2/user/info/';
  }

  isConfigured(): boolean {
    return !!(this.clientKey && this.configService.get<string>('tiktok.clientSecret') && this.redirectUri);
  }

  /**
   * Generate PKCE code_verifier (64 chars, high-entropy). Store in state and pass to buildAuthorizeUrl + exchangeCodeForToken.
   */
  generateCodeVerifier(): string {
    const bytes = crypto.randomBytes(48);
    let out = '';
    for (let i = 0; i < 64; i++) {
      out += PKCE_CHARS[bytes[i % bytes.length] % PKCE_CHARS.length];
    }
    return out;
  }

  /**
   * Build TikTok authorize URL. TikTok v2 web requires PKCE: pass codeVerifier (we add code_challenge + code_challenge_method=S256).
   */
  buildAuthorizeUrl(stateToken: string, codeVerifier: string): string {
    const codeChallenge = toCodeChallenge(codeVerifier);
    const params = new URLSearchParams({
      client_key: this.clientKey,
      scope: this.scope,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      state: stateToken,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `${this.authorizeUrl}?${params.toString()}`;
  }

  /**
   * Create a state JWT for CSRF protection. Include userId when user is logged in (link flow).
   */
  createStateToken(payload: TikTokStatePayload): string {
    return this.jwtService.sign(
      { ...payload, aud: TIKTOK_STATE_JWT_AUD },
      { expiresIn: '10m' },
    );
  }

  /**
   * Verify and decode state JWT from callback.
   */
  verifyStateToken(token: string): TikTokStatePayload {
    try {
      const decoded = this.jwtService.verify<TikTokStatePayload & { aud: string }>(token, {
        audience: TIKTOK_STATE_JWT_AUD,
      });
      return {
        sub: decoded.sub,
        returnUrl: decoded.returnUrl,
        nonce: decoded.nonce,
        codeVerifier: decoded.codeVerifier,
      };
    } catch {
      throw new BadRequestException('Invalid or expired state. Please try linking your TikTok account again.');
    }
  }

  /**
   * Exchange authorization code for access token and open_id. TikTok v2 web requires code_verifier (PKCE).
   */
  async exchangeCodeForToken(code: string, codeVerifier: string): Promise<TikTokTokenResponse> {
    const clientSecret = this.configService.get<string>('tiktok.clientSecret');
    if (!clientSecret) throw new BadRequestException('TikTok login is not configured.');

    const body = new URLSearchParams({
      client_key: this.clientKey,
      client_secret: clientSecret,
      code: code.trim(),
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
      code_verifier: codeVerifier,
    });

    const res = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      const msg = data.error_description || data.error || res.statusText || 'Token exchange failed';
      throw new BadRequestException(`TikTok authorization failed: ${msg}`);
    }

    return {
      open_id: data.open_id,
      access_token: data.access_token,
      expires_in: data.expires_in,
      refresh_token: data.refresh_token,
      scope: data.scope,
    };
  }

  /**
   * Get user info (display name, avatar) using access token. Requires user.info.basic scope.
   */
  async getUserInfo(accessToken: string): Promise<TikTokUserInfo> {
    const fields = 'open_id,display_name,avatar_url,avatar_url_100';
    const url = `${this.userInfoUrl}?fields=${encodeURIComponent(fields)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error?.code) {
      const msg = json.error?.message || json.error?.code || res.statusText || 'Failed to get TikTok profile';
      throw new BadRequestException(`TikTok profile failed: ${msg}`);
    }

    const user = json?.data?.user;
    if (!user || !user.open_id) {
      throw new BadRequestException('TikTok did not return user info.');
    }

    return {
      open_id: user.open_id,
      display_name: user.display_name,
      avatar_url: user.avatar_url || user.avatar_url_100,
      avatar_url_100: user.avatar_url_100,
    };
  }
}

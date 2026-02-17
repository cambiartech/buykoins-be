import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import * as express from 'express';
import { Public } from './decorators/public.decorator';
import { ConfigService } from '@nestjs/config';

/**
 * Handles TikTok Redirect URI as registered in the TikTok Developer Portal.
 * Portal config: Login Kit → Redirect URI = https://core.buykoins.com/callback-tiktok
 * This route is excluded from the global API prefix so the path is exactly /callback-tiktok.
 * Forwards to the main callback handler at /api/auth/tiktok/callback (same server).
 */
@Controller('callback-tiktok')
@Public()
export class TikTokCallbackController {
  constructor(private configService: ConfigService) {}

  @Get()
  handleCallback(
    @Req() req: express.Request,
    @Res() res: express.Response,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
  ) {
    const apiPrefix = this.configService.get<string>('app.apiPrefix', 'api');
    const query = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '').toString();
    const target = `/${apiPrefix}/auth/tiktok/callback${query ? `?${query}` : ''}`;
    res.redirect(302, target);
  }
}

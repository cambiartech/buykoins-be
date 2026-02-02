import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GmailReaderService } from './gmail-reader.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../auth/decorators/public.decorator';

/**
 * Webhook endpoint for Google Apps Script
 * Google Apps Script will POST email data here when new PayPal emails arrive
 */
@ApiTags('Gmail Integration')
@Controller('gmail')
export class GmailReaderController {
  constructor(private readonly gmailReaderService: GmailReaderService) {}

  /**
   * Webhook endpoint for Google Apps Script
   * Receives email data when PayPal sends auth code emails
   */
  @Post('webhook')
  @Public() // Webhook doesn't need auth (can add secret validation)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook endpoint for Google Apps Script email notifications' })
  @ApiResponse({
    status: 200,
    description: 'Email processed successfully',
  })
  async handleGmailWebhook(
    @Body() emailData: {
      from: string;
      subject: string;
      body: string;
      receivedAt: string;
    },
  ) {
    const result = await this.gmailReaderService.processIncomingEmail({
      from: emailData.from,
      subject: emailData.subject,
      body: emailData.body,
      receivedAt: new Date(emailData.receivedAt),
    });

    if (result && result.authCode) {
      // TODO: Store auth code and notify admin/user
      return {
        success: true,
        message: 'Auth code extracted and processed',
        authCode: result.authCode,
      };
    }

    return {
      success: true,
      message: 'Email processed (no auth code found)',
    };
  }

  /**
   * Manual endpoint for admin to fetch latest auth code
   */
  @Post('fetch-latest-code')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually fetch latest PayPal auth code from Gmail' })
  @ApiResponse({
    status: 200,
    description: 'Latest auth code retrieved',
  })
  async fetchLatestCode() {
    const authCode = await this.gmailReaderService.getLatestPayPalAuthCode();
    
    return {
      success: true,
      data: {
        authCode,
      },
    };
  }
}


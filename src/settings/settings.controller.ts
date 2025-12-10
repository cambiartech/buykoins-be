import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
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
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateFinancialSettingsDto } from './dto/update-financial-settings.dto';
import { UpdateOperationsSettingsDto } from './dto/update-operations-settings.dto';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';
import { UpdateBusinessRulesSettingsDto } from './dto/update-business-rules-settings.dto';
import { UpdatePlatformInfoSettingsDto } from './dto/update-platform-info-settings.dto';
import { Permission } from '../admins/permissions.constants';
import { Permissions } from '../common/decorators/roles.decorator';

@ApiTags('Settings')
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles('admin', 'super_admin')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all platform settings grouped by category' })
  @ApiResponse({
    status: 200,
    description: 'Settings retrieved successfully',
  })
  @Permissions(Permission.SETTINGS_VIEW)
  async getAllSettings() {
    const data = await this.settingsService.getAllSettings();
    return {
      success: true,
      data,
    };
  }

  @Get(':category')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get settings by category' })
  @ApiResponse({
    status: 200,
    description: 'Settings retrieved successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid category' })
  @Permissions(Permission.SETTINGS_VIEW)
  async getSettingsByCategory(@Param('category') category: string) {
    const data = await this.settingsService.getSettingsByCategory(
      category as any,
    );
    return {
      success: true,
      data,
    };
  }

  @Patch('financial')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update financial settings' })
  @ApiResponse({
    status: 200,
    description: 'Financial settings updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @Permissions(Permission.SETTINGS_UPDATE)
  async updateFinancialSettings(
    @Body() dto: UpdateFinancialSettingsDto,
    @CurrentUser() admin: any,
  ) {
    const data = await this.settingsService.updateFinancialSettings(
      dto,
      admin.id,
    );
    return {
      success: true,
      message: 'Financial settings updated successfully',
      data,
    };
  }

  @Patch('operations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update operations settings' })
  @ApiResponse({
    status: 200,
    description: 'Operations settings updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @Permissions(Permission.SETTINGS_UPDATE)
  async updateOperationsSettings(
    @Body() dto: UpdateOperationsSettingsDto,
    @CurrentUser() admin: any,
  ) {
    const data = await this.settingsService.updateOperationsSettings(
      dto,
      admin.id,
    );
    return {
      success: true,
      message: 'Operations settings updated successfully',
      data,
    };
  }

  @Patch('payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update payment settings' })
  @ApiResponse({
    status: 200,
    description: 'Payment settings updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @Permissions(Permission.SETTINGS_UPDATE)
  async updatePaymentSettings(
    @Body() dto: UpdatePaymentSettingsDto,
    @CurrentUser() admin: any,
  ) {
    const data = await this.settingsService.updatePaymentSettings(
      dto,
      admin.id,
    );
    return {
      success: true,
      message: 'Payment settings updated successfully',
      data,
    };
  }

  @Patch('business-rules')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update business rules settings' })
  @ApiResponse({
    status: 200,
    description: 'Business rules settings updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @Permissions(Permission.SETTINGS_UPDATE)
  async updateBusinessRulesSettings(
    @Body() dto: UpdateBusinessRulesSettingsDto,
    @CurrentUser() admin: any,
  ) {
    const data = await this.settingsService.updateBusinessRulesSettings(
      dto,
      admin.id,
    );
    return {
      success: true,
      message: 'Business rules settings updated successfully',
      data,
    };
  }

  @Patch('platform-info')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update platform information settings' })
  @ApiResponse({
    status: 200,
    description: 'Platform information settings updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @Permissions(Permission.SETTINGS_UPDATE)
  async updatePlatformInfoSettings(
    @Body() dto: UpdatePlatformInfoSettingsDto,
    @CurrentUser() admin: any,
  ) {
    const data = await this.settingsService.updatePlatformInfoSettings(
      dto,
      admin.id,
    );
    return {
      success: true,
      message: 'Platform information settings updated successfully',
      data,
    };
  }

  @Patch('extended')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update extended settings (JSONB)' })
  @ApiResponse({
    status: 200,
    description: 'Extended settings updated successfully',
  })
  @Roles('super_admin')
  async updateExtendedSettings(
    @Body() extendedSettings: Record<string, any>,
    @CurrentUser() admin: any,
  ) {
    const data = await this.settingsService.updateExtendedSettings(
      extendedSettings,
      admin.id,
    );
    return {
      success: true,
      message: 'Extended settings updated successfully',
      data,
    };
  }
}


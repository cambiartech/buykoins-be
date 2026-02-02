import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { WidgetService } from './widget.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InitWidgetDto } from './dto/init-widget.dto';
import { SubmitStepDto } from './dto/submit-step.dto';
import { CompleteWidgetDto } from './dto/complete-widget.dto';
import { StorageService } from '../storage/storage.service';

@ApiTags('Widget')
@Controller('widget')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WidgetController {
  constructor(
    private readonly widgetService: WidgetService,
    private readonly storageService: StorageService,
  ) {}

  @Post('init')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initialize widget session' })
  @ApiResponse({
    status: 201,
    description: 'Widget session initialized successfully',
  })
  async initSession(
    @CurrentUser() user: any,
    @Body() initDto: InitWidgetDto,
  ) {
    const session = await this.widgetService.initSession(user.id, initDto);
    return {
      success: true,
      data: {
        sessionId: session.id,
        currentStep: session.currentStep,
        trigger: session.triggerType,
        context: session.context,
      },
    };
  }

  @Get('session/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get widget session status' })
  @ApiResponse({
    status: 200,
    description: 'Widget session retrieved successfully',
  })
  async getSession(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
  ) {
    const session = await this.widgetService.getSession(sessionId, user.id);
    return {
      success: true,
      data: {
        sessionId: session.id,
        currentStep: session.currentStep,
        status: session.status,
        collectedData: session.collectedData,
        completedSteps: session.completedSteps,
        trigger: session.triggerType,
      },
    };
  }

  @Post('session/:sessionId/step')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit widget step data' })
  @ApiResponse({
    status: 200,
    description: 'Step submitted successfully',
  })
  async submitStep(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
    @Body() submitDto: SubmitStepDto,
  ) {
    const result = await this.widgetService.submitStep(sessionId, user.id, submitDto);
    return {
      success: true,
      data: {
        sessionId: result.session.id,
        nextStep: result.nextStep,
        collectedData: result.session.collectedData,
      },
    };
  }

  @Post('session/:sessionId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete widget session' })
  @ApiResponse({
    status: 200,
    description: 'Widget session completed successfully',
  })
  async completeSession(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
    @Body() completeDto: CompleteWidgetDto,
  ) {
    const session = await this.widgetService.completeSession(sessionId, user.id);
    return {
      success: true,
      data: {
        sessionId: session.id,
        status: session.status,
        result: {
          trigger: session.triggerType,
        },
      },
    };
  }

  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user active widget sessions' })
  @ApiResponse({
    status: 200,
    description: 'Active sessions retrieved successfully',
  })
  async getUserSessions(@CurrentUser() user: any) {
    const sessions = await this.widgetService.getUserSessions(user.id);
    return {
      success: true,
      data: sessions.map((s) => ({
        sessionId: s.id,
        trigger: s.triggerType,
        currentStep: s.currentStep,
        status: s.status,
        createdAt: s.createdAt,
      })),
    };
  }

  @Post('session/:sessionId/upload-proof')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload proof/screenshot for widget step' })
  @ApiResponse({
    status: 200,
    description: 'File uploaded successfully',
  })
  async uploadProof(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Validate file
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPG, PNG, and PDF are allowed.');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds 10MB limit.');
    }

    // Upload to S3
    const fileKey = await this.storageService.uploadFile(file, 'widget-proofs');
    const fileUrl = await this.storageService.getPublicUrl(fileKey);

    return {
      success: true,
      data: {
        fileUrl,
        fileName: file.originalname,
        fileSize: file.size,
      },
    };
  }
}


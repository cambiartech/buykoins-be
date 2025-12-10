import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { CreditRequestsService } from './credit-requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateCreditRequestDto } from './dto/create-credit-request.dto';

@ApiTags('Credit Requests')
@Controller('user/credit-request')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CreditRequestsController {
  constructor(private readonly creditRequestsService: CreditRequestsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('proof'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Submit a new credit request' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          example: 500.00,
          description: 'Amount in USD',
        },
        proof: {
          type: 'string',
          format: 'binary',
          description: 'Proof file (image or PDF, max 10MB)',
        },
      },
      required: ['amount', 'proof'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Credit request submitted successfully',
    schema: {
      example: {
        success: true,
        message: 'Credit request submitted successfully',
        data: {
          id: 'uuid',
          userId: 'uuid',
          amount: 500.00,
          status: 'pending',
          submittedAt: '2024-01-20T10:30:00Z',
          proofUrl: 'https://storage.example.com/proofs/uuid.jpg',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error or invalid file',
  })
  @ApiResponse({
    status: 403,
    description: 'User not onboarded',
  })
  @ApiResponse({
    status: 409,
    description: 'User already has a pending credit request',
  })
  async createCreditRequest(
    @CurrentUser() user: any,
    @Body() createCreditRequestDto: CreateCreditRequestDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|webp|pdf)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const data = await this.creditRequestsService.createCreditRequest(
      user.id,
      createCreditRequestDto,
      file,
    );
    return {
      success: true,
      message: 'Credit request submitted successfully',
      data,
    };
  }

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current credit request status' })
  @ApiResponse({
    status: 200,
    description: 'Credit request status retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          status: 'pending',
          amount: 500.00,
          submittedAt: '2024-01-20T10:30:00Z',
          processedAt: null,
          rejectionReason: null,
        },
      },
    },
  })
  async getCreditRequestStatus(@CurrentUser() user: any) {
    const data = await this.creditRequestsService.getCreditRequestStatus(
      user.id,
    );
    return {
      success: true,
      data,
    };
  }

  @Get('history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get credit request history' })
  @ApiResponse({
    status: 200,
    description: 'Credit request history retrieved successfully',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'uuid',
            amount: 500.00,
            status: 'pending',
            submittedAt: '2024-01-20T10:30:00Z',
            processedAt: null,
            rejectionReason: null,
            proofUrl: 'https://storage.example.com/proofs/uuid.jpg',
          },
        ],
      },
    },
  })
  async getCreditRequestHistory(@CurrentUser() user: any) {
    const data = await this.creditRequestsService.getCreditRequestHistory(
      user.id,
    );
    return {
      success: true,
      data,
    };
  }
}


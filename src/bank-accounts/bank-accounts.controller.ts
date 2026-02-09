import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { BankAccountsService } from './bank-accounts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AddBankAccountDto } from './dto/add-bank-account.dto';
import { VerifyBankAccountDto } from './dto/verify-bank-account.dto';
import { NameEnquiryDto } from './dto/name-enquiry.dto';

@ApiTags('Bank Accounts')
@Controller('user/bank-accounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add bank account (sends OTP for verification)' })
  @ApiResponse({
    status: 201,
    description: 'Bank account added, verification code sent',
  })
  async addBankAccount(
    @CurrentUser() user: any,
    @Body() addBankAccountDto: AddBankAccountDto,
  ) {
    const data = await this.bankAccountsService.addBankAccount(
      user.id,
      addBankAccountDto,
    );
    return {
      success: true,
      message: data.message,
      data: {
        id: data.id,
        expiresIn: data.expiresIn,
      },
    };
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify bank account with OTP' })
  @ApiResponse({
    status: 200,
    description: 'Bank account verified successfully',
  })
  async verifyBankAccount(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() verifyDto: VerifyBankAccountDto,
  ) {
    const data = await this.bankAccountsService.verifyBankAccount(
      user.id,
      id,
      verifyDto,
    );
    return {
      success: true,
      message: 'Bank account verified successfully',
      data,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user bank accounts' })
  @ApiResponse({
    status: 200,
    description: 'Bank accounts retrieved successfully',
  })
  async getUserBankAccounts(@CurrentUser() user: any) {
    const data = await this.bankAccountsService.getUserBankAccounts(user.id);
    return {
      success: true,
      data,
    };
  }

  @Post(':id/set-primary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set bank account as primary' })
  @ApiResponse({
    status: 200,
    description: 'Bank account set as primary successfully',
  })
  async setPrimaryBankAccount(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    const data = await this.bankAccountsService.setPrimaryBankAccount(
      user.id,
      id,
    );
    return {
      success: true,
      message: 'Bank account set as primary successfully',
      data,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete bank account' })
  @ApiResponse({
    status: 200,
    description: 'Bank account deleted successfully',
  })
  async deleteBankAccount(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    const data = await this.bankAccountsService.deleteBankAccount(user.id, id);
    return {
      success: true,
      ...data,
    };
  }

  @Get('banks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get list of Nigerian banks' })
  @ApiQuery({
    name: 'country',
    required: false,
    description: 'Country code (default: NG)',
    example: 'NG',
  })
  @ApiResponse({
    status: 200,
    description: 'Banks list retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          banks: [
            {
              code: '011',
              name: 'First Bank of Nigeria',
            },
            {
              code: '058',
              name: 'Guaranty Trust Bank',
            },
          ],
        },
      },
    },
  })
  async getBanksList(@Query('country') country?: string) {
    const data = await this.bankAccountsService.getBanksList(country || 'NG');
    return {
      success: true,
      data,
    };
  }

  @Post('name-enquiry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get account name for bank account (name enquiry)' })
  @ApiResponse({
    status: 200,
    description: 'Account name retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          accountName: 'JOHN DOE',
          accountNumber: '1234567890',
          bankCode: '011',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid account number or bank code',
  })
  async nameEnquiry(@Body() nameEnquiryDto: NameEnquiryDto) {
    const data = await this.bankAccountsService.nameEnquiry(nameEnquiryDto);
    return {
      success: true,
      data,
    };
  }
}


import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
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
} from '@nestjs/swagger';
import { BankAccountsService } from './bank-accounts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AddBankAccountDto } from './dto/add-bank-account.dto';
import { VerifyBankAccountDto } from './dto/verify-bank-account.dto';

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
}



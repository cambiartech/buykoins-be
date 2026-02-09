import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { BankAccount } from './entities/bank-account.entity';
import { User } from '../users/entities/user.entity';
import { AddBankAccountDto } from './dto/add-bank-account.dto';
import { VerifyBankAccountDto } from './dto/verify-bank-account.dto';
import { NameEnquiryDto } from './dto/name-enquiry.dto';
import { VerificationCodeUtil } from '../auth/utils/verification-code.util';
import { EmailService } from '../email/email.service';
import { SudoApiService } from '../cards/sudo/sudo-api.service';

@Injectable()
export class BankAccountsService {
  constructor(
    @Inject('SEQUELIZE') private sequelize: Sequelize,
    private emailService: EmailService,
    private sudoApiService: SudoApiService,
  ) {}

  /**
   * Add bank account (sends OTP for verification)
   */
  async addBankAccount(userId: string, addBankAccountDto: AddBankAccountDto) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if account number already exists for this user
    const existingAccount = await BankAccount.findOne({
      where: {
        userId,
        accountNumber: addBankAccountDto.accountNumber,
        bankCode: addBankAccountDto.bankCode,
      },
    });

    if (existingAccount && existingAccount.isVerified) {
      throw new BadRequestException(
        'This bank account is already added and verified',
      );
    }

    // Generate verification code
    const verificationCode = VerificationCodeUtil.generate();
    const verificationCodeExpiresAt = VerificationCodeUtil.getExpirationDate(15);

    // Use raw SQL to set timezone-sensitive fields
    const expiresAtUTC = verificationCodeExpiresAt.toISOString();

    if (existingAccount) {
      // Update existing unverified account
      await this.sequelize.query(
        `UPDATE bank_accounts 
         SET account_name = :accountName,
             bank_name = :bankName,
             verification_code = :code,
             verification_code_expires_at = :expiresAt::timestamp with time zone,
             is_verified = false,
             updated_at = NOW()
         WHERE id = :accountId`,
        {
          replacements: {
            accountName: addBankAccountDto.accountName,
            bankName: addBankAccountDto.bankName,
            code: verificationCode,
            expiresAt: expiresAtUTC,
            accountId: existingAccount.id,
          },
          type: require('sequelize').QueryTypes.UPDATE,
        },
      );

      // Send OTP email
      await this.emailService.sendBankAccountVerificationCode(
        user.email,
        verificationCode,
      );

      return {
        id: existingAccount.id,
        message: 'Verification code sent to your email',
        expiresIn: 15,
      };
    } else {
      // Create new bank account using raw SQL to avoid timezone issues
      const result = await this.sequelize.query(
        `INSERT INTO bank_accounts 
         (id, user_id, account_number, account_name, bank_name, bank_code, 
          is_verified, is_primary, verification_code, verification_code_expires_at, 
          created_at, updated_at)
         VALUES 
         (uuid_generate_v4(), :userId, :accountNumber, :accountName, :bankName, :bankCode,
          false, false, :code, :expiresAt::timestamp with time zone,
          NOW(), NOW())
         RETURNING id`,
        {
          replacements: {
            userId,
            accountNumber: addBankAccountDto.accountNumber,
            accountName: addBankAccountDto.accountName,
            bankName: addBankAccountDto.bankName,
            bankCode: addBankAccountDto.bankCode,
            code: verificationCode,
            expiresAt: expiresAtUTC,
          },
          type: require('sequelize').QueryTypes.SELECT,
        },
      ) as any[];

      const bankAccountId = result[0]?.id;

      if (!bankAccountId) {
        throw new Error('Failed to create bank account');
      }

      // Send OTP email
      await this.emailService.sendBankAccountVerificationCode(
        user.email,
        verificationCode,
      );

      return {
        id: bankAccountId,
        message: 'Verification code sent to your email',
        expiresIn: 15,
      };
    }
  }

  /**
   * Verify bank account with OTP
   */
  async verifyBankAccount(
    userId: string,
    bankAccountId: string,
    verifyDto: VerifyBankAccountDto,
  ) {
    const bankAccount = await BankAccount.findOne({
      where: { id: bankAccountId, userId },
    });

    if (!bankAccount) {
      throw new NotFoundException('Bank account not found');
    }

    if (bankAccount.isVerified) {
      throw new BadRequestException('Bank account is already verified');
    }

    // Get verification code from database with raw SQL
    const result = await this.sequelize.query(
      `SELECT verification_code, verification_code_expires_at
       FROM bank_accounts 
       WHERE id = :accountId`,
      {
        replacements: { accountId: bankAccountId },
        type: require('sequelize').QueryTypes.SELECT,
      },
    ) as any[];

    const dbVerificationCode = result[0]?.verification_code;
    const dbVerificationCodeExpiresAt = result[0]?.verification_code_expires_at;

    if (!dbVerificationCode) {
      throw new BadRequestException(
        'No verification code found. Please request a new one.',
      );
    }

    if (verifyDto.verificationCode !== dbVerificationCode) {
      throw new BadRequestException('Invalid verification code');
    }

    if (!dbVerificationCodeExpiresAt) {
      throw new BadRequestException('Verification code has expired');
    }

    // Parse expiration date and compare in UTC
    const expirationDate = new Date(dbVerificationCodeExpiresAt);
    const now = new Date();
    
    // Convert both to UTC timestamps for accurate comparison
    const nowTimestamp = now.getTime();
    const expirationTimestamp = expirationDate.getTime();
    
    // Check if expired
    if (nowTimestamp > expirationTimestamp) {
      const diffMs = nowTimestamp - expirationTimestamp;
      const diffMinutes = Math.round(diffMs / 60000);
      throw new BadRequestException(`Verification code expired ${diffMinutes} minute(s) ago`);
    }

    // Use transaction to ensure atomicity
    const transaction = await this.sequelize.transaction();

    try {
      // Mark account as verified
      await this.sequelize.query(
        `UPDATE bank_accounts 
         SET is_verified = true,
             verification_code = NULL,
             verification_code_expires_at = NULL,
             updated_at = NOW()
         WHERE id = :accountId`,
        {
          replacements: { accountId: bankAccountId },
          type: require('sequelize').QueryTypes.UPDATE,
          transaction,
        },
      );

      // If this is the first verified account, make it primary
      const verifiedAccounts = await BankAccount.count({
        where: { userId, isVerified: true },
        transaction,
      });

      if (verifiedAccounts === 0) {
        await this.sequelize.query(
          `UPDATE bank_accounts 
           SET is_primary = true
           WHERE id = :accountId`,
          {
            replacements: { accountId: bankAccountId },
            type: require('sequelize').QueryTypes.UPDATE,
            transaction,
          },
        );
      }

      await transaction.commit();

      // Reload to get updated values
      await bankAccount.reload();

      return {
        id: bankAccount.id,
        isVerified: true,
        isPrimary: bankAccount.isPrimary,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get user's bank accounts
   */
  async getUserBankAccounts(userId: string) {
    const bankAccounts = await BankAccount.findAll({
      where: { userId },
      order: [['isPrimary', 'DESC'], ['createdAt', 'DESC']],
    });

    return bankAccounts.map((account) => ({
      id: account.id,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      bankName: account.bankName,
      bankCode: account.bankCode,
      isVerified: account.isVerified,
      isPrimary: account.isPrimary,
      createdAt: account.createdAt,
    }));
  }

  /**
   * Set primary bank account
   */
  async setPrimaryBankAccount(userId: string, bankAccountId: string) {
    const bankAccount = await BankAccount.findOne({
      where: { id: bankAccountId, userId },
    });

    if (!bankAccount) {
      throw new NotFoundException('Bank account not found');
    }

    if (!bankAccount.isVerified) {
      throw new BadRequestException(
        'Only verified bank accounts can be set as primary',
      );
    }

    // Use transaction
    const transaction = await this.sequelize.transaction();

    try {
      // Remove primary from all accounts
      await this.sequelize.query(
        `UPDATE bank_accounts 
         SET is_primary = false
         WHERE user_id = :userId`,
        {
          replacements: { userId },
          type: require('sequelize').QueryTypes.UPDATE,
          transaction,
        },
      );

      // Set this account as primary
      await this.sequelize.query(
        `UPDATE bank_accounts 
         SET is_primary = true
         WHERE id = :accountId`,
        {
          replacements: { accountId: bankAccountId },
          type: require('sequelize').QueryTypes.UPDATE,
          transaction,
        },
      );

      await transaction.commit();

      return {
        id: bankAccount.id,
        isPrimary: true,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Delete bank account
   */
  async deleteBankAccount(userId: string, bankAccountId: string) {
    const bankAccount = await BankAccount.findOne({
      where: { id: bankAccountId, userId },
    });

    if (!bankAccount) {
      throw new NotFoundException('Bank account not found');
    }

    if (bankAccount.isPrimary) {
      throw new BadRequestException(
        'Cannot delete primary bank account. Set another account as primary first.',
      );
    }

    await bankAccount.destroy();

    return {
      message: 'Bank account deleted successfully',
    };
  }

  /**
   * Get list of Nigerian banks from Sudo
   */
  async getBanksList(country: string = 'NG'): Promise<any> {
    try {
      const response = await this.sudoApiService.getBanksList(country);
      return response;
    } catch (error: any) {
      throw new BadRequestException(
        error.message || 'Failed to fetch banks list',
      );
    }
  }

  /**
   * Name enquiry - Get account name from Sudo
   */
  async nameEnquiry(nameEnquiryDto: NameEnquiryDto): Promise<any> {
    try {
      const response = await this.sudoApiService.nameEnquiry(
        nameEnquiryDto.bankCode,
        nameEnquiryDto.accountNumber,
      );
      return response;
    } catch (error: any) {
      throw new BadRequestException(
        error.message || 'Failed to verify account details',
      );
    }
  }
}


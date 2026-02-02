import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private isDevelopment: boolean;

  constructor(private configService: ConfigService) {
    const awsConfig = this.configService.get('aws');
    this.bucketName = awsConfig.s3.bucketName;
    this.isDevelopment = this.configService.get('app.nodeEnv') !== 'production';

    // Only initialize S3 client if credentials are available
    if (awsConfig.accessKeyId && awsConfig.secretAccessKey) {
      const clientConfig: any = {
        region: awsConfig.region || 'auto', // R2 uses 'auto' or 'us-east-1'
        credentials: {
          accessKeyId: awsConfig.accessKeyId,
          secretAccessKey: awsConfig.secretAccessKey,
        },
      };

      // Add endpoint for Cloudflare R2 or other S3-compatible services
      if (awsConfig.endpoint) {
        clientConfig.endpoint = awsConfig.endpoint;
        // R2 requires forcePathStyle
        if (awsConfig.endpoint.includes('r2.cloudflarestorage.com')) {
          clientConfig.forcePathStyle = true;
        }
      }

      this.s3Client = new S3Client(clientConfig);
    } else if (this.isDevelopment) {
      this.logger.warn('Storage credentials not configured. File uploads will be simulated in development mode.');
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'proofs',
  ): Promise<string> {
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

    // In development mode without AWS credentials, simulate upload
    if (!this.s3Client && this.isDevelopment) {
      this.logger.log('==========================================');
      this.logger.log('📁 FILE UPLOAD (Development Mode)');
      this.logger.log('==========================================');
      this.logger.log(`File Name: ${file.originalname}`);
      this.logger.log(`File Size: ${(file.size / 1024).toFixed(2)} KB`);
      this.logger.log(`File Type: ${file.mimetype}`);
      this.logger.log(`Stored As: ${fileName}`);
      this.logger.log('==========================================');
      return fileName;
    }

    if (!this.s3Client) {
      throw new Error('AWS S3 is not configured. Please set AWS credentials.');
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'private', // Files are private by default
    });

    await this.s3Client.send(command);
    return fileName;
  }

  async getFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.s3Client && this.isDevelopment) {
      // Return a mock URL in development
      return `https://storage.example.com/${key}`;
    }

    if (!this.s3Client) {
      throw new Error('AWS S3 is not configured. Please set AWS credentials.');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async getPublicUrl(key: string): Promise<string> {
    if (!this.s3Client && this.isDevelopment) {
      // Return a mock URL in development
      return `https://storage.example.com/${key}`;
    }

    const awsConfig = this.configService.get('aws');
    
    // Use custom public URL for Cloudflare R2 if configured
    if (awsConfig.r2?.publicUrl) {
      return `${awsConfig.r2.publicUrl}/${key}`;
    }

    // Use R2.dev URL if account ID is provided (Cloudflare R2 default)
    if (awsConfig.r2?.accountId) {
      return `https://pub-${awsConfig.r2.accountId}.r2.dev/${key}`;
    }

    // Default to S3 URL
    return `https://${this.bucketName}.s3.amazonaws.com/${key}`;
  }
}


import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { ResponseUtil } from '../utils/response.util';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: Array<{ field: string; message: string }> = [];
    let errorCode: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || message;
        errorCode = responseObj.errorCode || responseObj.code;

        if (Array.isArray(responseObj.message)) {
          errors = responseObj.message.map((msg: string) => ({
            field: 'general',
            message: msg,
          }));
        } else if (responseObj.errors) {
          errors = responseObj.errors;
        }
      }

      // Add error codes for 401 errors to help frontend distinguish
      if (status === HttpStatus.UNAUTHORIZED && exception instanceof UnauthorizedException) {
        // Determine error code based on message
        if (message.includes('token') || message.includes('expired') || message.includes('invalid')) {
          errorCode = 'AUTH_TOKEN_INVALID'; // Should log out
        } else if (message.includes('credentials')) {
          errorCode = 'AUTH_CREDENTIALS_INVALID'; // Should NOT log out (login attempt)
        } else if (message.includes('suspended') || message.includes('disabled')) {
          errorCode = 'AUTH_ACCOUNT_SUSPENDED'; // Should log out
        } else if (message.includes('verify')) {
          errorCode = 'AUTH_EMAIL_NOT_VERIFIED'; // Should NOT log out
        } else if (message.includes('required') || message.includes('Authentication')) {
          errorCode = 'AUTH_REQUIRED'; // Should log out
        } else {
          errorCode = 'AUTH_UNAUTHORIZED'; // Default, should log out
        }
      }
    } else {
      // Log unexpected errors for debugging
      console.error('Unexpected error:', exception);
      if (exception instanceof Error) {
        console.error('Error stack:', exception.stack);
        // In development, include error details
        if (process.env.NODE_ENV === 'development') {
          message = exception.message || message;
        }
      }
    }

    const errorResponse: any = ResponseUtil.error(message, errors.length > 0 ? errors : undefined);
    
    // Add error code to response if available
    if (errorCode) {
      errorResponse.errorCode = errorCode;
    }

    response.status(status).json(errorResponse);
  }
}


import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
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

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || message;

        if (Array.isArray(responseObj.message)) {
          errors = responseObj.message.map((msg: string) => ({
            field: 'general',
            message: msg,
          }));
        } else if (responseObj.errors) {
          errors = responseObj.errors;
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

    const errorResponse = ResponseUtil.error(message, errors.length > 0 ? errors : undefined);

    response.status(status).json(errorResponse);
  }
}


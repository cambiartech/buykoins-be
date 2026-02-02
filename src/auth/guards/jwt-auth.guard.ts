import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    
    // Determine error code based on error type
    let errorCode = 'AUTH_REQUIRED';
    
    // Log authentication attempt for debugging
    if (process.env.NODE_ENV === 'development') {
      const authHeader = request.headers?.authorization;
      console.log('🔐 JWT Auth Attempt:', {
        hasToken: !!authHeader,
        tokenPrefix: authHeader?.substring(0, 20) + '...',
        error: err?.message,
        info: info?.message,
        userFound: !!user,
      });
    }

    // If there's an error or info (like expired token), throw UnauthorizedException
    if (err || info) {
      const errorMessage = err?.message || info?.message || 'Authentication failed';
      // Determine error code based on error type
      let errorCode = 'AUTH_TOKEN_INVALID';
      if (info?.name === 'TokenExpiredError') {
        errorCode = 'AUTH_TOKEN_EXPIRED';
      } else if (info?.name === 'JsonWebTokenError') {
        errorCode = 'AUTH_TOKEN_INVALID';
      } else if (info?.name === 'NotBeforeError') {
        errorCode = 'AUTH_TOKEN_NOT_ACTIVE';
      }
      
      const exception = new UnauthorizedException(errorMessage);
      (exception as any).errorCode = errorCode;
      throw exception;
    }

    // If no user, throw UnauthorizedException
    if (!user) {
      const exception = new UnauthorizedException('Authentication required');
      (exception as any).errorCode = 'AUTH_REQUIRED';
      throw exception;
    }

    return user;
  }
}


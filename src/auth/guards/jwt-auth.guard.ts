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
      throw new UnauthorizedException(errorMessage);
    }

    // If no user, throw UnauthorizedException
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    return user;
  }
}


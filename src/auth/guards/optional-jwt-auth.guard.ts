import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Like JwtAuthGuard but never throws: if no token or invalid token, request.user is undefined.
 * Use for routes that work both with and without login (e.g. TikTok OAuth start: include userId in state when logged in).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(err: any, user: TUser): TUser | undefined {
    if (err || !user) return undefined;
    return user;
  }
}

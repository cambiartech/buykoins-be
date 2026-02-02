import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Sequelize } from 'sequelize-typescript';
import { User, UserStatus } from '../../users/entities/user.entity';
import { Admin, AdminStatus } from '../../admins/entities/admin.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  type: 'user' | 'admin';
  role?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @Inject('SEQUELIZE') private sequelize: Sequelize,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || 'default-secret',
    });
  }

  async validate(payload: JwtPayload) {
    // Log payload for debugging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 JWT Payload:', {
        sub: payload.sub,
        email: payload.email,
        type: payload.type,
        role: payload.role,
      });
    }

    if (payload.type === 'admin') {
      const admin = await Admin.findByPk(payload.sub);
      
      if (!admin) {
        console.error('❌ Admin not found:', payload.sub);
        const exception = new UnauthorizedException('Admin account not found');
        (exception as any).errorCode = 'AUTH_ACCOUNT_NOT_FOUND';
        throw exception;
      }

      if (admin.status !== AdminStatus.ACTIVE) {
        console.error('❌ Admin inactive:', payload.sub, 'Status:', admin.status);
        const exception = new UnauthorizedException(`Admin account is ${admin.status}`);
        (exception as any).errorCode = 'AUTH_ACCOUNT_SUSPENDED';
        throw exception;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Admin authenticated:', {
          id: admin.id,
          email: admin.email,
          role: admin.role,
          status: admin.status,
        });
      }

      return {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions || [],
        type: 'admin',
      };
    } else {
      const user = await User.findByPk(payload.sub);
      
      if (!user) {
        console.error(' User not found:', payload.sub);
        const exception = new UnauthorizedException('User account not found');
        (exception as any).errorCode = 'AUTH_ACCOUNT_NOT_FOUND';
        throw exception;
      }

      if (user.status !== UserStatus.ACTIVE) {
        console.error('User inactive:', payload.sub, 'Status:', user.status);
        const exception = new UnauthorizedException(`User account is ${user.status}`);
        (exception as any).errorCode = 'AUTH_ACCOUNT_SUSPENDED';
        throw exception;
      }

      return {
        id: user.id,
        email: user.email,
        type: 'user',
      };
    }
  }
}


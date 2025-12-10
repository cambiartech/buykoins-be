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
    if (payload.type === 'admin') {
      const admin = await Admin.findByPk(payload.sub);
      if (!admin || admin.status !== AdminStatus.ACTIVE) {
        throw new UnauthorizedException('Admin account not found or inactive');
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
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('User account not found or inactive');
      }
      return {
        id: user.id,
        email: user.email,
        type: 'user',
      };
    }
  }
}


import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, PERMISSIONS_KEY } from '../../common/decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check roles
    if (requiredRoles && requiredRoles.length > 0) {
      if (user.type === 'admin' && user.role) {
        if (!requiredRoles.includes(user.role)) {
          throw new ForbiddenException('Insufficient role permissions');
        }
      } else {
        throw new ForbiddenException('Admin role required');
      }
    }

    // Check permissions
    if (requiredPermissions && requiredPermissions.length > 0) {
      if (user.type === 'admin' && user.role === 'super_admin') {
        // Super admin has all permissions
        return true;
      }

      // For regular admins, check if they have the required permissions
      if (user.type === 'admin') {
        const adminPermissions = (user as any).permissions || [];
        
        // Check if admin has all required permissions
        const hasAllPermissions = requiredPermissions.every((permission) =>
          adminPermissions.includes(permission),
        );

        if (!hasAllPermissions) {
          throw new ForbiddenException(
            `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
          );
        }
      } else {
        throw new ForbiddenException('Admin permissions required');
      }
    }

    return true;
  }
}


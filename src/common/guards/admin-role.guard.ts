import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { role?: string } }>();

    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (request.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin role required');
    }

    return true;
  }
}

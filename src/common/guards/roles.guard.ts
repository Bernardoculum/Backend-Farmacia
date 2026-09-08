import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<(Role | string)[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si la ruta no especifica decorador @Roles(), cualquier usuario autenticado puede entrar
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.rol) {
      throw new ForbiddenException(
        'Acceso denegado: No se encontró información de roles para este usuario',
      );
    }

    // Regla de Oro: SUPER_ADMIN tiene acceso total a cualquier recurso
    if (user.rol === Role.SUPER_ADMIN || user.rol === 'SUPER_ADMIN') {
      return true;
    }

    // Verificar si el rol del usuario está dentro de los roles permitidos
    const hasRole = requiredRoles.includes(user.rol);
    if (!hasRole) {
      throw new ForbiddenException(
        `Acceso denegado: Se requiere uno de los siguientes roles: [${requiredRoles.join(
          ', ',
        )}]. Tu rol actual es: ${user.rol}`,
      );
    }

    return true;
  }
}

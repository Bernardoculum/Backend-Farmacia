import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { BranchScopeService } from './branch-scope.service';
import { BranchScopeContext } from './branch-scope.types';

/**
 * Decorador de parámetro que inyecta el contexto de alcance por sucursal resuelto.
 *
 * Ejemplo de uso en controlador:
 *   @Get()
 *   findAll(@Query() filters: FilterDto, @BranchScope() scope: BranchScopeContext) {
 *     filters.sucursalId = scope.effectiveSucursalId;
 *     return this.service.findAll(filters, scope);
 *   }
 */
export const BranchScope = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): BranchScopeContext => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Detectar si la petición intentó solicitar una sucursal específica en query o body
    const requestedId =
      request.query?.sucursalId ||
      request.body?.sucursalId ||
      request.params?.sucursalId;

    return BranchScopeService.createScope(user, requestedId);
  },
);

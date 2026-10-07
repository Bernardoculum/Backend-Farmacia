import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { BranchScopeService } from './branch-scope.service';

/**
 * Interceptor global de blindaje de sucursales.
 * Se asegura de que cualquier usuario sin acceso global tenga sus parámetros
 * de sucursal (en query o body) automáticamente forzados a su sede asignada.
 */
@Injectable()
export class BranchScopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    if (user) {
      const requestedId =
        request.query?.sucursalId ||
        request.body?.sucursalId ||
        request.params?.sucursalId;

      const scope = BranchScopeService.createScope(user, requestedId);
      request.branchScope = scope;

      // Si el usuario no tiene acceso global, forzar / clampar sucursalId en query y body
      if (!scope.isGlobal && scope.effectiveSucursalId) {
        if (request.query && typeof request.query === 'object') {
          if ('sucursalId' in request.query) {
            request.query.sucursalId = scope.effectiveSucursalId;
          }
        }

        if (request.body && typeof request.body === 'object') {
          if (Array.isArray(request.body)) {
            request.body.forEach((item: any) => {
              if (item && typeof item === 'object' && 'sucursalId' in item) {
                item.sucursalId = scope.effectiveSucursalId;
              }
            });
          } else if ('sucursalId' in request.body) {
            request.body.sucursalId = scope.effectiveSucursalId;
          }
        }
      }
    }

    return next.handle();
  }
}

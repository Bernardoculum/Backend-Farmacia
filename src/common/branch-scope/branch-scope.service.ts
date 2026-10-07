import { Injectable, ForbiddenException } from '@nestjs/common';
import { Role } from '../enums/role.enum';
import { RequestUser, BranchScopeContext } from './branch-scope.types';

@Injectable()
export class BranchScopeService {
  /**
   * Determina de forma unificada si un usuario tiene autorización para ver
   * o consultar datos consolidados de todas las sucursales.
   * Regla Inmutable:
   *  - SUPER_ADMIN: Global
   *  - AUDITOR: Global (solo consulta)
   *  - GERENTE_SUCURSAL de BODEGA_CENTRAL (o sucursalId = 1): Global
   *  - Cualquier otro usuario (Gerente satélite, Cajero, Call Center, etc.): Satélite / Local
   */
  static isGlobalAccess(user?: RequestUser | null): boolean {
    if (!user) return false;

    const rol = user.rol;
    if (rol === Role.SUPER_ADMIN || rol === 'SUPER_ADMIN') {
      return true;
    }

    if (rol === Role.AUDITOR || rol === 'AUDITOR') {
      return true;
    }

    return false;
  }

  /**
   * Resuelve el ID de sucursal efectivo para cualquier consulta.
   * Si el usuario no es global, CLAMPA forzosamente el ID a su sucursal asignada.
   */
  static resolveEffectiveBranchId(
    user?: RequestUser | null,
    requestedBranchId?: number | string | null,
  ): number | undefined {
    if (!user) return undefined;

    if (this.isGlobalAccess(user)) {
      return requestedBranchId ? Number(requestedBranchId) : undefined;
    }

    // Usuario local/satélite: Inmutablemente restringido a su propia sede
    return user.sucursalId ? Number(user.sucursalId) : undefined;
  }

  /**
   * Valida que un usuario no intente realizar operaciones (crear, trasladar, dar de baja, despachar)
   * en una sede que no es la suya si no tiene permisos globales.
   */
  static assertBranchAccess(
    user: RequestUser | null | undefined,
    targetBranchId: number | string | null | undefined,
    actionName = 'operación',
  ): void {
    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    if (this.isGlobalAccess(user)) {
      return; // Autorizado para operar en cualquier sede
    }

    const userSucId = Number(user.sucursalId);
    const targetSucId = Number(targetBranchId);

    if (!userSucId || userSucId !== targetSucId) {
      throw new ForbiddenException(
        `Acceso Denegado: No tienes autorización para ejecutar esta ${actionName} en una sucursal distinta a la asignada (#${userSucId}).`,
      );
    }
  }

  /**
   * Construye el contexto completo de alcance para una petición.
   */
  static createScope(
    user?: RequestUser | null,
    requestedBranchId?: number | string | null,
  ): BranchScopeContext {
    const isGlobal = this.isGlobalAccess(user);
    const userSucursalId = user?.sucursalId ? Number(user.sucursalId) : null;
    const effectiveSucursalId = this.resolveEffectiveBranchId(user, requestedBranchId);

    return {
      isGlobal,
      userSucursalId,
      tipoSucursal: user?.tipoSucursal ?? null,
      effectiveSucursalId,
      userRol: (user?.rol as string) || 'UNKNOWN',
    };
  }

  /**
   * Helper unificado para aplicar la condición de sucursal en un QueryBuilder de TypeORM.
   */
  static applyBranchFilter(
    qb: any,
    columnAlias: string,
    scope: BranchScopeContext,
  ): void {
    if (scope.effectiveSucursalId) {
      qb.andWhere(`${columnAlias} = :scopedBranchId`, {
        scopedBranchId: scope.effectiveSucursalId,
      });
    }
  }
}

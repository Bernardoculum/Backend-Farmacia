import { Role } from '../enums/role.enum';

export interface RequestUser {
  credencialId?: number;
  username?: string;
  empleadoId?: number;
  nombreCompleto?: string;
  rol?: Role | string;
  sucursalId?: number | null;
  tipoSucursal?: string | null;
}

export class BranchScopeContext {
  /**
   * Indica si el usuario tiene visión global de toda la cadena
   * (SUPER_ADMIN, AUDITOR o GERENTE_SUCURSAL de BODEGA_CENTRAL / Sede 1)
   */
  isGlobal: boolean;

  /**
   * ID de la sucursal asignada físicamente en el contrato del usuario
   */
  userSucursalId: number | null;

  /**
   * Tipo de sucursal del usuario (BODEGA_CENTRAL, FARMACIA, STAND)
   */
  tipoSucursal: string | null;

  /**
   * ID de sucursal efectivo a aplicar en la consulta.
   * Si el usuario es satélite, SIEMPRE es igual a userSucursalId (imposible de manipular).
   * Si es global, es el ID solicitado opcional o undefined si consulta toda la red.
   */
  effectiveSucursalId: number | undefined;

  /**
   * Rol del usuario
   */
  userRol: string;
}

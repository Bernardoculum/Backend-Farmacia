import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { DateRangeDto } from './dto/reportes.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { BranchScope, BranchScopeContext } from '../../common/branch-scope';

@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('dashboard')
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL, Role.AUDITOR)
  async getDashboard(
    @Query() filters: DateRangeDto,
    @BranchScope() scope: BranchScopeContext,
  ) {
    if (!scope.isGlobal) {
      filters.sucursalId = scope.effectiveSucursalId;
    }
    return this.reportesService.getExecutiveDashboard(filters);
  }

  @Get('ventas-sucursales')
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL, Role.AUDITOR)
  async getVentasPorSucursal(
    @Query() filters: DateRangeDto,
    @BranchScope() scope: BranchScopeContext,
  ) {
    if (!scope.isGlobal) {
      filters.sucursalId = scope.effectiveSucursalId;
    }
    return this.reportesService.getVentasPorSucursal(filters);
  }

  @Get('top-medicamentos')
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL, Role.AUDITOR)
  async getTopMedicamentos(
    @Query('limit') limit?: number,
    @BranchScope() scope?: BranchScopeContext,
  ) {
    return this.reportesService.getTopMedicamentos(
      limit ? Number(limit) : 10,
      scope?.effectiveSucursalId,
    );
  }

  @Get('alertas-inventario')
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL, Role.AUDITOR)
  async getAlertasInventario(@BranchScope() scope?: BranchScopeContext) {
    return this.reportesService.getAlertasInventario(scope?.effectiveSucursalId);
  }
}

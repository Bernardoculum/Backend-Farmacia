import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlanillasService } from './planillas.service';
import {
  GenerarPlanillaDto,
  CreateEmpleadoDto,
  UpdateEmpleadoDto,
  FilterPlanillaDto,
  DesembolsarPlanillaDto,
} from './dto/planilla.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

import { BranchScope, BranchScopeContext } from '../../common/branch-scope';

@ApiTags('Recursos Humanos & Planillas')
@ApiBearerAuth('JWT-auth')
@Controller('planillas')
@UseGuards(JwtAuthGuard)
export class PlanillasController {
  constructor(private readonly planillasService: PlanillasService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.AUDITOR, Role.GERENTE_SUCURSAL)
  @ApiOperation({ summary: 'Listar planillas quincenales y mensuales' })
  findAllPlanillas(
    @Query() filters: FilterPlanillaDto,
    @BranchScope() scope: BranchScopeContext,
  ) {
    if (!scope.isGlobal && scope.effectiveSucursalId) {
      filters.sucursalId = scope.effectiveSucursalId;
    }
    return this.planillasService.findAllPlanillas(filters);
  }

  @Get('empleados')
  @ApiOperation({ summary: 'Listar colaboradores de la red farmacéutica o sucursal' })
  findAllEmpleados(@BranchScope() scope: BranchScopeContext) {
    return this.planillasService.findAllEmpleados(scope.effectiveSucursalId);
  }

  @Post('empleados')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({ summary: 'Registrar un nuevo colaborador' })
  createEmpleado(
    @Body() dto: CreateEmpleadoDto,
    @BranchScope() scope: BranchScopeContext,
  ) {
    if (!scope.isGlobal && scope.effectiveSucursalId) {
      dto.sucursalId = scope.effectiveSucursalId;
    }
    return this.planillasService.createEmpleado(dto);
  }

  @Put('empleados/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({ summary: 'Actualizar información del colaborador y salario' })
  updateEmpleado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmpleadoDto,
    @BranchScope() scope: BranchScopeContext,
  ) {
    return this.planillasService.updateEmpleado(id, dto, scope.effectiveSucursalId);
  }

  @Patch('empleados/:id/estado')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({ summary: 'Cambiar estado operativo del colaborador (Baja laboral / Reactivación)' })
  toggleEstadoEmpleado(
    @Param('id', ParseIntPipe) id: number,
    @BranchScope() scope: BranchScopeContext,
    @Body('estado') estado?: string,
  ) {
    return this.planillasService.toggleEstadoEmpleado(id, estado, scope.effectiveSucursalId);
  }

  @Get('puestos')
  @ApiOperation({ summary: 'Listar catálogo de puestos' })
  findAllPuestos() {
    return this.planillasService.findAllPuestos();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.AUDITOR, Role.GERENTE_SUCURSAL)
  @ApiOperation({ summary: 'Consultar detalle de una planilla con boletas individuales' })
  findOnePlanilla(
    @Param('id', ParseIntPipe) id: number,
    @BranchScope() scope: BranchScopeContext,
  ) {
    return this.planillasService.findOnePlanilla(id, scope);
  }

  @Post('generar')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({ summary: 'Generar planilla atómica para colaboradores' })
  generarPlanilla(
    @Body() dto: GenerarPlanillaDto,
    @BranchScope() scope: BranchScopeContext,
  ) {
    if (!scope.isGlobal && scope.effectiveSucursalId) {
      dto.sucursalId = scope.effectiveSucursalId;
    }
    return this.planillasService.generarPlanilla(dto);
  }

  @Post(':id/pagar')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({ summary: 'Marcar planilla como PAGADA con origen de fondos y referencia' })
  pagarPlanilla(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DesembolsarPlanillaDto,
    @BranchScope() scope: BranchScopeContext,
  ) {
    return this.planillasService.pagarPlanilla(id, dto, scope);
  }
}

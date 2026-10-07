import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ActivosService } from './activos.service';
import {
  CreateActivoDto,
  TrasladoActivoDto,
  BajaActivoDto,
  FilterActivoDto,
} from './dto/activo.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { BranchScope, BranchScopeContext } from '../../common/branch-scope';

@ApiTags('Activos Fijos & Equipamiento')
@ApiBearerAuth('JWT-auth')
@Controller('activos')
@UseGuards(JwtAuthGuard)
export class ActivosController {
  constructor(private readonly activosService: ActivosService) {}

  @Get()
  @ApiOperation({ summary: 'Listar activos fijos con paginación server-side y métricas' })
  findAllActivos(
    @Query() filters: FilterActivoDto,
    @BranchScope() scope: BranchScopeContext,
  ) {
    if (!scope.isGlobal) {
      filters.sucursalId = scope.effectiveSucursalId;
    }
    return this.activosService.findAllActivos(filters);
  }

  @Get('categorias')
  @ApiOperation({ summary: 'Listar catálogo de categorías de activos' })
  findAllCategorias() {
    return this.activosService.findAllCategorias();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalle de un activo con su historial de movimientos' })
  findOneActivo(@Param('id', ParseIntPipe) id: number) {
    return this.activosService.findOneActivo(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({ summary: 'Registrar un nuevo activo fijo' })
  createActivo(
    @Body() dto: CreateActivoDto,
    @BranchScope() scope: BranchScopeContext,
  ) {
    if (!scope.isGlobal && scope.effectiveSucursalId) {
      dto.sucursalId = scope.effectiveSucursalId;
    }
    return this.activosService.createActivo(dto);
  }

  @Post(':id/traslado')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({ summary: 'Trasladar un activo a otra sucursal con asiento en historial' })
  trasladarActivo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TrasladoActivoDto,
  ) {
    return this.activosService.trasladarActivo(id, dto);
  }

  @Post(':id/baja')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({ summary: 'Dar de baja definitiva a un activo fijo' })
  bajaActivo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BajaActivoDto,
  ) {
    return this.activosService.bajaActivo(id, dto);
  }
}

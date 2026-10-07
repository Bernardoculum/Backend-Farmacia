import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CajasService } from './cajas.service';
import { AbrirSesionDto } from './dto/abrir-sesion.dto';
import { CerrarSesionDto } from './dto/cerrar-sesion.dto';
import { CreateMovimientoCajaDto } from './dto/create-movimiento-caja.dto';
import { FilterSesionCajaDto } from './dto/filter-sesion-caja.dto';
import { CreateCajaDto } from './dto/create-caja.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { BranchScope, BranchScopeContext } from '../../common/branch-scope';

@ApiTags('Cajas & Control de Arqueo')
@ApiBearerAuth('JWT-auth')
@Controller('cajas')
@UseGuards(JwtAuthGuard)
export class CajasController {
  constructor(private readonly cajasService: CajasService) {}

  @Get()
  @ApiOperation({ summary: 'Listar terminales de cobro / cajas físicas con estado y disponibilidad' })
  findAllCajas(
    @BranchScope() scope: BranchScopeContext,
  ) {
    return this.cajasService.findAllCajas(scope.effectiveSucursalId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({ summary: 'Registrar una nueva terminal de caja física' })
  createCaja(@Body() dto: CreateCajaDto) {
    return this.cajasService.createCaja(dto);
  }

  @Get('sesiones')
  @ApiOperation({
    summary: 'Listar turnos y sesiones de caja con paginación server-side y cálculo de arqueo/KPIs',
  })
  findAllSesiones(
    @Query() filters: FilterSesionCajaDto,
    @BranchScope() scope: BranchScopeContext,
  ) {
    if (!scope.isGlobal) {
      filters.sucursalId = scope.effectiveSucursalId;
    }
    return this.cajasService.findAllSesiones(filters);
  }

  @Get('sesiones/:id')
  @ApiOperation({ summary: 'Consultar detalle completo de una sesión de caja con sus movimientos y métodos de pago' })
  findOneSesion(@Param('id', ParseIntPipe) id: number) {
    return this.cajasService.findOneSesion(id);
  }

  @Post('sesiones/apertura')
  @ApiOperation({ summary: 'Apertura de turno de caja con fondo inicial' })
  abrirSesion(@Body() dto: AbrirSesionDto, @Req() req: any) {
    return this.cajasService.abrirSesion(dto, req.user);
  }

  @Post('sesiones/:id/movimientos')
  @ApiOperation({ summary: 'Registrar movimiento manual de caja chica (Ingreso / Egreso menor)' })
  registrarMovimiento(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateMovimientoCajaDto,
    @Req() req: any,
  ) {
    return this.cajasService.registrarMovimiento(id, dto, req.user);
  }

  @Post('sesiones/:id/cierre')
  @ApiOperation({ summary: 'Cierre de turno y arqueo de caja con cálculo de sobrante/faltante' })
  cerrarSesion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CerrarSesionDto,
    @Req() req: any,
  ) {
    return this.cajasService.cerrarSesion(id, dto, req.user);
  }
}

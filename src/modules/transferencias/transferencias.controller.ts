import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TransferenciasService } from './transferencias.service';
import { CreateTransferenciaDto } from './dto/create-transferencia.dto';
import { DespacharTransferenciaDto } from './dto/despachar-transferencia.dto';
import { RecibirTransferenciaDto } from './dto/recibir-transferencia.dto';
import { FilterTransferenciaDto } from './dto/filter-transferencia.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { BranchScope, BranchScopeContext } from '../../common/branch-scope';

@ApiTags('Transferencias entre Sucursales')
@ApiBearerAuth('JWT-auth')
@Controller('transferencias')
@UseGuards(JwtAuthGuard)
export class TransferenciasController {
  constructor(private readonly transferenciasService: TransferenciasService) {}

  @Get()
  @ApiOperation({
    summary:
      'Listar transferencias con filtros y paginación en servidor (OFFSET / FETCH) y cálculo de KPIs',
  })
  findAll(
    @Query() filterDto: FilterTransferenciaDto,
    @BranchScope() scope: BranchScopeContext,
  ) {
    if (!scope.isGlobal) {
      filterDto.sucursalId = scope.effectiveSucursalId;
    }
    return this.transferenciasService.findAll(filterDto);
  }

  @Get('lotes-disponibles')
  @ApiOperation({
    summary:
      'Obtener lotes disponibles para transferir desde una sucursal origen especificada',
  })
  getLotesDisponibles(@Query('sucursalId') sucursalId?: number) {
    return this.transferenciasService.getLotesDisponiblesOrigen(
      sucursalId ? Number(sucursalId) : 1,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle completo de una transferencia con sus medicamentos y lotes' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.transferenciasService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({
    summary: 'Registrar una nueva solicitud de transferencia (Transacción Atómica)',
  })
  create(
    @Body() createDto: CreateTransferenciaDto,
    @BranchScope() scope: BranchScopeContext,
  ) {
    // Si es gerente satélite, el destino SIEMPRE es su sucursal
    if (!scope.isGlobal && scope.effectiveSucursalId) {
      createDto.sucursalDestinoId = scope.effectiveSucursalId;
    }
    return this.transferenciasService.crearTransferencia(createDto);
  }

  @Patch(':id/enviar')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({
    summary:
      'Despachar transferencia (cambia a EN_TRANSITO, descuenta stock de origen y genera Kardex de Salida)',
  })
  despachar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DespacharTransferenciaDto,
  ) {
    return this.transferenciasService.despacharTransferencia(id, dto);
  }

  @Patch(':id/recibir')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({
    summary:
      'Confirmar recepción física en destino (cambia a RECIBIDA, suma stock a destino y genera Kardex de Entrada)',
  })
  recibir(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecibirTransferenciaDto,
  ) {
    return this.transferenciasService.recibirTransferencia(id, dto);
  }

  @Patch(':id/cancelar')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({ summary: 'Cancelar una transferencia no despachada' })
  cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Body('motivo') motivo?: string,
  ) {
    return this.transferenciasService.cancelarTransferencia(id, motivo);
  }
}

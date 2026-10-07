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
import { LotesService } from './lotes.service';
import { CreateLoteDto } from './dto/create-lote.dto';
import { UpdateLoteDto } from './dto/update-lote.dto';
import { FilterLoteDto } from './dto/filter-lote.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { BranchScope, BranchScopeContext } from '../../common/branch-scope';

@ApiTags('Lotes & Control de Vencimientos')
@ApiBearerAuth('JWT-auth')
@Controller('lotes')
@UseGuards(JwtAuthGuard)
export class LotesController {
  constructor(private readonly lotesService: LotesService) {}

  @Get()
  @ApiOperation({
    summary:
      'Listar todos los lotes con cálculo dinámico de caducidad y existencias',
  })
  findAll(
    @Query() filterDto: FilterLoteDto,
    @BranchScope() scope: BranchScopeContext,
  ) {
    if (!scope.isGlobal) {
      filterDto.sucursalId = scope.effectiveSucursalId;
    }
    return this.lotesService.findAll(filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalle de un lote con su desglose por sucursales' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @BranchScope() scope: BranchScopeContext,
  ) {
    return this.lotesService.findOne(id, scope.effectiveSucursalId);
  }

  @Post('batch')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({
    summary:
      'Registrar recepción múltiple de medicamentos y lotes (con entrada a Kardex y total invertido)',
  })
  createBatch(
    @Body() items: CreateLoteDto[],
    @BranchScope() scope: BranchScopeContext,
  ) {
    if (!scope.isGlobal && scope.effectiveSucursalId) {
      items.forEach((item) => {
        item.sucursalId = scope.effectiveSucursalId;
      });
    }
    return this.lotesService.createBatch(items);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({
    summary:
      'Crear un nuevo lote para un medicamento (con stock inicial opcional en Kardex)',
  })
  create(
    @Body() createDto: CreateLoteDto,
    @BranchScope() scope: BranchScopeContext,
  ) {
    if (!scope.isGlobal && scope.effectiveSucursalId) {
      createDto.sucursalId = scope.effectiveSucursalId;
    }
    return this.lotesService.create(createDto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({ summary: 'Modificar fecha de vencimiento o costo de un lote' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateLoteDto,
  ) {
    return this.lotesService.update(id, updateDto);
  }

  @Post(':id/dar-de-baja')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({ summary: 'Dar de baja un lote caducado / merma sanitaria con asiento en Kardex' })
  darDeBaja(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { motivo?: string; sucursalId?: number },
    @BranchScope() scope: BranchScopeContext,
  ) {
    const sucursalId = scope.isGlobal ? body?.sucursalId : scope.effectiveSucursalId;
    return this.lotesService.darDeBajaLote(id, body?.motivo, sucursalId);
  }
}

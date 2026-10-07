import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { KardexService } from './kardex.service';
import { FilterKardexDto, FilterAuditoriaDto } from './dto/filter-kardex.dto';
import { AjusteInventarioDto } from './dto/ajuste-inventario.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { BranchScope, BranchScopeContext } from '../../common/branch-scope';

@ApiTags('Kardex & Auditoría Operativa')
@ApiBearerAuth('JWT-auth')
@Controller('kardex')
@UseGuards(JwtAuthGuard)
export class KardexController {
  constructor(private readonly kardexService: KardexService) {}

  @Get()
  @ApiOperation({
    summary:
      'Consultar libro mayor de Kardex con trazabilidad completa (Entradas, Salidas, Mermas y Ajustes)',
  })
  findAllMovimientos(
    @Query() filters: FilterKardexDto,
    @BranchScope() scope: BranchScopeContext,
  ) {
    if (!scope.isGlobal) {
      filters.sucursalId = scope.effectiveSucursalId;
    }
    return this.kardexService.findAllMovimientos(filters);
  }

  @Get('auditoria-eventos')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.AUDITOR)
  @ApiOperation({ summary: 'Consultar bitácora de auditoría forense de eventos del sistema' })
  findAllAuditoria(@Query() filters: FilterAuditoriaDto) {
    return this.kardexService.findAllAuditoria(filters);
  }

  @Post('ajuste')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({ summary: 'Registrar un ajuste manual justificado de inventario con asiento en Kardex' })
  registrarAjuste(@Body() dto: AjusteInventarioDto, @Req() req: any) {
    return this.kardexService.registrarAjuste(dto, req.user);
  }
}

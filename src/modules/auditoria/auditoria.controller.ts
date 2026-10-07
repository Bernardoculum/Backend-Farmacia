import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditoriaService } from './auditoria.service';
import { FilterAuditoriaDto } from './dto/filter-auditoria.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Seguridad & Auditoría Forense')
@ApiBearerAuth('JWT-auth')
@Controller('auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.AUDITOR)
  @ApiOperation({ summary: 'Consultar bitácora forense de eventos con paginación y filtros' })
  findAll(@Query() filters: FilterAuditoriaDto) {
    return this.auditoriaService.findAll(filters);
  }

  @Get('catalogos')
  @Roles(Role.SUPER_ADMIN, Role.AUDITOR)
  @ApiOperation({ summary: 'Obtener tablas, operaciones y usuarios registrados para filtros' })
  getCatalogos() {
    return this.auditoriaService.getCatalogosFiltros();
  }
}

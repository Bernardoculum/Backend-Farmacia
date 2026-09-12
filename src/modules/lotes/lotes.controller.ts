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

@ApiTags('Lotes & Control de Vencimientos')
@ApiBearerAuth('JWT-auth')
@Controller('lotes')
@UseGuards(JwtAuthGuard)
export class LotesController {
  constructor(private readonly lotesService: LotesService) {}

  @Get()
  @ApiOperation({
    summary:
      'Listar todos los lotes con cálculo dinámico de caducidad (VIGENTE, POR_VENCER, VENCIDO) y existencias',
  })
  findAll(@Query() filterDto: FilterLoteDto) {
    return this.lotesService.findAll(filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalle de un lote con su desglose por sucursales' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.lotesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({
    summary:
      'Crear un nuevo lote para un medicamento (con stock inicial opcional en Kardex)',
  })
  create(@Body() createDto: CreateLoteDto) {
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
}

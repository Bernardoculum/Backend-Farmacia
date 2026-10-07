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
import { SucursalesService } from './sucursales.service';
import { CreateSucursalDto } from './dto/create-sucursal.dto';
import { UpdateSucursalDto } from './dto/update-sucursal.dto';
import { FilterSucursalDto } from './dto/filter-sucursal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Sucursales & Puntos de Distribución')
@ApiBearerAuth('JWT-auth')
@Controller('sucursales')
@UseGuards(JwtAuthGuard)
export class SucursalesController {
  constructor(private readonly sucursalesService: SucursalesService) {}

  @Get('lista')
  @ApiOperation({ summary: 'Obtener lista ligera de sucursales para selectores/combos' })
  findAllList() {
    return this.sucursalesService.findAllList();
  }

  @Get()
  @ApiOperation({ summary: 'Listar sucursales con filtros y paginación en servidor (OFFSET / FETCH)' })
  findAll(@Query() filterDto: FilterSucursalDto) {
    return this.sucursalesService.findAll(filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una sucursal específica' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sucursalesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Registrar una nueva sucursal (Solo Administrador)' })
  create(@Body() createDto: CreateSucursalDto) {
    return this.sucursalesService.create(createDto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Actualizar datos de una sucursal (Solo Administrador)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateSucursalDto,
  ) {
    return this.sucursalesService.update(id, updateDto);
  }
}

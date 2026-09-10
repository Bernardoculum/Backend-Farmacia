import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductosService } from './productos.service';
import { KardexService } from './kardex.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { FilterProductoDto } from './dto/filter-producto.dto';
import { MovimientoKardexDto } from './dto/movimiento-kardex.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Productos & Kardex')
@ApiBearerAuth('JWT-auth')
@Controller('productos')
@UseGuards(JwtAuthGuard)
export class ProductosController {
  constructor(
    private readonly productosService: ProductosService,
    private readonly kardexService: KardexService,
  ) {}

  // 1. Listar productos con filtros y paginación
  @Get()
  @ApiOperation({ summary: 'Listar medicamentos con filtros (búsqueda, categoría, laboratorio) y paginación' })
  findAll(@Query() filterDto: FilterProductoDto) {
    return this.productosService.findAll(filterDto);
  }

  // 2. Detalle de un producto con sus lotes y stock
  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalle de un producto con sus lotes y stock por sucursal' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productosService.findOne(id);
  }

  // 3. Crear nuevo producto (solo administradores o gerentes)
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({ summary: 'Registrar un nuevo producto en el catálogo (SUPER_ADMIN o GERENTE)' })
  create(@Body() createDto: CreateProductoDto) {
    return this.productosService.create(createDto);
  }

  // 4. Actualizar producto existente (solo administradores o gerentes)
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({ summary: 'Modificar datos o precios de un producto (SUPER_ADMIN o GERENTE)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateProductoDto,
  ) {
    return this.productosService.update(id, updateDto);
  }

  // 5. Desactivar producto (baja lógica, solo SUPER_ADMIN)
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Desactivar producto (baja lógica, solo SUPER_ADMIN)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productosService.remove(id);
  }

  // 6. Consultar el Kardex histórico de un producto
  @Get(':id/kardex')
  @ApiOperation({ summary: 'Consultar bitácora histórica de movimientos de Kardex con saldos' })
  getKardex(
    @Param('id', ParseIntPipe) id: number,
    @Query('sucursalId') sucursalId?: string,
  ) {
    const sucursalNum = sucursalId ? Number(sucursalId) : undefined;
    return this.kardexService.getKardexByProducto(id, sucursalNum);
  }

  // 7. Registrar un movimiento de Kardex (Entrada, Salida, Ajuste)
  @Post('kardex/movimiento')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({ summary: 'Registrar movimiento transaccional en Kardex (Entrada, Salida o Ajuste)' })
  registrarMovimiento(@Body() dto: MovimientoKardexDto) {
    return this.kardexService.registrarMovimiento(dto);
  }
}

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
import { PedidosService } from './pedidos.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateEstadoPedidoDto } from './dto/update-estado-pedido.dto';
import { FilterPedidoDto } from './dto/filter-pedido.dto';
import { EvaluarDespachoDto } from './dto/evaluar-despacho.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Ventas & Pedidos (POS y Call Center)')
@ApiBearerAuth('JWT-auth')
@Controller('pedidos')
@UseGuards(JwtAuthGuard)
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL, Role.CAJERO, Role.CALL_CENTER)
  @ApiOperation({
    summary:
      'Registrar una nueva venta de mostrador (POS) o pedido telefónico a domicilio (Call Center)',
  })
  crear(@Body() createDto: CreatePedidoDto) {
    return this.pedidosService.crearPedido(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar pedidos y ventas con filtros (origen, sucursal, estado) y paginación' })
  findAll(@Query() filterDto: FilterPedidoDto) {
    return this.pedidosService.findAll(filterDto);
  }

  @Get('aux/clientes')
  @ApiOperation({ summary: 'Buscar clientes por número de teléfono, nombre o NIT para auto-completar' })
  buscarClientes(@Query('termino') termino?: string) {
    return this.pedidosService.buscarClientes(termino || '');
  }

  @Post('aux/clientes')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL, Role.CAJERO, Role.CALL_CENTER)
  @ApiOperation({ summary: 'Registrar un nuevo cliente de forma rápida desde Call Center o Mostrador' })
  crearCliente(@Body() clienteDto: CreateClienteDto) {
    return this.pedidosService.crearCliente(clienteDto);
  }

  @Get('aux/metodos-pago')
  @ApiOperation({ summary: 'Obtener la lista de métodos de pago activos' })
  obtenerMetodosPago() {
    return this.pedidosService.obtenerMetodosPago();
  }

  @Post('evaluar-despacho')
  @ApiOperation({
    summary:
      'Evaluación inteligente de despacho Call Center: calcula distancias Haversine, stock en cada farmacia y tiempo estimado (ETA)',
  })
  evaluarDespacho(@Body() dto: EvaluarDespachoDto) {
    return this.pedidosService.evaluarDespacho(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalle de un pedido con comprobante y datos de entrega' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pedidosService.findOne(id);
  }

  @Patch(':id/estado')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL, Role.CAJERO, Role.CALL_CENTER)
  @ApiOperation({ summary: 'Actualizar estado del pedido o entrega (EN_CAMINO, ENTREGADO, CANCELADO)' })
  actualizarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadoPedidoDto,
  ) {
    return this.pedidosService.actualizarEstado(id, dto);
  }
}

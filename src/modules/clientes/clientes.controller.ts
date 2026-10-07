import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClientesService } from './clientes.service';
import {
  CreateClienteDto,
  UpdateClienteDto,
  FilterClienteDto,
  CreateLaboratorioDto,
  UpdateLaboratorioDto,
} from './dto/cliente.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Clientes & Laboratorios')
@ApiBearerAuth('JWT-auth')
@Controller('clientes')
@UseGuards(JwtAuthGuard)
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar clientes con paginación server-side y filtros' })
  findAllClientes(@Query() filters: FilterClienteDto) {
    return this.clientesService.findAllClientes(filters);
  }

  @Get('laboratorios')
  @ApiOperation({ summary: 'Listar catálogo de laboratorios farmacéuticos' })
  findAllLaboratorios() {
    return this.clientesService.findAllLaboratorios();
  }

  @Post('laboratorios')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Registrar un nuevo laboratorio (solo SUPER_ADMIN)' })
  createLaboratorio(@Body() dto: CreateLaboratorioDto) {
    return this.clientesService.createLaboratorio(dto);
  }

  @Put('laboratorios/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Actualizar datos de un laboratorio (solo SUPER_ADMIN)' })
  updateLaboratorio(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLaboratorioDto,
  ) {
    return this.clientesService.updateLaboratorio(id, dto);
  }

  @Patch('laboratorios/:id/estado')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Dar de baja o reactivar un laboratorio (solo SUPER_ADMIN)' })
  toggleEstadoLaboratorio(
    @Param('id', ParseIntPipe) id: number,
    @Body('estado') estado?: string,
  ) {
    return this.clientesService.toggleEstadoLaboratorio(id, estado);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalle del cliente y sus últimos pedidos' })
  findOneCliente(@Param('id', ParseIntPipe) id: number) {
    return this.clientesService.findOneCliente(id);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar un nuevo cliente / paciente' })
  createCliente(@Body() dto: CreateClienteDto) {
    return this.clientesService.createCliente(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos de un cliente' })
  updateCliente(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClienteDto,
  ) {
    return this.clientesService.updateCliente(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({ summary: 'Desactivar un cliente' })
  desactivarCliente(@Param('id', ParseIntPipe) id: number) {
    return this.clientesService.desactivarCliente(id);
  }
}

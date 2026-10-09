import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, FilterUserDto, ChangePasswordDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BranchScope, BranchScopeContext } from '../../common/branch-scope';

@ApiTags('Usuarios & Seguridad')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('roles')
  @ApiOperation({ summary: 'Catálogo de roles disponibles' })
  async getRoles() {
    return this.usersService.getRoles();
  }

  @Get('colaboradores-disponibles')
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL)
  @ApiOperation({ summary: 'Listado de colaboradores de nómina que aún no tienen credencial de acceso' })
  async getColaboradoresDisponibles(@BranchScope() scope: BranchScopeContext) {
    return this.usersService.getColaboradoresDisponibles(scope.isGlobal ? undefined : scope.effectiveSucursalId);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL, Role.AUDITOR)
  @ApiOperation({ summary: 'Listado paginado de usuarios con KPIs y filtros' })
  async findAll(
    @Query() filters: FilterUserDto,
    @BranchScope() scope: BranchScopeContext,
  ) {
    if (!scope.isGlobal) {
      filters.sucursalId = scope.effectiveSucursalId;
    }
    return this.usersService.findAll(filters);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.GERENTE_SUCURSAL, Role.AUDITOR)
  @ApiOperation({ summary: 'Consultar detalle de un usuario' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Crear nuevo usuario y credencial' })
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    const operador = user?.username || 'SUPER_ADMIN';
    return this.usersService.create(dto, operador);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Actualizar información de usuario y rol' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: any,
  ) {
    const operador = user?.username || 'SUPER_ADMIN';
    const operadorId = user?.credencialId;
    return this.usersService.update(id, dto, operador, operadorId);
  }

  @Patch(':id/estado')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Activar o desactivar cuenta de usuario' })
  async toggleEstado(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    const operador = user?.username || 'SUPER_ADMIN';
    const operadorId = user?.credencialId;
    return this.usersService.toggleEstado(id, operador, operadorId);
  }

  @Patch(':id/password')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Restablecer contraseña de usuario' })
  async changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: any,
  ) {
    const operador = user?.username || 'SUPER_ADMIN';
    return this.usersService.changePassword(id, dto, operador);
  }
}

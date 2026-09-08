import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión y obtener token JWT' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Consultar datos del usuario autenticado actual' })
  getProfile(@CurrentUser() user: any) {
    return user;
  }

  @Get('admin-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Ruta de prueba exclusiva para SUPER_ADMIN' })
  getAdminData(@CurrentUser() user: any) {
    return {
      message: '¡Acceso concedido al panel de administración!',
      operador: user.nombreCompleto || user.username,
      rol: user.rol,
    };
  }

  @Get('cajero-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CAJERO)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Ruta de prueba para rol CAJERO (y SUPER_ADMIN)' })
  getCajeroData(@CurrentUser() user: any) {
    return {
      message: '¡Acceso concedido a operaciones de caja!',
      operador: user.nombreCompleto || user.username,
      rol: user.rol,
    };
  }
}

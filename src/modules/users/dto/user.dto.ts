import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  MinLength,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @ApiProperty({ description: 'Nombres del colaborador', example: 'Carlos Alberto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString()
  nombre: string;

  @ApiProperty({ description: 'Apellidos del colaborador', example: 'Gómez Morales' })
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  @IsString()
  apellido: string;

  @ApiPropertyOptional({ description: 'Documento Personal de Identificación (DPI)', example: '2541987450101' })
  @IsOptional()
  @IsString()
  dpi?: string;

  @ApiPropertyOptional({ description: 'Teléfono de contacto', example: '55512345' })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({ description: 'Nombre de usuario para inicio de sesión', example: 'cgomez' })
  @IsNotEmpty({ message: 'El nombre de usuario es obligatorio' })
  @IsString()
  @MinLength(3, { message: 'El usuario debe tener al menos 3 caracteres' })
  username: string;

  @ApiProperty({ description: 'Contraseña de acceso', example: 'Password123' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @ApiProperty({ description: 'ID del rol asignado', example: 3 })
  @IsNotEmpty({ message: 'El rol es obligatorio' })
  @Type(() => Number)
  @IsNumber()
  rolId: number;

  @ApiProperty({ description: 'ID de la sucursal asignada', example: 1 })
  @IsNotEmpty({ message: 'La sucursal es obligatoria' })
  @Type(() => Number)
  @IsNumber()
  sucursalId: number;

  @ApiPropertyOptional({ description: 'ID del puesto laboral', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  puestoId?: number;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'Nombres del colaborador', example: 'Carlos Alberto' })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({ description: 'Apellidos del colaborador', example: 'Gómez Morales' })
  @IsOptional()
  @IsString()
  apellido?: string;

  @ApiPropertyOptional({ description: 'DPI del colaborador', example: '2541987450101' })
  @IsOptional()
  @IsString()
  dpi?: string;

  @ApiPropertyOptional({ description: 'Teléfono de contacto', example: '55512345' })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiPropertyOptional({ description: 'Nombre de usuario', example: 'cgomez' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  username?: string;

  @ApiPropertyOptional({ description: 'Nueva contraseña opcional' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ description: 'ID del rol asignado', example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rolId?: number;

  @ApiPropertyOptional({ description: 'ID de la sucursal asignada', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sucursalId?: number;

  @ApiPropertyOptional({ description: 'ID del puesto', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  puestoId?: number;

  @ApiPropertyOptional({ description: 'Estado del usuario', example: 'ACTIVO' })
  @IsOptional()
  @IsIn(['ACTIVO', 'INACTIVO'])
  estado?: string;
}

export class FilterUserDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Búsqueda por nombre, apellido, usuario o DPI' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtro por ID de rol' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rolId?: number;

  @ApiPropertyOptional({ description: 'Filtro por ID de sucursal' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sucursalId?: number;

  @ApiPropertyOptional({ description: 'Filtro por estado', example: 'ACTIVO' })
  @IsOptional()
  @IsString()
  estado?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Nueva contraseña', example: 'NuevaClave123' })
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria' })
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  newPassword: string;
}

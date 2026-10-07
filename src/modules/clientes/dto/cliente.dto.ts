import { IsNotEmpty, IsOptional, IsString, IsNumber, IsEmail, Min, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateClienteDto {
  @ApiProperty({ description: 'Nombres del cliente', example: 'Juan Carlos' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString()
  @Matches(/^(?!\s*\d+\s*$).+$/, {
    message: 'El nombre no puede estar compuesto únicamente por números (ej. 323)',
  })
  nombre: string;

  @ApiPropertyOptional({ description: 'Apellidos del cliente', example: 'Pérez López' })
  @IsOptional()
  @IsString()
  apellido?: string;

  @ApiProperty({ description: 'Teléfono de contacto principal', example: '55512345' })
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  @IsString()
  telefono: string;

  @ApiPropertyOptional({ description: 'Correo electrónico', example: 'juan.perez@email.com' })
  @IsOptional()
  @IsEmail({}, { message: 'El formato de correo no es válido' })
  email?: string;

  @ApiProperty({ description: 'Dirección de residencia o entrega', example: '12 Calle 4-55 Zona 10' })
  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  @IsString()
  @Matches(/^(?!\s*\d+\s*$).+$/, {
    message: 'La dirección no puede estar compuesta únicamente por números (ej. 323)',
  })
  direccion: string;

  @ApiPropertyOptional({ description: 'Referencia visual de entrega', example: 'Frente al parque central, casa portón verde' })
  @IsOptional()
  @IsString()
  referenciaDireccion?: string;

  @ApiPropertyOptional({ description: 'ID de municipio', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  municipioId?: number;

  @ApiPropertyOptional({ description: 'Coordenada de latitud', example: 14.634915 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitud?: number;

  @ApiPropertyOptional({ description: 'Coordenada de longitud', example: -90.506882 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitud?: number;
}

export class UpdateClienteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apellido?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenciaDireccion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  estado?: string;
}

export class FilterClienteDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit: number = 10;

  @ApiPropertyOptional({ description: 'Búsqueda por nombre, apellido, teléfono o dirección' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtrar por estado (ACTIVO, INACTIVO)' })
  @IsOptional()
  @IsString()
  estado?: string;
}

export class CreateLaboratorioDto {
  @ApiProperty({ description: 'Nombre del laboratorio o casa farmacéutica', example: 'Bayer Guatemala' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString()
  @Matches(/^(?!\s*\d+\s*$).+$/, {
    message: 'El nombre del laboratorio no puede estar compuesto únicamente por números (ej. 323)',
  })
  nombre: string;

  @ApiPropertyOptional({ description: 'Teléfono de contacto o planta', example: '23334455' })
  @IsOptional()
  @IsString()
  telefono?: string;
}

export class UpdateLaboratorioDto {
  @ApiPropertyOptional({ description: 'Nombre del laboratorio o casa farmacéutica', example: 'Bayer Guatemala' })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({ description: 'Teléfono de contacto o planta', example: '23334455' })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiPropertyOptional({ description: 'Estado del laboratorio', example: 'ACTIVO', enum: ['ACTIVO', 'INACTIVO'] })
  @IsOptional()
  @IsString()
  estado?: string;
}

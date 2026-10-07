import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCajaDto {
  @ApiProperty({ description: 'ID de la sucursal a la que pertenece la caja', example: 1 })
  @IsNotEmpty({ message: 'La sucursal es obligatoria' })
  @Type(() => Number)
  @IsNumber()
  sucursalId: number;

  @ApiProperty({ description: 'Código único identificador de la caja', example: 'CAJA-Z10-03' })
  @IsNotEmpty({ message: 'El código de caja es obligatorio' })
  @IsString()
  codigoCaja: string;

  @ApiPropertyOptional({ description: 'Descripción o ubicación física', example: 'Caja rápida autoservicio' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Estado operativo', default: 'ACTIVA', example: 'ACTIVA' })
  @IsOptional()
  @IsString()
  estado?: string;
}

export class UpdateCajaDto {
  @ApiPropertyOptional({ description: 'Descripción o ubicación física' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Estado operativo (ACTIVA, INACTIVA, MANTENIMIENTO)' })
  @IsOptional()
  @IsString()
  estado?: string;
}

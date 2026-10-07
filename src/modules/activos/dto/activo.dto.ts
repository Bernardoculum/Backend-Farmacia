import { IsNotEmpty, IsOptional, IsString, IsNumber, Min, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateActivoDto {
  @ApiProperty({ description: 'Código único de placa o activo', example: 'ACT-REF-001' })
  @IsNotEmpty({ message: 'El código de activo es obligatorio' })
  @IsString()
  codigoActivo: string;

  @ApiProperty({ description: 'Descripción o nombre del activo', example: 'Refrigerador Clínico de Vacunas 300L' })
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @IsString()
  @Matches(/^(?!\s*\d+\s*$).+$/, {
    message: 'La descripción no puede estar compuesta únicamente por números (ej. 323)',
  })
  descripcion: string;

  @ApiPropertyOptional({ example: 'Samsung / Biosafe' })
  @IsOptional()
  @IsString()
  marca?: string;

  @ApiPropertyOptional({ example: 'RF-300-MED' })
  @IsOptional()
  @IsString()
  modelo?: string;

  @ApiPropertyOptional({ example: 'SN-987654321' })
  @IsOptional()
  @IsString()
  numeroSerie?: string;

  @ApiProperty({ example: 12500 })
  @IsNotEmpty({ message: 'El valor de adquisición es obligatorio' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01, { message: 'El valor de adquisición debe ser mayor a 0' })
  valorAdquisicion: number;

  @ApiProperty({ example: 1 })
  @IsNotEmpty({ message: 'La categoría es obligatoria' })
  @Type(() => Number)
  @IsNumber()
  categoriaActivoId: number;

  @ApiProperty({ example: 1 })
  @IsNotEmpty({ message: 'La sucursal es obligatoria' })
  @Type(() => Number)
  @IsNumber()
  sucursalId: number;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @IsString()
  fechaAdquisicion?: string;
}

export class TrasladoActivoDto {
  @ApiProperty({ description: 'ID de la sucursal de destino', example: 2 })
  @IsNotEmpty({ message: 'La sucursal destino es obligatoria' })
  @Type(() => Number)
  @IsNumber()
  sucursalDestinoId: number;

  @ApiProperty({ description: 'Motivo del traslado', example: 'Reasignación de equipo por apertura de nuevo módulo de vacunas' })
  @IsNotEmpty({ message: 'El motivo del traslado es obligatorio' })
  @IsString()
  motivo: string;
}

export class BajaActivoDto {
  @ApiProperty({ description: 'Motivo de la baja definitiva', example: 'Daño irreparable en compresor / obsolescencia técnica' })
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @IsString()
  motivo: string;
}

export class FilterActivoDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sucursalId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  categoriaActivoId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  estado?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

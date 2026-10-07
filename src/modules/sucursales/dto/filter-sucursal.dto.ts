import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterSucursalDto {
  @ApiPropertyOptional({ description: 'Búsqueda por nombre o dirección' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de sucursal',
    enum: ['FARMACIA', 'STAND', 'BODEGA_CENTRAL'],
  })
  @IsOptional()
  @IsIn(['FARMACIA', 'STAND', 'BODEGA_CENTRAL'])
  tipoSucursal?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado operativo',
    enum: ['ACTIVA', 'INACTIVA'],
  })
  @IsOptional()
  @IsIn(['ACTIVA', 'INACTIVA'])
  estado?: string;

  @ApiPropertyOptional({ description: 'Página actual para paginación', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Cantidad de registros por página', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

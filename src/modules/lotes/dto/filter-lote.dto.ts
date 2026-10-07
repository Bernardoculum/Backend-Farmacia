import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterLoteDto {
  @ApiPropertyOptional({ description: 'Búsqueda por número de lote o nombre de producto' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de producto' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  productoId?: number;

  @ApiPropertyOptional({ description: 'Filtrar por ID de sucursal' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sucursalId?: number;

  @ApiPropertyOptional({
    description: 'Estado de caducidad',
    enum: ['TODOS', 'VIGENTE', 'POR_VENCER', 'VENCIDO'],
  })
  @IsOptional()
  @IsIn(['TODOS', 'VIGENTE', 'POR_VENCER', 'VENCIDO'])
  estadoVencimiento?: string;

  @ApiPropertyOptional({ description: 'Página actual para paginación', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Cantidad de registros por página', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;
}

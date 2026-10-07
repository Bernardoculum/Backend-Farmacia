import { IsOptional, IsNumber, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class FilterKardexDto {
  @ApiPropertyOptional({ description: 'Página', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: 'Límite por página', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit: number = 10;

  @ApiPropertyOptional({ description: 'Filtrar por producto / medicamento' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  productoId?: number;

  @ApiPropertyOptional({ description: 'Filtrar por sucursal' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sucursalId?: number;

  @ApiPropertyOptional({ description: 'Filtrar por tipo de movimiento (ENTRADA, SALIDA, AJUSTE, TRANSFERENCIA)' })
  @IsOptional()
  @IsString()
  tipoMovimiento?: string;

  @ApiPropertyOptional({ description: 'Filtrar por tipo de referencia (RECEPCION_FACTURA_COMPRA, VENTA_POS, MERMA_CADUCIDAD, etc.)' })
  @IsOptional()
  @IsString()
  referenciaTipo?: string;

  @ApiPropertyOptional({ description: 'Búsqueda por nombre de medicamento, lote u observación' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Fecha desde (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  fechaDesde?: string;

  @ApiPropertyOptional({ description: 'Fecha hasta (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  fechaHasta?: string;
}

export class FilterAuditoriaDto {
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
  @IsString()
  tablaAfectada?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operacion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

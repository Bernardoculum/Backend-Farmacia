import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

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

  @ApiPropertyOptional({ description: 'Filtrar por tabla afectada (ej. CREDENCIAL, PEDIDO, INVENTARIO, SESION_CAJA)' })
  @IsOptional()
  @IsString()
  tablaAfectada?: string;

  @ApiPropertyOptional({ description: 'Filtrar por tipo de operación (ej. LOGIN, INSERT, UPDATE, AJUSTE_MANUAL)' })
  @IsOptional()
  @IsString()
  operacion?: string;

  @ApiPropertyOptional({ description: 'Filtrar por operador / usuario' })
  @IsOptional()
  @IsString()
  usuario?: string;

  @ApiPropertyOptional({ description: 'Fecha inicio (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  fechaInicio?: string;

  @ApiPropertyOptional({ description: 'Fecha fin (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  fechaFin?: string;

  @ApiPropertyOptional({ description: 'Término de búsqueda libre' })
  @IsOptional()
  @IsString()
  search?: string;
}

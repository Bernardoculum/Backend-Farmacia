import { IsOptional, IsNumber, IsString, IsIn, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class FilterSesionCajaDto {
  @ApiPropertyOptional({ description: 'Número de página', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: 'Cantidad de registros por página', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit: number = 10;

  @ApiPropertyOptional({ description: 'Filtrar por sucursal' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sucursalId?: number;

  @ApiPropertyOptional({ description: 'Filtrar por terminal / caja específica' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cajaId?: number;

  @ApiPropertyOptional({ description: 'Filtrar por estado de la sesión', enum: ['TODOS', 'ABIERTA', 'CERRADA', 'DESCUADRE'] })
  @IsOptional()
  @IsString()
  estado?: string;

  @ApiPropertyOptional({ description: 'Búsqueda por código de caja o nombre de cajero' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Fecha de apertura desde (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  fechaDesde?: string;

  @ApiPropertyOptional({ description: 'Fecha de apertura hasta (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  fechaHasta?: string;
}

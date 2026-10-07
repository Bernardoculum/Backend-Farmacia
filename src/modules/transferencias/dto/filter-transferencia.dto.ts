import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterTransferenciaDto {
  @ApiPropertyOptional({ description: 'Búsqueda por observación o ID de transferencia' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtrar por sucursal origen' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sucursalOrigenId?: number;

  @ApiPropertyOptional({ description: 'Filtrar por sucursal destino' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sucursalDestinoId?: number;

  @ApiPropertyOptional({ description: 'Filtrar por sucursal involucrada (origen o destino)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sucursalId?: number;

  @ApiPropertyOptional({
    description: 'Estado de la transferencia',
    enum: ['SOLICITADA', 'AUTORIZADA', 'EN_TRANSITO', 'RECIBIDA', 'CANCELADA'],
  })
  @IsOptional()
  @IsIn(['SOLICITADA', 'AUTORIZADA', 'EN_TRANSITO', 'RECIBIDA', 'CANCELADA'])
  estado?: string;

  @ApiPropertyOptional({ description: 'Página actual para paginación', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Cantidad de registros por página', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}

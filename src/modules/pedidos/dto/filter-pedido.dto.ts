import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsIn, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterPedidoDto {
  @ApiPropertyOptional({ description: 'Filtrar por origen de venta', enum: ['MOSTRADOR', 'CALL_CENTER'] })
  @IsOptional()
  @IsIn(['MOSTRADOR', 'CALL_CENTER'])
  origen?: 'MOSTRADOR' | 'CALL_CENTER';

  @ApiPropertyOptional({ description: 'Filtrar por ID de sucursal' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sucursalId?: number;

  @ApiPropertyOptional({ description: 'Filtrar por estado del pedido' })
  @IsOptional()
  @IsString()
  estado?: string;

  @ApiPropertyOptional({ description: 'Búsqueda por número de pedido, cliente o teléfono' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Página de resultados' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Cantidad por página' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

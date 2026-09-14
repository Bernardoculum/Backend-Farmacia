import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateEstadoPedidoDto {
  @ApiProperty({
    example: 'CONFIRMADO',
    enum: ['RECIBIDO', 'CONFIRMADO', 'EN_PREPARACION', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO'],
    description: 'Nuevo estado del pedido o entrega',
  })
  @IsIn(
    ['RECIBIDO', 'CONFIRMADO', 'EN_PREPARACION', 'EN_CAMINO', 'EN_ENTREGA', 'ENTREGADO', 'CANCELADO'],
    {
      message: 'Estado no válido',
    },
  )
  estado: string;

  @ApiPropertyOptional({ example: 'Entregado al cliente a conformidad', description: 'Nota de cambio de estado' })
  @IsOptional()
  @IsString()
  observacion?: string;
}

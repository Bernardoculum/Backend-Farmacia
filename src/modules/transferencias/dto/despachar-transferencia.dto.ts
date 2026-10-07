import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsArray, ValidateNested, IsOptional, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class DespacharItemDto {
  @ApiProperty({ description: 'ID del detalle de la transferencia', example: 10 })
  @IsNumber()
  transferenciaDetalleId: number;

  @ApiProperty({ description: 'Cantidad real despachada/enviada', example: 50 })
  @IsNumber()
  @IsPositive({ message: 'La cantidad enviada debe ser mayor a cero' })
  cantidadEnviada: number;
}

export class DespacharTransferenciaDto {
  @ApiPropertyOptional({
    description: 'Ajuste de cantidades enviadas por renglón (si se omite, se envía lo solicitado)',
    type: [DespacharItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DespacharItemDto)
  items?: DespacharItemDto[];
}

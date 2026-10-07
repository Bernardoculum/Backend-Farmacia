import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, Min, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class RecibirItemDto {
  @ApiProperty({ description: 'ID del detalle de la transferencia', example: 10 })
  @IsNumber()
  transferenciaDetalleId: number;

  @ApiProperty({ description: 'Cantidad real recibida e ingresada al inventario', example: 50 })
  @IsNumber()
  @Min(0, { message: 'La cantidad recibida no puede ser negativa' })
  cantidadRecibida: number;
}

export class RecibirTransferenciaDto {
  @ApiPropertyOptional({
    description: 'Ajuste de cantidades recibidas (si se omite, se asume que se recibió todo lo enviado)',
    type: [RecibirItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecibirItemDto)
  items?: RecibirItemDto[];
}

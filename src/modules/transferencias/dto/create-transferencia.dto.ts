import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTransferenciaDetalleDto {
  @ApiProperty({ description: 'ID del Lote físico a transferir', example: 1 })
  @IsNotEmpty({ message: 'El loteId es obligatorio' })
  @IsNumber()
  loteId: number;

  @ApiProperty({ description: 'Cantidad de unidades solicitadas', example: 50 })
  @IsNotEmpty({ message: 'La cantidad solicitada es obligatoria' })
  @IsNumber()
  @IsPositive({ message: 'La cantidad solicitada debe ser mayor a cero' })
  cantidadSolicitada: number;
}

export class CreateTransferenciaDto {
  @ApiProperty({ description: 'ID de la Sucursal Origen (ej. 1 para Bodega Central)', example: 1 })
  @IsNotEmpty({ message: 'La sucursal de origen es obligatoria' })
  @IsNumber()
  sucursalOrigenId: number;

  @ApiProperty({ description: 'ID de la Sucursal Destino', example: 3 })
  @IsNotEmpty({ message: 'La sucursal de destino es obligatoria' })
  @IsNumber()
  sucursalDestinoId: number;

  @ApiPropertyOptional({ description: 'Observación o motivo del traslado', example: 'Reabastecimiento semanal de antibióticos' })
  @IsOptional()
  @IsString()
  observacion?: string;

  @ApiProperty({
    description: 'Lista de medicamentos y lotes a transferir',
    type: [CreateTransferenciaDetalleDto],
  })
  @IsArray({ message: 'Los detalles deben ser un arreglo' })
  @ArrayMinSize(1, { message: 'Debes incluir al menos un medicamento/lote en la transferencia' })
  @ValidateNested({ each: true })
  @Type(() => CreateTransferenciaDetalleDto)
  detalles: CreateTransferenciaDetalleDto[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ItemEvaluacionDto {
  @ApiProperty({ example: 1, description: 'ID del medicamento' })
  @IsNotEmpty({ message: 'El productoId es obligatorio' })
  @IsNumber({}, { message: 'El productoId debe ser numérico' })
  productoId: number;

  @ApiProperty({ example: 2, description: 'Cantidad requerida por el cliente' })
  @IsNotEmpty({ message: 'La cantidad es obligatoria' })
  @IsNumber({}, { message: 'La cantidad debe ser numérica' })
  @Min(1, { message: 'La cantidad mínima es 1' })
  cantidad: number;
}

export class EvaluarDespachoDto {
  @ApiPropertyOptional({ example: 1, description: 'ID del cliente registrado (para obtener sus coordenadas)' })
  @IsOptional()
  @IsNumber({}, { message: 'El clienteId debe ser numérico' })
  clienteId?: number;

  @ApiPropertyOptional({ example: 14.595, description: 'Latitud de la dirección de entrega' })
  @IsOptional()
  @IsNumber({}, { message: 'La latitudDestino debe ser numérica' })
  latitudDestino?: number;

  @ApiPropertyOptional({ example: -90.518, description: 'Longitud de la dirección de entrega' })
  @IsOptional()
  @IsNumber({}, { message: 'La longitudDestino debe ser numérica' })
  longitudDestino?: number;

  @ApiPropertyOptional({ example: 'Avenida Reforma 8-60 Zona 9', description: 'Dirección física de destino' })
  @IsOptional()
  @IsString()
  direccionDestino?: string;

  @ApiProperty({ type: [ItemEvaluacionDto], description: 'Medicamentos solicitados para verificar stock en cada farmacia' })
  @IsArray({ message: 'Los items deben ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => ItemEvaluacionDto)
  items: ItemEvaluacionDto[];
}

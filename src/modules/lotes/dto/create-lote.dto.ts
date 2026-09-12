import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsDateString,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateLoteDto {
  @ApiProperty({ example: 1, description: 'ID del producto al que pertenece este lote' })
  @IsNotEmpty({ message: 'El productoId es obligatorio' })
  @IsNumber({}, { message: 'El productoId debe ser numérico' })
  productoId: number;

  @ApiProperty({ example: 'LOT-PAR-2026-A1', description: 'Número de lote impreso en el empaque' })
  @IsNotEmpty({ message: 'El numeroLote es obligatorio' })
  @IsString({ message: 'El numeroLote debe ser texto' })
  numeroLote: string;

  @ApiProperty({ example: '2027-12-31', description: 'Fecha de caducidad o vencimiento' })
  @IsNotEmpty({ message: 'La fechaVencimiento es obligatoria' })
  @IsDateString({}, { message: 'La fechaVencimiento debe tener formato de fecha válido (YYYY-MM-DD)' })
  fechaVencimiento: string;

  @ApiProperty({ example: '2024-01-15', description: 'Fecha de fabricación (opcional)', required: false })
  @IsOptional()
  @IsDateString({}, { message: 'La fechaFabricacion debe tener formato de fecha válido' })
  fechaFabricacion?: string;

  @ApiProperty({ example: 10.50, description: 'Costo unitario de compra al proveedor' })
  @IsNotEmpty({ message: 'El costoUnitario es obligatorio' })
  @IsNumber({}, { message: 'El costoUnitario debe ser numérico' })
  @Min(0, { message: 'El costoUnitario no puede ser negativo' })
  costoUnitario: number;

  @ApiProperty({ example: 1, description: 'Sucursal inicial de ingreso (opcional)', required: false })
  @IsOptional()
  @IsNumber({}, { message: 'sucursalId debe ser numérico' })
  sucursalId?: number;

  @ApiProperty({ example: 50, description: 'Cantidad inicial a ingresar al inventario (opcional)', required: false })
  @IsOptional()
  @IsNumber({}, { message: 'stockInicial debe ser numérico' })
  @Min(1, { message: 'stockInicial debe ser mayor a 0' })
  stockInicial?: number;
}

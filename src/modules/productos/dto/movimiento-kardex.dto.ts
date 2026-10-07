import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsIn,
  Min,
  IsDateString,
  MaxLength,
} from 'class-validator';

export class MovimientoKardexDto {
  @IsNotEmpty({ message: 'El ID del producto es obligatorio' })
  @IsNumber({}, { message: 'El ID del producto debe ser numérico' })
  productoId: number;

  @IsNotEmpty({ message: 'El ID de la sucursal es obligatorio' })
  @IsNumber({}, { message: 'El ID de la sucursal debe ser numérico' })
  sucursalId: number;

  @IsNotEmpty({ message: 'El número de lote es obligatorio' })
  @IsString({ message: 'El número de lote debe ser texto' })
  @MaxLength(80)
  numeroLote: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de vencimiento debe tener formato de fecha válido (YYYY-MM-DD)' })
  fechaVencimiento?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de fabricación debe tener formato de fecha válido' })
  fechaFabricacion?: string;

  @IsOptional()
  @IsNumber({}, { message: 'El costo unitario debe ser numérico' })
  @Min(0)
  costoUnitario?: number;

  @IsNotEmpty({ message: 'El tipo de movimiento es obligatorio' })
  @IsIn(['ENTRADA', 'SALIDA', 'AJUSTE'], {
    message: 'El tipo de movimiento debe ser ENTRADA, SALIDA o AJUSTE',
  })
  tipoMovimiento: 'ENTRADA' | 'SALIDA' | 'AJUSTE';

  @IsNotEmpty({ message: 'La cantidad es obligatoria' })
  @IsNumber({}, { message: 'La cantidad debe ser numérica' })
  @Min(0.001, { message: 'La cantidad debe ser mayor a 0' })
  cantidad: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  referenciaTipo?: string;

  @IsOptional()
  @IsNumber()
  referenciaId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

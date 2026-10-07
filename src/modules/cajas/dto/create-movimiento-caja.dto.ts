import { IsNotEmpty, IsNumber, IsOptional, IsString, IsIn, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateMovimientoCajaDto {
  @ApiProperty({ description: 'Tipo de movimiento de efectivo', enum: ['INGRESO', 'EGRESO'], example: 'EGRESO' })
  @IsNotEmpty({ message: 'El tipo de movimiento es obligatorio' })
  @IsIn(['INGRESO', 'EGRESO'], { message: 'El tipo de movimiento debe ser INGRESO o EGRESO' })
  tipoMovimiento: 'INGRESO' | 'EGRESO';

  @ApiProperty({ description: 'Monto del movimiento en Quetzales', example: 50 })
  @IsNotEmpty({ message: 'El monto es obligatorio' })
  @Type(() => Number)
  @IsNumber({}, { message: 'El monto debe ser numérico' })
  @Min(0.01, { message: 'El monto debe ser mayor a cero' })
  monto: number;

  @ApiProperty({ description: 'ID del método de pago utilizado (por defecto 1 = Efectivo)', example: 1 })
  @IsNotEmpty({ message: 'El método de pago es obligatorio' })
  @Type(() => Number)
  @IsNumber()
  metodoPagoId: number;

  @ApiPropertyOptional({ description: 'Categoría o motivo del movimiento', example: 'GASTO_MENOR' })
  @IsOptional()
  @IsString()
  referenciaTipo?: string;

  @ApiPropertyOptional({ description: 'ID de referencia externa si aplica', example: 101 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  referenciaId?: number;

  @ApiProperty({ description: 'Descripción o justificación del movimiento', example: 'Compra de insumos de limpieza y papel higiénico' })
  @IsNotEmpty({ message: 'La descripción del movimiento es obligatoria' })
  @IsString()
  descripcion: string;
}

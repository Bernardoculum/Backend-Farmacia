import { IsNotEmpty, IsNumber, IsString, IsIn, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AjusteInventarioDto {
  @ApiProperty({ description: 'ID del registro de inventario (sucursal + lote)' })
  @IsNotEmpty({ message: 'El ID de inventario es obligatorio' })
  @Type(() => Number)
  @IsNumber()
  inventarioId: number;

  @ApiProperty({ description: 'Tipo de ajuste', enum: ['ENTRADA', 'SALIDA'], example: 'SALIDA' })
  @IsNotEmpty({ message: 'El tipo de ajuste es obligatorio' })
  @IsIn(['ENTRADA', 'SALIDA'], { message: 'El tipo debe ser ENTRADA o SALIDA' })
  tipoAjuste: 'ENTRADA' | 'SALIDA';

  @ApiProperty({ description: 'Cantidad a ajustar en unidades/cajas', example: 5 })
  @IsNotEmpty({ message: 'La cantidad es obligatoria' })
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'La cantidad mínima es 1' })
  cantidad: number;

  @ApiProperty({ description: 'Motivo / justificación auditada del ajuste', example: 'Avería de frasco en estantería durante limpieza' })
  @IsNotEmpty({ message: 'La justificación es obligatoria para auditoría' })
  @IsString()
  motivo: string;
}

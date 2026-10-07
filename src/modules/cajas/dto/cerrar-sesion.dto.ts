import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CerrarSesionDto {
  @ApiProperty({ description: 'Monto de efectivo físico contado en caja durante el arqueo', example: 2800 })
  @IsNotEmpty({ message: 'El efectivo contado físicamente es obligatorio' })
  @Type(() => Number)
  @IsNumber({}, { message: 'El efectivo contado debe ser numérico' })
  @Min(0, { message: 'El efectivo contado no puede ser negativo' })
  efectivoContado: number;

  @ApiPropertyOptional({ description: 'Observaciones del arqueo o justificación de descuadre', example: 'Cuadre sin novedades' })
  @IsOptional()
  @IsString()
  observacionCierre?: string;

  @ApiPropertyOptional({ description: 'ID opcional del empleado que realiza el cierre' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  empleadoId?: number;
}

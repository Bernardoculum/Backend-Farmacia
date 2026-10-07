import { IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AbrirSesionDto {
  @ApiProperty({ description: 'ID de la terminal de cobro / caja física', example: 1 })
  @IsNotEmpty({ message: 'El ID de la caja es obligatorio' })
  @Type(() => Number)
  @IsNumber({}, { message: 'El ID de la caja debe ser un número' })
  cajaId: number;

  @ApiProperty({ description: 'Monto de fondo de caja inicial en Quetzales', example: 500 })
  @IsNotEmpty({ message: 'El saldo inicial es obligatorio' })
  @Type(() => Number)
  @IsNumber({}, { message: 'El saldo inicial debe ser numérico' })
  @Min(0, { message: 'El saldo inicial no puede ser negativo' })
  saldoInicial: number;

  @ApiPropertyOptional({ description: 'ID opcional del empleado que realiza la apertura (por defecto usuario autenticado)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  empleadoId?: number;
}

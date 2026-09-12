import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsNumber, Min } from 'class-validator';

export class UpdateLoteDto {
  @ApiPropertyOptional({ example: '2027-12-31', description: 'Nueva fecha de caducidad' })
  @IsOptional()
  @IsDateString({}, { message: 'La fechaVencimiento debe tener formato válido' })
  fechaVencimiento?: string;

  @ApiPropertyOptional({ example: 12.00, description: 'Nuevo costo unitario' })
  @IsOptional()
  @IsNumber({}, { message: 'El costoUnitario debe ser numérico' })
  @Min(0, { message: 'El costoUnitario no puede ser negativo' })
  costoUnitario?: number;
}

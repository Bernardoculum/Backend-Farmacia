import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsIn,
  IsEmail,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GenerarPlanillaDto {
  @ApiProperty({ description: 'Fecha inicio del período de planilla (YYYY-MM-DD)', example: '2026-09-01' })
  @IsNotEmpty({ message: 'La fecha de inicio es obligatoria' })
  @IsString()
  fechaInicio: string;

  @ApiProperty({ description: 'Fecha fin del período de planilla (YYYY-MM-DD)', example: '2026-09-15' })
  @IsNotEmpty({ message: 'La fecha de fin es obligatoria' })
  @IsString()
  fechaFin: string;

  @ApiPropertyOptional({ description: 'Tipo de período (MENSUAL, PRIMERA_QUINCENA, SEGUNDA_QUINCENA)', example: 'MENSUAL' })
  @IsOptional()
  @IsIn(['MENSUAL', 'PRIMERA_QUINCENA', 'SEGUNDA_QUINCENA'])
  tipoPeriodo?: 'MENSUAL' | 'PRIMERA_QUINCENA' | 'SEGUNDA_QUINCENA';

  @ApiPropertyOptional({ description: 'ID de sucursal específica o TODAS', example: 'TODAS' })
  @IsOptional()
  sucursalId?: any;

  @ApiPropertyOptional({ description: 'Observación o nota del período' })
  @IsOptional()
  @IsString()
  observacion?: string;

  @ApiPropertyOptional({ description: 'Observaciones generales del período' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class CreateEmpleadoDto {
  @ApiProperty({ example: 'Luis Fernando' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString()
  nombre: string;

  @ApiProperty({ example: 'Morales Gómez' })
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  @IsString()
  apellido: string;

  @ApiPropertyOptional({ example: '2541896320101' })
  @IsOptional()
  @IsString()
  dpi?: string;

  @ApiPropertyOptional({ example: '44556677' })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  fechaIngreso?: string | Date;

  @ApiPropertyOptional({ example: '1234567-8' })
  @IsOptional()
  @Matches(/^(CF|cf|[0-9]{4,10}(-?[0-9kK])?)$/, { message: 'Formato de NIT inválido (Ej. 1234567-8, 12345678 o CF, máx 10 dígitos)' })
  nit?: string;

  @ApiPropertyOptional({ example: '1098765432' })
  @IsOptional()
  @Matches(/^[0-9]{6,12}$/, { message: 'El número de afiliación IGSS debe contener entre 6 y 12 dígitos numéricos' })
  noAfiliacionIgss?: string;

  @ApiPropertyOptional({ example: 'TRANSFERENCIA' })
  @IsOptional()
  @IsIn(['TRANSFERENCIA', 'CHEQUE', 'EFECTIVO'])
  formaPago?: string;

  @ApiPropertyOptional({ example: 'Banco Industrial' })
  @IsOptional()
  @IsString()
  banco?: string;

  @ApiPropertyOptional({ example: '0281234567' })
  @IsOptional()
  @Matches(/^[0-9]{8,14}$/, { message: 'El número de cuenta bancaria debe contener entre 8 y 14 dígitos numéricos' })
  numeroCuenta?: string;

  @ApiPropertyOptional({ example: 'empleado@redfarma.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Correo electrónico inválido' })
  email?: string;

  @ApiProperty({ example: 4500 })
  @IsNotEmpty({ message: 'El salario actual es obligatorio' })
  @Type(() => Number)
  @IsNumber()
  @Min(3000, { message: 'El salario debe cumplir el mínimo de ley (mínimo Q 3,000.00)' })
  @Max(150000, { message: 'El salario no puede exceder Q 150,000.00' })
  salarioActual: number;

  @ApiProperty({ example: 1 })
  @IsNotEmpty({ message: 'El puesto es obligatorio' })
  @Type(() => Number)
  @IsNumber()
  puestoId: number;

  @ApiProperty({ example: 1 })
  @IsNotEmpty({ message: 'La sucursal es obligatoria' })
  @Type(() => Number)
  @IsNumber()
  sucursalId: number;
}

export class UpdateEmpleadoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apellido?: string;

  @ApiPropertyOptional({ example: '2541896320101' })
  @IsOptional()
  @IsString()
  dpi?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiPropertyOptional()
  @IsOptional()
  fechaIngreso?: string | Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^(CF|cf|[0-9]{4,10}(-?[0-9kK])?)$/, { message: 'Formato de NIT inválido (Ej. 1234567-8, 12345678 o CF, máx 10 dígitos)' })
  nit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[0-9]{6,12}$/, { message: 'El número de afiliación IGSS debe contener entre 6 y 12 dígitos numéricos' })
  noAfiliacionIgss?: string;

  @ApiPropertyOptional()
  @IsOptional()
  formaPago?: string;

  @ApiPropertyOptional()
  @IsOptional()
  banco?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[0-9]{8,14}$/, { message: 'El número de cuenta bancaria debe contener entre 8 y 14 dígitos numéricos' })
  numeroCuenta?: string;

  @ApiPropertyOptional()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'El salario debe ser un monto positivo mayor a cero' })
  @Max(150000, { message: 'El salario no puede exceder Q 150,000.00' })
  salarioActual?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  puestoId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sucursalId?: number;

  @ApiPropertyOptional({ example: 'ACTIVO' })
  @IsOptional()
  @IsString()
  estado?: string;
}

export class FilterPlanillaDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit: number = 10;

  @ApiPropertyOptional({ description: 'Filtrar por sucursal específica' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sucursalId?: number;
}

export class DesembolsarPlanillaDto {
  @ApiProperty({ description: 'Origen de los fondos', enum: ['BANCO', 'CAJA'] })
  @IsNotEmpty({ message: 'El origen de fondos es obligatorio' })
  @IsIn(['BANCO', 'CAJA'], { message: 'El origen de fondos debe ser BANCO o CAJA' })
  origenFondos: 'BANCO' | 'CAJA';

  @ApiPropertyOptional({ description: 'Banco de origen si es débito bancario' })
  @IsOptional()
  @IsString()
  bancoOrigen?: string;

  @ApiProperty({ description: 'Referencia bancaria o número de comprobante' })
  @IsNotEmpty({ message: 'El número de referencia o autorización es obligatorio' })
  @IsString()
  referenciaPago: string;

  @ApiPropertyOptional({ description: 'Notas u observaciones adicionales' })
  @IsOptional()
  @IsString()
  observacionesPago?: string;
}

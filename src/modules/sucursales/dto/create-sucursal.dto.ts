import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsIn,
  IsOptional,
  IsNumber,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateSucursalDto {
  @ApiProperty({ description: 'Nombre oficial de la sucursal', example: 'Sucursal Zona 10 Centro' })
  @IsNotEmpty({ message: 'El nombre de la sucursal es obligatorio' })
  @IsString()
  @MaxLength(150)
  @Matches(/^(?!\s*\d+\s*$).+$/, {
    message: 'El nombre de la sucursal no puede estar compuesto únicamente por números (ej. 323)',
  })
  nombre: string;

  @ApiProperty({
    description: 'Tipo de sucursal',
    enum: ['FARMACIA', 'STAND', 'BODEGA_CENTRAL'],
    default: 'FARMACIA',
  })
  @IsNotEmpty({ message: 'El tipo de sucursal es obligatorio' })
  @IsIn(['FARMACIA', 'STAND', 'BODEGA_CENTRAL'], {
    message: 'El tipo debe ser FARMACIA, STAND o BODEGA_CENTRAL',
  })
  tipoSucursal: string;

  @ApiProperty({ description: 'Dirección física completa', example: '6ta Avenida 9-08 Zona 10' })
  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  @IsString()
  @MaxLength(300)
  @Matches(/^(?!\s*\d+\s*$).+$/, {
    message: 'La dirección no puede estar compuesta únicamente por números (ej. 323)',
  })
  direccion: string;

  @ApiPropertyOptional({ description: 'Teléfono de contacto', example: '23334401' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @ApiPropertyOptional({ description: 'Coordenada Latitud GPS', example: 14.5987 })
  @IsOptional()
  @IsNumber()
  latitud?: number;

  @ApiPropertyOptional({ description: 'Coordenada Longitud GPS', example: -90.5123 })
  @IsOptional()
  @IsNumber()
  longitud?: number;

  @ApiPropertyOptional({ description: 'ID del Municipio al que pertenece', example: 1 })
  @IsOptional()
  @IsNumber()
  municipioId?: number;

  @ApiPropertyOptional({ description: 'Estado de operación', enum: ['ACTIVA', 'INACTIVA'], default: 'ACTIVA' })
  @IsOptional()
  @IsIn(['ACTIVA', 'INACTIVA'])
  estado?: string = 'ACTIVA';
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEmail, IsNumber, Matches } from 'class-validator';

export class CreateClienteDto {
  @ApiProperty({ example: 'Carlos', description: 'Nombre del cliente' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString()
  @Matches(/^(?!\s*\d+\s*$).+$/, {
    message: 'El nombre no puede estar compuesto únicamente por números (ej. 323)',
  })
  nombre: string;

  @ApiPropertyOptional({ example: 'Mendoza', description: 'Apellido del cliente' })
  @IsOptional()
  @IsString()
  apellido?: string;

  @ApiProperty({ example: '55443322', description: 'Número de teléfono (identificador único para Call Center)' })
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  @IsString()
  telefono: string;

  @ApiProperty({ example: '14 Calle 3-45 Zona 10', description: 'Dirección física para entregas' })
  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  @IsString()
  @Matches(/^(?!\s*\d+\s*$).+$/, {
    message: 'La dirección no puede estar compuesta únicamente por números (ej. 323)',
  })
  direccion: string;

  @ApiPropertyOptional({ example: 'Frente al parque central', description: 'Punto de referencia' })
  @IsOptional()
  @IsString()
  referenciaDireccion?: string;

  @ApiPropertyOptional({ example: 'carlos@ejemplo.com', description: 'Correo electrónico' })
  @IsOptional()
  @IsEmail({}, { message: 'El formato de correo no es válido' })
  email?: string;

  @ApiPropertyOptional({ example: 1, description: 'ID de municipio' })
  @IsOptional()
  @IsNumber()
  municipioId?: number;
}

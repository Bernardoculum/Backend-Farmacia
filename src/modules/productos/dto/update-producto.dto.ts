import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  Min,
  MaxLength,
} from 'class-validator';

export class UpdateProductoDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigoProducto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  precioVenta?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  porcentajeIva?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  principioActivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  presentacion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  concentracion?: string;

  @IsOptional()
  @IsIn(['S', 'N'])
  requiereReceta?: string;

  @IsOptional()
  @IsIn(['ACTIVO', 'INACTIVO'])
  estado?: string;

  @IsOptional()
  @IsNumber()
  categoriaId?: number;

  @IsOptional()
  @IsNumber()
  laboratorioId?: number;

  @IsOptional()
  @IsNumber()
  unidadMedidaId?: number;
}

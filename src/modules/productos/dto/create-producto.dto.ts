import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateProductoDto {
  @IsOptional()
  @IsString({ message: 'El código del producto debe ser texto' })
  @MaxLength(50, { message: 'El código no puede superar 50 caracteres' })
  codigoProducto?: string;

  @IsNotEmpty({ message: 'El nombre del producto es obligatorio' })
  @IsString({ message: 'El nombre debe ser texto' })
  @MaxLength(200, { message: 'El nombre no puede superar 200 caracteres' })
  nombre: string;

  @IsNotEmpty({ message: 'El precio de venta es obligatorio' })
  @IsNumber({}, { message: 'El precio de venta debe ser un número' })
  @Min(0.01, { message: 'El precio de venta debe ser mayor a 0' })
  precioVenta: number;

  @IsOptional()
  @IsNumber({}, { message: 'El porcentaje de IVA debe ser un número' })
  @Min(0, { message: 'El IVA no puede ser negativo' })
  porcentajeIva?: number;

  @IsOptional()
  @IsString({ message: 'El principio activo debe ser texto' })
  @MaxLength(200)
  principioActivo?: string;

  @IsOptional()
  @IsString({ message: 'La presentación debe ser texto' })
  @MaxLength(100)
  presentacion?: string;

  @IsOptional()
  @IsString({ message: 'La concentración debe ser texto' })
  @MaxLength(100)
  concentracion?: string;

  @IsOptional()
  @IsIn(['S', 'N'], { message: 'Requiere receta debe ser "S" o "N"' })
  requiereReceta?: string;

  @IsOptional()
  @IsIn(['ACTIVO', 'INACTIVO'], { message: 'El estado debe ser ACTIVO o INACTIVO' })
  estado?: string;

  @IsNotEmpty({ message: 'La categoría es obligatoria' })
  @IsNumber({}, { message: 'El ID de la categoría debe ser numérico' })
  categoriaId: number;

  @IsNotEmpty({ message: 'El laboratorio es obligatorio' })
  @IsNumber({}, { message: 'El ID del laboratorio debe ser numérico' })
  laboratorioId: number;

  @IsNotEmpty({ message: 'La unidad de medida es obligatoria' })
  @IsNumber({}, { message: 'El ID de la unidad de medida debe ser numérico' })
  unidadMedidaId: number;
}

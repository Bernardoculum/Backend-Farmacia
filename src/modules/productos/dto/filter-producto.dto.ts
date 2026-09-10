import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterProductoDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  categoriaId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  laboratorioId?: number;

  @IsOptional()
  @IsString()
  requiereReceta?: string;

  @IsOptional()
  @IsString()
  conReceta?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

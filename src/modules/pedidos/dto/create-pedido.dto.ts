import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DetallePedidoDto {
  @ApiProperty({ example: 1, description: 'ID del producto a vender' })
  @IsNotEmpty({ message: 'El productoId es obligatorio' })
  @IsNumber({}, { message: 'El productoId debe ser numérico' })
  productoId: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'ID del lote específico (opcional; si no se envía, el sistema aplica regla FEFO automática)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'El loteId debe ser numérico' })
  loteId?: number;

  @ApiProperty({ example: 2, description: 'Cantidad de unidades a vender' })
  @IsNotEmpty({ message: 'La cantidad es obligatoria' })
  @IsNumber({}, { message: 'La cantidad debe ser numérica' })
  @Min(1, { message: 'La cantidad mínima es 1' })
  cantidad: number;
}

export class DatosEntregaDto {
  @ApiProperty({ example: 'Avenida Reforma 8-60 Zona 9', description: 'Dirección de destino' })
  @IsNotEmpty({ message: 'La direccionEntrega es obligatoria para pedidos a domicilio' })
  @IsString()
  direccionEntrega: string;

  @ApiProperty({ example: '41238801', description: 'Teléfono de contacto' })
  @IsNotEmpty({ message: 'El telefonoContacto es obligatorio' })
  @IsString()
  telefonoContacto: string;

  @ApiPropertyOptional({ example: 'Juan Pérez', description: 'Persona que recibe el paquete' })
  @IsOptional()
  @IsString()
  personaRecibe?: string;

  @ApiPropertyOptional({ example: '2026-09-17T14:00:00Z', description: 'Fecha/hora estimada de entrega' })
  @IsOptional()
  fechaProgramada?: string;

  @ApiPropertyOptional({ example: 'Dejar en recepción del edificio', description: 'Instrucciones para el motorista' })
  @IsOptional()
  @IsString()
  observacionEntrega?: string;
}

export class CreatePedidoDto {
  @ApiProperty({
    example: 'CALL_CENTER',
    enum: ['MOSTRADOR', 'CALL_CENTER', 'PORTAL', 'TELEFONO'],
    description: 'Canal de origen de la venta (POS, Call Center o integración con Portal Web / Teléfono)',
  })
  @IsNotEmpty({ message: 'El origen es obligatorio' })
  @IsIn(['MOSTRADOR', 'CALL_CENTER', 'PORTAL', 'TELEFONO'], {
    message: 'El origen debe ser MOSTRADOR, CALL_CENTER, PORTAL o TELEFONO',
  })
  origen: 'MOSTRADOR' | 'CALL_CENTER' | 'PORTAL' | 'TELEFONO';

  @ApiProperty({
    example: 1,
    description: 'Sucursal que prepara/despacha y de donde se descuenta el inventario',
  })
  @IsNotEmpty({ message: 'La sucursalId es obligatoria' })
  @IsNumber({}, { message: 'La sucursalId debe ser numérica' })
  sucursalId: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'ID del cliente registrado (opcional en mostrador si es Consumidor Final)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'El clienteId debe ser numérico' })
  clienteId?: number;

  @ApiProperty({
    example: 1,
    description: 'ID del método de pago (1: Efectivo, 2: Tarjeta, 3: Transferencia, 4: Contra Entrega POS)',
  })
  @IsNotEmpty({ message: 'El metodoPagoId es obligatorio' })
  @IsNumber({}, { message: 'El metodoPagoId debe ser numérico' })
  metodoPagoId: number;

  @ApiPropertyOptional({ example: 'Venta rápida mostrador', description: 'Notas del pedido' })
  @IsOptional()
  @IsString()
  observacion?: string;

  @ApiProperty({ type: [DetallePedidoDto], description: 'Lista de medicamentos del pedido' })
  @IsArray({ message: 'Los detalles deben ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => DetallePedidoDto)
  detalles: DetallePedidoDto[];

  @ApiPropertyOptional({
    type: DatosEntregaDto,
    description: 'Datos de envío requeridos si el origen es CALL_CENTER',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DatosEntregaDto)
  datosEntrega?: DatosEntregaDto;
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PedidosService } from './pedidos.service';
import { PedidosController } from './pedidos.controller';
import { Pedido } from '../../database/entities/Pedido';
import { PedidoDetalle } from '../../database/entities/PedidoDetalle';
import { Entrega } from '../../database/entities/Entrega';
import { Cliente } from '../../database/entities/Cliente';
import { MetodoPago } from '../../database/entities/MetodoPago';
import { Sucursal } from '../../database/entities/Sucursal';
import { Producto } from '../../database/entities/Producto';
import { Lote } from '../../database/entities/Lote';
import { Inventario } from '../../database/entities/Inventario';
import { MovimientoInventario } from '../../database/entities/MovimientoInventario';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Pedido,
      PedidoDetalle,
      Entrega,
      Cliente,
      MetodoPago,
      Sucursal,
      Producto,
      Lote,
      Inventario,
      MovimientoInventario,
    ]),
  ],
  controllers: [PedidosController],
  providers: [PedidosService],
  exports: [PedidosService],
})
export class PedidosModule {}

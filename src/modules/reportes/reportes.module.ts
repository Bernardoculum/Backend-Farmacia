import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pedido } from '../../database/entities/Pedido';
import { PedidoDetalle } from '../../database/entities/PedidoDetalle';
import { Inventario } from '../../database/entities/Inventario';
import { Lote } from '../../database/entities/Lote';
import { Planilla } from '../../database/entities/Planilla';
import { ActivoFijo } from '../../database/entities/ActivoFijo';
import { Sucursal } from '../../database/entities/Sucursal';
import { Producto } from '../../database/entities/Producto';
import { ReportesService } from './reportes.service';
import { ReportesController } from './reportes.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Pedido,
      PedidoDetalle,
      Inventario,
      Lote,
      Planilla,
      ActivoFijo,
      Sucursal,
      Producto,
    ]),
  ],
  controllers: [ReportesController],
  providers: [ReportesService],
  exports: [ReportesService],
})
export class ReportesModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transferencia } from '../../database/entities/Transferencia';
import { TransferenciaDetalle } from '../../database/entities/TransferenciaDetalle';
import { Sucursal } from '../../database/entities/Sucursal';
import { Lote } from '../../database/entities/Lote';
import { Inventario } from '../../database/entities/Inventario';
import { MovimientoInventario } from '../../database/entities/MovimientoInventario';
import { TransferenciasService } from './transferencias.service';
import { TransferenciasController } from './transferencias.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transferencia,
      TransferenciaDetalle,
      Sucursal,
      Lote,
      Inventario,
      MovimientoInventario,
    ]),
  ],
  controllers: [TransferenciasController],
  providers: [TransferenciasService],
  exports: [TransferenciasService],
})
export class TransferenciasModule {}

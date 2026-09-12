import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LotesService } from './lotes.service';
import { LotesController } from './lotes.controller';
import { Lote } from '../../database/entities/Lote';
import { Producto } from '../../database/entities/Producto';
import { Inventario } from '../../database/entities/Inventario';
import { MovimientoInventario } from '../../database/entities/MovimientoInventario';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lote, Producto, Inventario, MovimientoInventario]),
  ],
  controllers: [LotesController],
  providers: [LotesService],
  exports: [LotesService],
})
export class LotesModule {}

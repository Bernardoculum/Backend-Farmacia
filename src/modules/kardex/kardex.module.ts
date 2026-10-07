import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KardexController } from './kardex.controller';
import { KardexService } from './kardex.service';
import { MovimientoInventario } from '../../database/entities/MovimientoInventario';
import { AuditoriaEvento } from '../../database/entities/AuditoriaEvento';
import { Inventario } from '../../database/entities/Inventario';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MovimientoInventario,
      AuditoriaEvento,
      Inventario,
    ]),
  ],
  controllers: [KardexController],
  providers: [KardexService],
  exports: [KardexService],
})
export class KardexModule {}

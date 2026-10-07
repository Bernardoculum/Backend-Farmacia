import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivoFijo } from '../../database/entities/ActivoFijo';
import { CategoriaActivo } from '../../database/entities/CategoriaActivo';
import { HistorialActivo } from '../../database/entities/HistorialActivo';
import { Sucursal } from '../../database/entities/Sucursal';
import { ActivosService } from './activos.service';
import { ActivosController } from './activos.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActivoFijo,
      CategoriaActivo,
      HistorialActivo,
      Sucursal,
    ]),
  ],
  controllers: [ActivosController],
  providers: [ActivosService],
  exports: [ActivosService],
})
export class ActivosModule {}

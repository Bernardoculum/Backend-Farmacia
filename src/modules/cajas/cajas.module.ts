import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CajasController } from './cajas.controller';
import { CajasService } from './cajas.service';
import { Caja } from '../../database/entities/Caja';
import { SesionCaja } from '../../database/entities/SesionCaja';
import { MovimientoCaja } from '../../database/entities/MovimientoCaja';
import { Sucursal } from '../../database/entities/Sucursal';
import { Empleado } from '../../database/entities/Empleado';
import { MetodoPago } from '../../database/entities/MetodoPago';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Caja,
      SesionCaja,
      MovimientoCaja,
      Sucursal,
      Empleado,
      MetodoPago,
    ]),
  ],
  controllers: [CajasController],
  providers: [CajasService],
  exports: [CajasService],
})
export class CajasModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanillasController } from './planillas.controller';
import { PlanillasService } from './planillas.service';
import { Planilla } from '../../database/entities/Planilla';
import { PlanillaDetalle } from '../../database/entities/PlanillaDetalle';
import { Empleado } from '../../database/entities/Empleado';
import { Puesto } from '../../database/entities/Puesto';
import { Sucursal } from '../../database/entities/Sucursal';
import { HistorialSalario } from '../../database/entities/HistorialSalario';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Planilla,
      PlanillaDetalle,
      Empleado,
      Puesto,
      Sucursal,
      HistorialSalario,
    ]),
  ],
  controllers: [PlanillasController],
  providers: [PlanillasService],
  exports: [PlanillasService],
})
export class PlanillasModule {}

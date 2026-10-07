import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { Cliente } from '../../database/entities/Cliente';
import { Laboratorio } from '../../database/entities/Laboratorio';
import { Municipio } from '../../database/entities/Municipio';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cliente,
      Laboratorio,
      Municipio,
    ]),
  ],
  controllers: [ClientesController],
  providers: [ClientesService],
  exports: [ClientesService],
})
export class ClientesModule {}

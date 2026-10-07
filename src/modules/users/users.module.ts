import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Credencial } from '../../database/entities/Credencial';
import { Empleado } from '../../database/entities/Empleado';
import { Rol } from '../../database/entities/Rol';
import { Sucursal } from '../../database/entities/Sucursal';
import { Puesto } from '../../database/entities/Puesto';
import { AuditoriaEvento } from '../../database/entities/AuditoriaEvento';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Credencial,
      Empleado,
      Rol,
      Sucursal,
      Puesto,
      AuditoriaEvento,
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

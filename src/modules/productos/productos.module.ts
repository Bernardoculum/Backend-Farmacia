import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductosService } from './productos.service';
import { KardexService } from './kardex.service';
import { ProductosController } from './productos.controller';
import { Producto } from '../../database/entities/Producto';
import { CategoriaProducto } from '../../database/entities/CategoriaProducto';
import { Laboratorio } from '../../database/entities/Laboratorio';
import { UnidadMedida } from '../../database/entities/UnidadMedida';
import { Lote } from '../../database/entities/Lote';
import { Inventario } from '../../database/entities/Inventario';
import { MovimientoInventario } from '../../database/entities/MovimientoInventario';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Producto,
      CategoriaProducto,
      Laboratorio,
      UnidadMedida,
      Lote,
      Inventario,
      MovimientoInventario,
    ]),
  ],
  controllers: [ProductosController],
  providers: [ProductosService, KardexService],
  exports: [ProductosService, KardexService],
})
export class ProductosModule {}

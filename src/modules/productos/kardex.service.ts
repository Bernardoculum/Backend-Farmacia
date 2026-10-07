import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Producto } from '../../database/entities/Producto';
import { Lote } from '../../database/entities/Lote';
import { Inventario } from '../../database/entities/Inventario';
import { MovimientoInventario } from '../../database/entities/MovimientoInventario';
import { MovimientoKardexDto } from './dto/movimiento-kardex.dto';

@Injectable()
export class KardexService {
  private readonly logger = new Logger(KardexService.name);

  constructor(
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(MovimientoInventario)
    private readonly movimientoRepo: Repository<MovimientoInventario>,
    private readonly dataSource: DataSource,
  ) {}

  // Consulta cronológica de los movimientos históricos de un producto
  async getKardexByProducto(productoId: number, sucursalId?: number) {
    const producto = await this.productoRepo.findOne({
      where: { productoId },
    });

    if (!producto) {
      throw new NotFoundException(
        `Producto con ID ${productoId} no encontrado`,
      );
    }

    const query = this.movimientoRepo
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.inventario', 'inv')
      .innerJoinAndSelect('inv.lote', 'lote')
      .innerJoinAndSelect('inv.sucursal', 'suc')
      .where('lote.productoId = :productoId', { productoId });

    if (sucursalId) {
      query.andWhere('inv.sucursalId = :sucursalId', { sucursalId });
    }

    query.orderBy('m.fechaMovimiento', 'DESC');
    query.addOrderBy('m.movimientoInventarioId', 'DESC');

    const movimientos = await query.getMany();

    const historial = movimientos.map((m) => ({
      movimientoId: m.movimientoInventarioId,
      fecha: m.fechaMovimiento,
      tipoMovimiento: m.tipoMovimiento,
      lote: m.inventario.lote.numeroLote,
      vencimientoLote: m.inventario.lote.fechaVencimiento,
      sucursal: m.inventario.sucursal.nombre,
      sucursalId: m.inventario.sucursalId,
      cantidadOperada: Number(m.cantidad),
      saldoAnterior: Number(m.cantidadAnterior),
      saldoNuevo: Number(m.cantidadNueva),
      referenciaTipo: m.referenciaTipo,
      referenciaId: m.referenciaId,
      observacion: m.observacion,
    }));

    return {
      productoId: producto.productoId,
      codigoProducto: producto.codigoProducto,
      producto: producto.nombre,
      totalMovimientos: historial.length,
      historial,
    };
  }

  // Registro transaccional y atómico de un movimiento de Kardex
  async registrarMovimiento(dto: MovimientoKardexDto) {
    return this.dataSource.transaction(async (manager) => {
      // 1. Validar existencia del Producto
      const producto = await manager.findOne(Producto, {
        where: { productoId: dto.productoId },
      });
      if (!producto) {
        throw new NotFoundException(
          `Producto con ID ${dto.productoId} no existe`,
        );
      }

      // 2. Buscar o Crear Lote
      let lote = await manager.findOne(Lote, {
        where: {
          productoId: dto.productoId,
          numeroLote: dto.numeroLote.trim(),
        },
      });

      if (!lote) {
        if (!dto.fechaVencimiento) {
          throw new BadRequestException(
            `El lote "${dto.numeroLote}" no existe en el catálogo. La fecha de vencimiento es requerida para darlo de alta.`,
          );
        }
        lote = manager.create(Lote, {
          productoId: dto.productoId,
          numeroLote: dto.numeroLote.trim(),
          fechaVencimiento: new Date(dto.fechaVencimiento),
          fechaFabricacion: dto.fechaFabricacion
            ? new Date(dto.fechaFabricacion)
            : null,
          costoUnitario: dto.costoUnitario ?? 0,
        });
        lote = await manager.save(lote);
      }

      // 3. Buscar o Crear Inventario para ese Lote en la Sucursal dada
      let inventario = await manager.findOne(Inventario, {
        where: {
          sucursalId: dto.sucursalId,
          loteId: lote.loteId,
        },
      });

      if (!inventario) {
        inventario = manager.create(Inventario, {
          sucursalId: dto.sucursalId,
          loteId: lote.loteId,
          cantidadDisponible: 0,
          cantidadReservada: 0,
          stockMinimo: 0,
          fechaActualizacion: new Date(),
        });
        inventario = await manager.save(inventario);
      }

      // 4. Calcular Saldos según Tipo de Movimiento
      const cantidadAnterior = Number(inventario.cantidadDisponible) || 0;
      let cantidadNueva = 0;
      const cantidadOperada = Number(dto.cantidad);

      if (dto.tipoMovimiento === 'ENTRADA') {
        cantidadNueva = cantidadAnterior + cantidadOperada;
      } else if (dto.tipoMovimiento === 'SALIDA') {
        if (cantidadAnterior < cantidadOperada) {
          throw new BadRequestException(
            `Stock insuficiente en la sucursal para el lote "${lote.numeroLote}". Disponible: ${cantidadAnterior}, Intentando retirar: ${cantidadOperada}`,
          );
        }
        cantidadNueva = cantidadAnterior - cantidadOperada;
      } else if (dto.tipoMovimiento === 'AJUSTE') {
        cantidadNueva = cantidadOperada;
      }

      // 5. Actualizar el Inventario
      inventario.cantidadDisponible = cantidadNueva;
      inventario.fechaActualizacion = new Date();
      await manager.save(inventario);

      // 6. Registrar el asiento inmutable en MOVIMIENTO_INVENTARIO
      const movimiento = manager.create(MovimientoInventario, {
        inventario,
        tipoMovimiento: dto.tipoMovimiento,
        cantidad: cantidadOperada,
        cantidadAnterior,
        cantidadNueva,
        referenciaTipo: dto.referenciaTipo || 'MANUAL',
        referenciaId: dto.referenciaId || null,
        observacion: dto.observacion || null,
        fechaMovimiento: new Date(),
      });

      const movimientoGuardado = await manager.save(movimiento);

      this.logger.log(
        `Kardex registrado [${dto.tipoMovimiento}]: ${producto.nombre} | Lote: ${lote.numeroLote} | Sucursal: ${dto.sucursalId} | Anterior: ${cantidadAnterior} -> Nuevo: ${cantidadNueva}`,
      );

      return {
        mensaje: 'Movimiento de Kardex registrado exitosamente',
        movimientoId: movimientoGuardado.movimientoInventarioId,
        producto: producto.nombre,
        lote: lote.numeroLote,
        sucursalId: dto.sucursalId,
        tipoMovimiento: dto.tipoMovimiento,
        cantidadOperada,
        saldoAnterior: cantidadAnterior,
        saldoNuevo: cantidadNueva,
        fechaMovimiento: movimientoGuardado.fechaMovimiento,
      };
    });
  }
}

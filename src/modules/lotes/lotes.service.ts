import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Lote } from '../../database/entities/Lote';
import { Producto } from '../../database/entities/Producto';
import { Inventario } from '../../database/entities/Inventario';
import { MovimientoInventario } from '../../database/entities/MovimientoInventario';
import { CreateLoteDto } from './dto/create-lote.dto';
import { UpdateLoteDto } from './dto/update-lote.dto';
import { FilterLoteDto } from './dto/filter-lote.dto';

@Injectable()
export class LotesService {
  private readonly logger = new Logger(LotesService.name);

  constructor(
    @InjectRepository(Lote)
    private readonly loteRepo: Repository<Lote>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(Inventario)
    private readonly inventarioRepo: Repository<Inventario>,
    @InjectRepository(MovimientoInventario)
    private readonly movimientoRepo: Repository<MovimientoInventario>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Listado de todos los lotes con cálculo dinámico de caducidad y existencias
   */
  async findAll(filterDto: FilterLoteDto) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const limite90 = new Date(hoy);
    limite90.setDate(limite90.getDate() + 90);

    // 1. Métricas / KPIs calculados según el alcance (global o por sucursal)
    let totalKpi = 0;
    let vigentesKpi = 0;
    let porVencerKpi = 0;
    let vencidosKpi = 0;

    if (filterDto.sucursalId) {
      const baseKpiQb = () =>
        this.loteRepo
          .createQueryBuilder('l')
          .innerJoin(
            'l.inventarios',
            'invKpi',
            'invKpi.sucursalId = :sucId AND invKpi.cantidadDisponible > 0',
            { sucId: filterDto.sucursalId },
          );

      const [tot, vig, porVenc, venc] = await Promise.all([
        baseKpiQb().select('COUNT(DISTINCT l.loteId)', 'cnt').getRawOne(),
        baseKpiQb()
          .andWhere('l.fechaVencimiento > :limite90', { limite90 })
          .select('COUNT(DISTINCT l.loteId)', 'cnt')
          .getRawOne(),
        baseKpiQb()
          .andWhere('l.fechaVencimiento >= :hoy AND l.fechaVencimiento <= :limite90', {
            hoy,
            limite90,
          })
          .select('COUNT(DISTINCT l.loteId)', 'cnt')
          .getRawOne(),
        baseKpiQb()
          .andWhere('l.fechaVencimiento < :hoy', { hoy })
          .select('COUNT(DISTINCT l.loteId)', 'cnt')
          .getRawOne(),
      ]);

      totalKpi = Number(tot?.cnt || 0);
      vigentesKpi = Number(vig?.cnt || 0);
      porVencerKpi = Number(porVenc?.cnt || 0);
      vencidosKpi = Number(venc?.cnt || 0);
    } else {
      const [tot, vig, porVenc, venc] = await Promise.all([
        this.loteRepo.count(),
        this.loteRepo
          .createQueryBuilder('l')
          .where('l.fechaVencimiento > :limite90', { limite90 })
          .getCount(),
        this.loteRepo
          .createQueryBuilder('l')
          .where('l.fechaVencimiento >= :hoy AND l.fechaVencimiento <= :limite90', {
            hoy,
            limite90,
          })
          .getCount(),
        this.loteRepo
          .createQueryBuilder('l')
          .where('l.fechaVencimiento < :hoy', { hoy })
          .getCount(),
      ]);
      totalKpi = tot;
      vigentesKpi = vig;
      porVencerKpi = porVenc;
      vencidosKpi = venc;
    }

    // 2. QueryBuilder con filtros dinámicos y aislamiento de custodia
    const qb = this.loteRepo
      .createQueryBuilder('l')
      .innerJoinAndSelect('l.producto', 'p');

    if (filterDto.sucursalId) {
      // Filtrado estricto por sucursal satélite:
      // INNER JOIN obligatorio con la custodia local (INVENTARIO).
      // Solo lotes transferidos y recibidos con stock físico en esta sede.
      qb.innerJoinAndSelect(
        'l.inventarios',
        'inv',
        'inv.sucursalId = :sucursalId AND inv.cantidadDisponible > 0',
        { sucursalId: filterDto.sucursalId },
      ).innerJoinAndSelect('inv.sucursal', 'suc');
    } else {
      qb.leftJoinAndSelect('l.inventarios', 'inv')
        .leftJoinAndSelect('inv.sucursal', 'suc');
    }

    if (filterDto.search?.trim()) {
      const term = `%${filterDto.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(l.numeroLote) LIKE :term OR LOWER(p.nombre) LIKE :term OR LOWER(p.codigoProducto) LIKE :term)',
        { term },
      );
    }

    if (filterDto.productoId) {
      qb.andWhere('l.productoId = :productoId', {
        productoId: filterDto.productoId,
      });
    }

    // Filtro semafórico a nivel de base de datos SQL
    if (filterDto.estadoVencimiento && filterDto.estadoVencimiento !== 'TODOS') {
      if (filterDto.estadoVencimiento === 'VENCIDO') {
        qb.andWhere('l.fechaVencimiento < :hoy', { hoy });
      } else if (filterDto.estadoVencimiento === 'POR_VENCER') {
        qb.andWhere(
          'l.fechaVencimiento >= :hoy AND l.fechaVencimiento <= :limite90',
          { hoy, limite90 },
        );
      } else if (filterDto.estadoVencimiento === 'VIGENTE') {
        qb.andWhere('l.fechaVencimiento > :limite90', { limite90 });
      }
    }

    qb.orderBy('l.fechaVencimiento', 'ASC');

    // 3. Paginación Server-Side (OFFSET y FETCH en Oracle DB)
    const page = Number(filterDto.page) || 1;
    const limit = Number(filterDto.limit) || 10;
    const skip = (page - 1) * limit;

    qb.skip(skip).take(limit);

    const [lotes, total] = await qb.getManyAndCount();

    // 4. Mapeo y proyección limpia de las filas de la página actual
    const data = lotes.map((lote) => {
      const fechaVenc = new Date(lote.fechaVencimiento);
      fechaVenc.setHours(0, 0, 0, 0);

      const diffTime = fechaVenc.getTime() - hoy.getTime();
      const diasParaVencer = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let estadoVencimiento: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO';
      if (diasParaVencer < 0) {
        estadoVencimiento = 'VENCIDO';
      } else if (diasParaVencer <= 90) {
        estadoVencimiento = 'POR_VENCER';
      } else {
        estadoVencimiento = 'VIGENTE';
      }

      let stockTotalLote = 0;
      const inventariosRaw = filterDto.sucursalId
        ? (lote.inventarios || []).filter(
            (inv) => Number(inv.sucursalId) === Number(filterDto.sucursalId),
          )
        : (lote.inventarios || []);

      const inventariosDesglose = inventariosRaw.map((inv) => {
        const disp = Number(inv.cantidadDisponible) || 0;
        stockTotalLote += disp;
        return {
          inventarioId: inv.inventarioId,
          sucursalId: inv.sucursalId,
          sucursal: inv.sucursal?.nombre || `Sucursal ${inv.sucursalId}`,
          disponible: disp,
          reservado: Number(inv.cantidadReservada) || 0,
        };
      });

      return {
        loteId: lote.loteId,
        numeroLote: lote.numeroLote,
        fechaVencimiento: lote.fechaVencimiento,
        fechaFabricacion: lote.fechaFabricacion,
        costoUnitario: Number(lote.costoUnitario),
        diasParaVencer,
        estadoVencimiento,
        producto: {
          productoId: lote.producto.productoId,
          codigoProducto: lote.producto.codigoProducto,
          nombre: lote.producto.nombre,
          principioActivo: lote.producto.principioActivo,
          presentacion: lote.producto.presentacion,
          concentracion: lote.producto.concentracion,
          precioVenta: Number(lote.producto.precioVenta),
          requiereReceta: lote.producto.requiereReceta,
        },
        stockTotalLote,
        stockEnSede: stockTotalLote,
        inventarios: inventariosDesglose,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      kpis: {
        total: totalKpi,
        vigentes: vigentesKpi,
        porVencer: porVencerKpi,
        vencidos: vencidosKpi,
      },
    };
  }

  /**
   * Detalle de un lote específico
   */
  async findOne(id: number, sucursalId?: number) {
    const lote = await this.loteRepo.findOne({
      where: { loteId: id },
      relations: {
        producto: true,
        inventarios: {
          sucursal: true,
        },
      },
    });

    if (!lote) {
      throw new NotFoundException(`Lote con ID ${id} no encontrado`);
    }

    if (sucursalId) {
      const tieneEnSucursal = (lote.inventarios || []).some(
        (inv) => Number(inv.sucursalId) === Number(sucursalId),
      );
      if (!tieneEnSucursal) {
        throw new NotFoundException(
          `El lote con ID ${id} no pertenece ni cuenta con inventario en tu sucursal.`,
        );
      }
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaVenc = new Date(lote.fechaVencimiento);
    fechaVenc.setHours(0, 0, 0, 0);

    const diffTime = fechaVenc.getTime() - hoy.getTime();
    const diasParaVencer = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let estadoVencimiento: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO';
    if (diasParaVencer < 0) {
      estadoVencimiento = 'VENCIDO';
    } else if (diasParaVencer <= 90) {
      estadoVencimiento = 'POR_VENCER';
    } else {
      estadoVencimiento = 'VIGENTE';
    }

    let stockTotalLote = 0;
    const rawInventarios = sucursalId
      ? (lote.inventarios || []).filter(
          (inv) => Number(inv.sucursalId) === Number(sucursalId),
        )
      : (lote.inventarios || []);

    const inventarios = rawInventarios.map((inv) => {
      const disp = Number(inv.cantidadDisponible) || 0;
      stockTotalLote += disp;
      return {
        inventarioId: inv.inventarioId,
        sucursalId: inv.sucursalId,
        sucursal: inv.sucursal?.nombre,
        disponible: disp,
        reservado: Number(inv.cantidadReservada) || 0,
      };
    });

    return {
      loteId: lote.loteId,
      numeroLote: lote.numeroLote,
      fechaVencimiento: lote.fechaVencimiento,
      fechaFabricacion: lote.fechaFabricacion,
      costoUnitario: Number(lote.costoUnitario),
      diasParaVencer,
      estadoVencimiento,
      producto: lote.producto,
      stockTotalLote,
      inventarios,
    };
  }

  /**
   * Creación transaccional de un nuevo Lote (con stock inicial opcional en Kardex)
   */
  async create(dto: CreateLoteDto) {
    return this.dataSource.transaction(async (manager) => {
      // 1. Validar que el producto exista
      const producto = await manager.findOne(Producto, {
        where: { productoId: dto.productoId },
      });
      if (!producto) {
        throw new NotFoundException(
          `Producto con ID ${dto.productoId} no encontrado`,
        );
      }

      // 2. Validar que el número de lote no exista ya para este producto
      const loteExistente = await manager.findOne(Lote, {
        where: {
          productoId: dto.productoId,
          numeroLote: dto.numeroLote.trim(),
        },
      });

      if (loteExistente) {
        throw new ConflictException(
          `El lote "${dto.numeroLote}" ya se encuentra registrado para el producto "${producto.nombre}"`,
        );
      }

      // 3. Crear y persistir el lote
      const nuevoLote = manager.create(Lote, {
        productoId: dto.productoId,
        numeroLote: dto.numeroLote.trim(),
        fechaVencimiento: new Date(dto.fechaVencimiento),
        fechaFabricacion: dto.fechaFabricacion
          ? new Date(dto.fechaFabricacion)
          : null,
        costoUnitario: dto.costoUnitario,
      });

      const loteGuardado = await manager.save(nuevoLote);
      this.logger.log(
        `Lote creado: ${loteGuardado.numeroLote} para producto: ${producto.nombre} (ID: ${loteGuardado.loteId})`,
      );

      // 3.5. Si se especificó un nuevo precio de venta al público, actualizar el producto
      if (dto.nuevoPrecioVenta && Number(dto.nuevoPrecioVenta) > 0) {
        producto.precioVenta = Number(dto.nuevoPrecioVenta);
        await manager.save(producto);
        this.logger.log(
          `Precio de venta de "${producto.nombre}" actualizado a Q ${producto.precioVenta.toFixed(2)}`,
        );
      }

      // 4. Si se especificó stock inicial y sucursal, asentar en Inventario y Kardex
      let stockAsignado = 0;
      if (dto.sucursalId && dto.stockInicial && dto.stockInicial > 0) {
        stockAsignado = Number(dto.stockInicial);

        const inventario = manager.create(Inventario, {
          sucursalId: dto.sucursalId,
          loteId: loteGuardado.loteId,
          cantidadDisponible: stockAsignado,
          cantidadReservada: 0,
          stockMinimo: 0,
          fechaActualizacion: new Date(),
        });

        const inventarioGuardado = await manager.save(inventario);

        // Registro de Kardex
        const movimiento = manager.create(MovimientoInventario, {
          inventario: inventarioGuardado,
          tipoMovimiento: 'ENTRADA',
          cantidad: stockAsignado,
          cantidadAnterior: 0,
          cantidadNueva: stockAsignado,
          referenciaTipo: 'INGRESO_LOTE_NUEVO',
          referenciaId: loteGuardado.loteId,
          observacion: `Ingreso inicial al crear lote ${loteGuardado.numeroLote}`,
          fechaMovimiento: new Date(),
        });

        await manager.save(movimiento);
        this.logger.log(
          `Stock inicial asignado: ${stockAsignado} unidades en sucursal ${dto.sucursalId} con asiento en Kardex`,
        );
      }

      return {
        mensaje: 'Lote registrado exitosamente',
        loteId: loteGuardado.loteId,
        numeroLote: loteGuardado.numeroLote,
        producto: producto.nombre,
        fechaVencimiento: loteGuardado.fechaVencimiento,
        costoUnitario: loteGuardado.costoUnitario,
        stockInicial: stockAsignado,
      };
    });
  }

  /**
   * Creación transaccional de múltiples Lotes / Recepción de Mercancía en Factura
   */
  async createBatch(items: CreateLoteDto[]) {
    if (!items || items.length === 0) {
      throw new BadRequestException('Debes enviar al menos un medicamento/lote para ingresar.');
    }

    return this.dataSource.transaction(async (manager) => {
      let totalUnidades = 0;
      let totalInvertido = 0;
      const lotesCreados: any[] = [];

      for (const dto of items) {
        // 1. Validar producto
        const producto = await manager.findOne(Producto, {
          where: { productoId: dto.productoId },
        });
        if (!producto) {
          throw new NotFoundException(`Producto con ID ${dto.productoId} no encontrado`);
        }

        // 2. Validar que no exista ya este lote para el producto
        const loteExistente = await manager.findOne(Lote, {
          where: {
            productoId: dto.productoId,
            numeroLote: dto.numeroLote.trim(),
          },
        });

        if (loteExistente) {
          throw new ConflictException(
            `El lote "${dto.numeroLote}" ya se encuentra registrado para el producto "${producto.nombre}".`,
          );
        }

        // 3. Crear Lote
        const nuevoLote = manager.create(Lote, {
          productoId: dto.productoId,
          numeroLote: dto.numeroLote.trim(),
          fechaVencimiento: new Date(dto.fechaVencimiento),
          fechaFabricacion: dto.fechaFabricacion ? new Date(dto.fechaFabricacion) : null,
          costoUnitario: Number(dto.costoUnitario),
        });
        const loteGuardado = await manager.save(nuevoLote);

        // 3.5. Si se especificó un nuevo precio de venta al público, actualizar el producto
        if (dto.nuevoPrecioVenta && Number(dto.nuevoPrecioVenta) > 0) {
          producto.precioVenta = Number(dto.nuevoPrecioVenta);
          await manager.save(producto);
          this.logger.log(
            `Precio de venta de "${producto.nombre}" actualizado a Q ${producto.precioVenta.toFixed(2)}`,
          );
        }

        // 4. Inventario + Kardex
        const stockAsignado = Number(dto.stockInicial) || 0;
        const sucId = dto.sucursalId ? Number(dto.sucursalId) : 1; // Default Bodega Central

        if (stockAsignado > 0) {
          const inventario = manager.create(Inventario, {
            sucursalId: sucId,
            loteId: loteGuardado.loteId,
            cantidadDisponible: stockAsignado,
            cantidadReservada: 0,
            stockMinimo: 0,
            fechaActualizacion: new Date(),
          });
          const inventarioGuardado = await manager.save(inventario);

          const movimiento = manager.create(MovimientoInventario, {
            inventario: inventarioGuardado,
            tipoMovimiento: 'ENTRADA',
            cantidad: stockAsignado,
            cantidadAnterior: 0,
            cantidadNueva: stockAsignado,
            referenciaTipo: 'RECEPCION_FACTURA_COMPRA',
            referenciaId: loteGuardado.loteId,
            observacion: dto.observacion
              ? dto.observacion.trim()
              : `Recepción de factura / ingreso de lote ${loteGuardado.numeroLote}`,
            fechaMovimiento: new Date(),
          });
          await manager.save(movimiento);
        }

        const subtotal = stockAsignado * Number(dto.costoUnitario);
        totalUnidades += stockAsignado;
        totalInvertido += subtotal;

        lotesCreados.push({
          loteId: loteGuardado.loteId,
          numeroLote: loteGuardado.numeroLote,
          producto: producto.nombre,
          cantidad: stockAsignado,
          costoUnitario: Number(dto.costoUnitario),
          subtotal,
        });
      }

      this.logger.log(
        `Recepción completada en sucursal: ${lotesCreados.length} lotes creados | Total Unidades: ${totalUnidades} | Total Invertido: Q ${totalInvertido.toFixed(2)}`,
      );

      return {
        mensaje: `Recepción de mercadería registrada exitosamente (${lotesCreados.length} medicamentos)`,
        totalMedicamentos: lotesCreados.length,
        totalUnidades,
        totalInvertido,
        items: lotesCreados,
      };
    });
  }

  /**
   * Actualizar fecha de vencimiento o costo de un lote
   */
  async update(id: number, dto: UpdateLoteDto) {
    const lote = await this.loteRepo.findOne({ where: { loteId: id } });
    if (!lote) {
      throw new NotFoundException(`Lote con ID ${id} no encontrado`);
    }

    if (dto.fechaVencimiento) {
      lote.fechaVencimiento = new Date(dto.fechaVencimiento);
    }
    if (dto.costoUnitario !== undefined) {
      lote.costoUnitario = dto.costoUnitario;
    }

    await this.loteRepo.save(lote);
    return {
      mensaje: 'Lote actualizado exitosamente',
      loteId: lote.loteId,
      numeroLote: lote.numeroLote,
      fechaVencimiento: lote.fechaVencimiento,
      costoUnitario: lote.costoUnitario,
    };
  }

  /**
   * Dar de baja un lote caducado / merma sanitaria con asiento en Kardex
   */
  async darDeBajaLote(id: number, motivo?: string, sucursalId?: number) {
    return this.dataSource.transaction(async (manager) => {
      const lote = await manager.findOne(Lote, {
        where: { loteId: id },
        relations: {
          producto: true,
          inventarios: {
            sucursal: true,
          },
        },
      });

      if (!lote) {
        throw new NotFoundException(`Lote con ID ${id} no encontrado`);
      }

      // Si se especifica una sucursal (ej. gerente local), solo dar de baja el inventario de su sucursal
      const inventariosAfectados = sucursalId
        ? (lote.inventarios || []).filter(
            (inv) => Number(inv.sucursalId) === Number(sucursalId),
          )
        : (lote.inventarios || []);

      if (sucursalId && inventariosAfectados.length === 0) {
        throw new BadRequestException(
          `El lote ${lote.numeroLote} no tiene existencias registradas en tu sucursal.`,
        );
      }

      let totalRetirado = 0;
      const movimientosCreados = [];

      for (const inv of inventariosAfectados) {
        const disponible = Number(inv.cantidadDisponible) || 0;
        if (disponible > 0) {
          totalRetirado += disponible;

          // Asiento en Kardex de Salida por Merma / Caducidad
          const movimiento = manager.create(MovimientoInventario, {
            inventario: inv,
            tipoMovimiento: 'SALIDA',
            cantidad: disponible,
            cantidadAnterior: disponible,
            cantidadNueva: 0,
            referenciaTipo: 'MERMA_CADUCIDAD',
            referenciaId: lote.loteId,
            observacion: motivo
              ? motivo.trim()
              : `Baja sanitaria por caducidad del lote ${lote.numeroLote} en ${inv.sucursal?.nombre || 'Sucursal'}`,
            fechaMovimiento: new Date(),
          });
          await manager.save(movimiento);

          inv.cantidadDisponible = 0;
          inv.fechaActualizacion = new Date();
          await manager.save(inv);

          movimientosCreados.push({
            sucursal: inv.sucursal?.nombre,
            unidadesRetiradas: disponible,
          });
        }
      }

      if (totalRetirado === 0) {
        throw new BadRequestException(
          `El lote ${lote.numeroLote} no tiene unidades disponibles para dar de baja${
            sucursalId ? ' en tu sucursal' : ''
          }.`,
        );
      }

      const costoPerdida = totalRetirado * Number(lote.costoUnitario);

      this.logger.warn(
        `Lote ${lote.numeroLote} (${lote.producto.nombre}) dado de baja: ${totalRetirado} unidades retiradas${
          sucursalId ? ` en sucursal ${sucursalId}` : ''
        }. Pérdida: Q ${costoPerdida.toFixed(2)}`,
      );

      return {
        mensaje: `Lote ${lote.numeroLote} retirado del inventario y enviado a merma sanitaria exitosamente`,
        loteId: lote.loteId,
        numeroLote: lote.numeroLote,
        medicamento: lote.producto.nombre,
        totalUnidadesRetiradas: totalRetirado,
        costoPerdida,
        desglose: movimientosCreados,
      };
    });
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MovimientoInventario } from '../../database/entities/MovimientoInventario';
import { AuditoriaEvento } from '../../database/entities/AuditoriaEvento';
import { Inventario } from '../../database/entities/Inventario';
import { FilterKardexDto, FilterAuditoriaDto } from './dto/filter-kardex.dto';
import { AjusteInventarioDto } from './dto/ajuste-inventario.dto';

@Injectable()
export class KardexService {
  private readonly logger = new Logger(KardexService.name);

  constructor(
    @InjectRepository(MovimientoInventario)
    private readonly movimientoRepo: Repository<MovimientoInventario>,
    @InjectRepository(AuditoriaEvento)
    private readonly auditoriaRepo: Repository<AuditoriaEvento>,
    @InjectRepository(Inventario)
    private readonly inventarioRepo: Repository<Inventario>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Consultar movimientos de Kardex con paginación server-side y KPIs
   */
  async findAllMovimientos(filters: FilterKardexDto) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const qb = this.movimientoRepo
      .createQueryBuilder('mov')
      .innerJoinAndSelect('mov.inventario', 'inv')
      .innerJoinAndSelect('inv.lote', 'lote')
      .innerJoinAndSelect('lote.producto', 'producto')
      .leftJoinAndSelect('inv.sucursal', 'sucursal');

    if (filters.sucursalId) {
      qb.andWhere('inv.sucursalId = :sucursalId', { sucursalId: filters.sucursalId });
    }

    if (filters.productoId) {
      qb.andWhere('lote.productoId = :productoId', { productoId: filters.productoId });
    }

    if (filters.tipoMovimiento && filters.tipoMovimiento !== 'TODOS') {
      qb.andWhere('mov.tipoMovimiento = :tipo', { tipo: filters.tipoMovimiento });
    }

    if (filters.referenciaTipo) {
      qb.andWhere('mov.referenciaTipo = :refTipo', { refTipo: filters.referenciaTipo });
    }

    if (filters.search) {
      const term = `%${filters.search.toLowerCase().trim()}%`;
      qb.andWhere(
        '(LOWER(producto.nombre) LIKE :term OR LOWER(lote.numeroLote) LIKE :term OR LOWER(mov.observacion) LIKE :term)',
        { term },
      );
    }

    if (filters.fechaDesde) {
      qb.andWhere('mov.fechaMovimiento >= TO_TIMESTAMP(:fDesde, \'YYYY-MM-DD\')', {
        fDesde: filters.fechaDesde,
      });
    }

    if (filters.fechaHasta) {
      qb.andWhere('mov.fechaMovimiento <= TO_TIMESTAMP(:fHasta, \'YYYY-MM-DD HH24:MI:SS\')', {
        fHasta: `${filters.fechaHasta} 23:59:59`,
      });
    }

    qb.orderBy('mov.fechaMovimiento', 'DESC')
      .addOrderBy('mov.movimientoInventarioId', 'DESC');
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    // KPIs globales
    const kpiQb = this.movimientoRepo.createQueryBuilder('mov').innerJoin('mov.inventario', 'inv');
    if (filters.sucursalId) {
      kpiQb.where('inv.sucursalId = :sucursalId', { sucursalId: filters.sucursalId });
    }

    const totalKpi = await kpiQb.getCount();
    const entradasKpi = await kpiQb
      .clone()
      .andWhere('mov.tipoMovimiento = :tipo', { tipo: 'ENTRADA' })
      .getCount();
    const salidasKpi = await kpiQb
      .clone()
      .andWhere('mov.tipoMovimiento = :tipo', { tipo: 'SALIDA' })
      .getCount();
    const mermasKpi = await kpiQb
      .clone()
      .andWhere('mov.referenciaTipo = :ref', { ref: 'MERMA_CADUCIDAD' })
      .getCount();

    const data = items.map((m) => ({
      movimientoInventarioId: m.movimientoInventarioId,
      tipoMovimiento: m.tipoMovimiento,
      cantidad: Number(m.cantidad),
      cantidadAnterior: Number(m.cantidadAnterior),
      cantidadNueva: Number(m.cantidadNueva),
      referenciaTipo: m.referenciaTipo,
      referenciaId: m.referenciaId,
      observacion: m.observacion,
      fechaMovimiento: m.fechaMovimiento,
      medicamento: m.inventario?.lote?.producto?.nombre || 'Medicamento',
      codigoProducto: m.inventario?.lote?.producto?.codigoProducto,
      numeroLote: m.inventario?.lote?.numeroLote,
      costoUnitario: Number(m.inventario?.lote?.costoUnitario || 0),
      totalValorizado: Number(m.cantidad) * Number(m.inventario?.lote?.costoUnitario || 0),
      sucursal: m.inventario?.sucursal?.nombre || 'Sucursal',
      sucursalId: m.inventario?.sucursalId,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      kpis: {
        total: totalKpi,
        entradas: entradasKpi,
        salidas: salidasKpi,
        mermas: mermasKpi,
      },
    };
  }

  /**
   * Consultar bitácora de auditoría forense
   */
  async findAllAuditoria(filters: FilterAuditoriaDto) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const qb = this.auditoriaRepo.createQueryBuilder('aud');

    if (filters.tablaAfectada) {
      qb.andWhere('aud.tablaAfectada = :tabla', { tabla: filters.tablaAfectada });
    }

    if (filters.operacion) {
      qb.andWhere('aud.operacion = :op', { op: filters.operacion });
    }

    if (filters.search) {
      const term = `%${filters.search.toLowerCase().trim()}%`;
      qb.andWhere(
        '(LOWER(aud.descripcion) LIKE :term OR LOWER(aud.modulo) LIKE :term OR LOWER(aud.usuarioBd) LIKE :term)',
        { term },
      );
    }

    qb.orderBy('aud.fechaEvento', 'DESC');
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Registrar ajuste manual auditado en Kardex
   */
  async registrarAjuste(dto: AjusteInventarioDto, user: any) {
    return this.dataSource.transaction(async (manager) => {
      const inv = await manager.findOne(Inventario, {
        where: { inventarioId: dto.inventarioId },
        relations: {
          lote: { producto: true },
          sucursal: true,
        },
      });

      if (!inv) {
        throw new NotFoundException(`Registro de inventario con ID ${dto.inventarioId} no encontrado`);
      }

      const esGlobal =
        user?.rol === 'SUPER_ADMIN' ||
        user?.rol === 'AUDITOR' ||
        (user?.rol === 'GERENTE_SUCURSAL' &&
          (user?.tipoSucursal === 'BODEGA_CENTRAL' || user?.sucursalId === 1));

      if (!esGlobal && user?.sucursalId && Number(inv.sucursalId) !== Number(user.sucursalId)) {
        throw new BadRequestException(
          'No tienes permisos para realizar ajustes de inventario en una sucursal distinta a la tuya.',
        );
      }

      const anterior = Number(inv.cantidadDisponible) || 0;
      let nueva = anterior;

      if (dto.tipoAjuste === 'ENTRADA') {
        nueva = anterior + Number(dto.cantidad);
      } else {
        if (anterior < Number(dto.cantidad)) {
          throw new BadRequestException(
            `No se puede realizar un ajuste de salida por ${dto.cantidad} unidades. El stock disponible actual es de ${anterior}.`,
          );
        }
        nueva = anterior - Number(dto.cantidad);
      }

      inv.cantidadDisponible = nueva;
      inv.fechaActualizacion = new Date();
      await manager.save(inv);

      // Asiento en Kardex
      const mov = manager.create(MovimientoInventario, {
        inventario: inv,
        tipoMovimiento: dto.tipoAjuste,
        cantidad: Number(dto.cantidad),
        cantidadAnterior: anterior,
        cantidadNueva: nueva,
        referenciaTipo: 'AJUSTE_AUDITORIA',
        referenciaId: inv.inventarioId,
        observacion: dto.motivo.trim(),
        fechaMovimiento: new Date(),
      });
      await manager.save(mov);

      // Asiento en Auditoría de Eventos
      const aud = manager.create(AuditoriaEvento, {
        tablaAfectada: 'INVENTARIO',
        registroId: inv.inventarioId,
        operacion: 'AJUSTE_MANUAL',
        modulo: 'KARDEX_INVENTARIO',
        usuarioBd: user?.username || 'SYSTEM',
        ipCliente: '127.0.0.1',
        fechaEvento: new Date(),
        descripcion: `Ajuste manual ${dto.tipoAjuste} de ${dto.cantidad} unidades en ${inv.lote?.producto?.nombre} (Lote: ${inv.lote?.numeroLote}). Motivo: ${dto.motivo.trim()}`,
      });
      await manager.save(aud);

      this.logger.log(
        `Ajuste de inventario aplicado: ${dto.tipoAjuste} ${dto.cantidad} unidades para ${inv.lote?.producto?.nombre}. Stock previo: ${anterior} -> Nuevo: ${nueva}`,
      );

      return {
        mensaje: 'Ajuste de inventario registrado y auditado exitosamente en Kardex',
        movimientoId: mov.movimientoInventarioId,
        medicamento: inv.lote?.producto?.nombre,
        lote: inv.lote?.numeroLote,
        sucursal: inv.sucursal?.nombre,
        tipoMovimiento: mov.tipoMovimiento,
        cantidadAjustada: dto.cantidad,
        cantidadAnterior: anterior,
        cantidadNueva: nueva,
      };
    });
  }
}

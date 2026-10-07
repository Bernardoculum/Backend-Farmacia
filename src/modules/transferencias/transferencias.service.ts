import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Transferencia } from '../../database/entities/Transferencia';
import { TransferenciaDetalle } from '../../database/entities/TransferenciaDetalle';
import { Sucursal } from '../../database/entities/Sucursal';
import { Lote } from '../../database/entities/Lote';
import { Inventario } from '../../database/entities/Inventario';
import { MovimientoInventario } from '../../database/entities/MovimientoInventario';
import { CreateTransferenciaDto } from './dto/create-transferencia.dto';
import { FilterTransferenciaDto } from './dto/filter-transferencia.dto';
import { DespacharTransferenciaDto } from './dto/despachar-transferencia.dto';
import { RecibirTransferenciaDto } from './dto/recibir-transferencia.dto';

@Injectable()
export class TransferenciasService {
  private readonly logger = new Logger(TransferenciasService.name);

  constructor(
    @InjectRepository(Transferencia)
    private readonly transferenciaRepo: Repository<Transferencia>,
    @InjectRepository(TransferenciaDetalle)
    private readonly detalleRepo: Repository<TransferenciaDetalle>,
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
    @InjectRepository(Lote)
    private readonly loteRepo: Repository<Lote>,
    @InjectRepository(Inventario)
    private readonly inventarioRepo: Repository<Inventario>,
    @InjectRepository(MovimientoInventario)
    private readonly movimientoRepo: Repository<MovimientoInventario>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Listado paginado de transferencias con cálculo de KPIs agregados (OFFSET / FETCH)
   */
  async findAll(filterDto: FilterTransferenciaDto) {
    // 1. KPIs globales agregados mediante COUNT a nivel de base de datos
    const [totalKpi, solicitadasKpi, enTransitoKpi, recibidasKpi, canceladasKpi] =
      await Promise.all([
        this.transferenciaRepo.count(),
        this.transferenciaRepo.count({ where: { estado: 'SOLICITADA' } }),
        this.transferenciaRepo.count({ where: { estado: 'EN_TRANSITO' } }),
        this.transferenciaRepo.count({ where: { estado: 'RECIBIDA' } }),
        this.transferenciaRepo.count({ where: { estado: 'CANCELADA' } }),
      ]);

    // 2. QueryBuilder principal con relaciones y filtros dinámicos
    const qb = this.transferenciaRepo
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.sucursalOrigen', 'so')
      .innerJoinAndSelect('t.sucursalDestino', 'sd')
      .leftJoinAndSelect('t.transferenciaDetalles', 'td')
      .leftJoinAndSelect('td.lote', 'l')
      .leftJoinAndSelect('l.producto', 'p');

    if (filterDto.search?.trim()) {
      const term = `%${filterDto.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(t.observacion) LIKE :term OR CAST(t.transferenciaId AS VARCHAR2(20)) LIKE :term OR LOWER(so.nombre) LIKE :term OR LOWER(sd.nombre) LIKE :term)',
        { term },
      );
    }

    if (filterDto.sucursalOrigenId) {
      qb.andWhere('t.sucursalOrigen.sucursalId = :origenId', {
        origenId: filterDto.sucursalOrigenId,
      });
    }

    if (filterDto.sucursalDestinoId) {
      qb.andWhere('t.sucursalDestino.sucursalId = :destinoId', {
        destinoId: filterDto.sucursalDestinoId,
      });
    }

    if (filterDto.sucursalId) {
      qb.andWhere(
        '(t.sucursalOrigen.sucursalId = :sucId OR t.sucursalDestino.sucursalId = :sucId)',
        { sucId: filterDto.sucursalId },
      );
    }

    if (filterDto.estado) {
      qb.andWhere('t.estado = :estado', { estado: filterDto.estado });
    }

    qb.orderBy('t.fechaSolicitud', 'DESC');

    // 3. Paginación Server-Side (OFFSET :skip ROWS FETCH NEXT :limit ROWS ONLY)
    const page = Number(filterDto.page) || 1;
    const limit = Number(filterDto.limit) || 10;
    const skip = (page - 1) * limit;

    qb.skip(skip).take(limit);

    const [transferencias, total] = await qb.getManyAndCount();

    // 4. Mapeo limpio y desacoplado
    const data = transferencias.map((t) => {
      let totalUnidadesSolicitadas = 0;
      let totalUnidadesEnviadas = 0;
      let totalUnidadesRecibidas = 0;

      const items = (t.transferenciaDetalles || []).map((d) => {
        totalUnidadesSolicitadas += Number(d.cantidadSolicitada) || 0;
        totalUnidadesEnviadas += Number(d.cantidadEnviada) || 0;
        totalUnidadesRecibidas += Number(d.cantidadRecibida) || 0;

        return {
          transferenciaDetalleId: d.transferenciaDetalleId,
          loteId: d.loteId,
          numeroLote: d.lote?.numeroLote,
          fechaVencimiento: d.lote?.fechaVencimiento,
          medicamento: d.lote?.producto?.nombre || 'Medicamento',
          codigoProducto: d.lote?.producto?.codigoProducto,
          presentacion: d.lote?.producto?.presentacion,
          cantidadSolicitada: Number(d.cantidadSolicitada),
          cantidadEnviada: Number(d.cantidadEnviada),
          cantidadRecibida: Number(d.cantidadRecibida),
        };
      });

      return {
        transferenciaId: t.transferenciaId,
        estado: t.estado,
        fechaSolicitud: t.fechaSolicitud,
        fechaEnvio: t.fechaEnvio,
        fechaRecepcion: t.fechaRecepcion,
        observacion: t.observacion,
        sucursalOrigen: {
          sucursalId: t.sucursalOrigen?.sucursalId,
          nombre: t.sucursalOrigen?.nombre,
          tipoSucursal: t.sucursalOrigen?.tipoSucursal,
        },
        sucursalDestino: {
          sucursalId: t.sucursalDestino?.sucursalId,
          nombre: t.sucursalDestino?.nombre,
          tipoSucursal: t.sucursalDestino?.tipoSucursal,
        },
        resumen: {
          totalMedicamentos: items.length,
          totalUnidadesSolicitadas,
          totalUnidadesEnviadas,
          totalUnidadesRecibidas,
        },
        detalles: items,
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
        solicitadas: solicitadasKpi,
        enTransito: enTransitoKpi,
        recibidas: recibidasKpi,
        canceladas: canceladasKpi,
      },
    };
  }

  /**
   * Obtener detalle completo de una transferencia
   */
  async findOne(id: number) {
    const t = await this.transferenciaRepo.findOne({
      where: { transferenciaId: id },
      relations: {
        sucursalOrigen: true,
        sucursalDestino: true,
        transferenciaDetalles: {
          lote: {
            producto: true,
          },
        },
      },
    });

    if (!t) {
      throw new NotFoundException(`Transferencia #${id} no encontrada`);
    }

    return {
      transferenciaId: t.transferenciaId,
      estado: t.estado,
      fechaSolicitud: t.fechaSolicitud,
      fechaEnvio: t.fechaEnvio,
      fechaRecepcion: t.fechaRecepcion,
      observacion: t.observacion,
      sucursalOrigen: {
        sucursalId: t.sucursalOrigen.sucursalId,
        nombre: t.sucursalOrigen.nombre,
        tipoSucursal: t.sucursalOrigen.tipoSucursal,
        direccion: t.sucursalOrigen.direccion,
      },
      sucursalDestino: {
        sucursalId: t.sucursalDestino.sucursalId,
        nombre: t.sucursalDestino.nombre,
        tipoSucursal: t.sucursalDestino.tipoSucursal,
        direccion: t.sucursalDestino.direccion,
      },
      detalles: (t.transferenciaDetalles || []).map((d) => ({
        transferenciaDetalleId: d.transferenciaDetalleId,
        loteId: d.loteId,
        numeroLote: d.lote?.numeroLote,
        fechaVencimiento: d.lote?.fechaVencimiento,
        productoId: d.lote?.producto?.productoId,
        medicamento: d.lote?.producto?.nombre,
        codigoProducto: d.lote?.producto?.codigoProducto,
        concentracion: d.lote?.producto?.concentracion,
        presentacion: d.lote?.producto?.presentacion,
        costoUnitario: Number(d.lote?.costoUnitario || 0),
        cantidadSolicitada: Number(d.cantidadSolicitada),
        cantidadEnviada: Number(d.cantidadEnviada),
        cantidadRecibida: Number(d.cantidadRecibida),
      })),
    };
  }

  /**
   * Obtiene los lotes con existencias disponibles en la sucursal emisora/origen
   * para agregarlos a una solicitud de transferencia.
   */
  async getLotesDisponiblesOrigen(sucursalId: number) {
    const targetSucursalId = Number(sucursalId) || 1;

    const inventarios = await this.inventarioRepo
      .createQueryBuilder('inv')
      .innerJoinAndSelect('inv.lote', 'l')
      .innerJoinAndSelect('l.producto', 'p')
      .innerJoinAndSelect('inv.sucursal', 's')
      .where('inv.sucursalId = :sucId AND inv.cantidadDisponible > 0', {
        sucId: targetSucursalId,
      })
      .orderBy('l.fechaVencimiento', 'ASC')
      .getMany();

    return inventarios.map((inv) => ({
      loteId: inv.lote.loteId,
      numeroLote: inv.lote.numeroLote,
      fechaVencimiento: inv.lote.fechaVencimiento,
      productoId: inv.lote.producto.productoId,
      productoNombre: inv.lote.producto.nombre,
      codigoProducto: inv.lote.producto.codigoProducto,
      stockDisponible: Number(inv.cantidadDisponible),
      costoUnitario: Number(inv.lote.costoUnitario || 0),
      sucursalId: inv.sucursalId,
      sucursalNombre: inv.sucursal.nombre,
    }));
  }

  /**
   * Registrar una nueva solicitud de transferencia (Transacción Atómica)
   */
  async crearTransferencia(dto: CreateTransferenciaDto) {
    if (dto.sucursalOrigenId === dto.sucursalDestinoId) {
      throw new BadRequestException(
        'La sucursal de origen y de destino no pueden ser la misma (Restricción CK_TRANSFERENCIA_SUC).',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // 1. Validar sucursales
      const origen = await manager.findOne(Sucursal, {
        where: { sucursalId: dto.sucursalOrigenId },
      });
      if (!origen) {
        throw new NotFoundException(`Sucursal de origen #${dto.sucursalOrigenId} no existe`);
      }

      const destino = await manager.findOne(Sucursal, {
        where: { sucursalId: dto.sucursalDestinoId },
      });
      if (!destino) {
        throw new NotFoundException(`Sucursal de destino #${dto.sucursalDestinoId} no existe`);
      }

      // 2. Validar que no haya lotes duplicados en la lista (UQ_TRANS_DET)
      const loteIdsSet = new Set<number>();
      for (const d of dto.detalles) {
        if (loteIdsSet.has(d.loteId)) {
          throw new BadRequestException(
            `El lote con ID #${d.loteId} está duplicado en la solicitud. Agrupa las cantidades.`,
          );
        }
        loteIdsSet.add(d.loteId);

        // 3. Validar disponibilidad de stock en el origen
        const invOrigen = await manager.findOne(Inventario, {
          where: {
            sucursalId: dto.sucursalOrigenId,
            loteId: d.loteId,
          },
          relations: { lote: { producto: true } },
        });

        if (!invOrigen || Number(invOrigen.cantidadDisponible) < d.cantidadSolicitada) {
          const prodName = invOrigen?.lote?.producto?.nombre || `Lote #${d.loteId}`;
          const disp = invOrigen ? Number(invOrigen.cantidadDisponible) : 0;
          throw new BadRequestException(
            `Stock insuficiente en ${origen.nombre} para "${prodName}". Solicitado: ${d.cantidadSolicitada}, Disponible: ${disp}.`,
          );
        }
      }

      // 4. Crear cabecera de la transferencia
      const nuevaTransferencia = manager.create(Transferencia, {
        sucursalOrigen: origen,
        sucursalDestino: destino,
        estado: 'SOLICITADA',
        observacion: dto.observacion?.trim() || null,
        fechaSolicitud: new Date(),
      });
      const transferenciaGuardada = await manager.save(nuevaTransferencia);

      // 5. Crear los renglones de detalle
      for (const d of dto.detalles) {
        const detalle = manager.create(TransferenciaDetalle, {
          transferenciaId: transferenciaGuardada.transferenciaId,
          loteId: d.loteId,
          cantidadSolicitada: d.cantidadSolicitada,
          cantidadEnviada: 0,
          cantidadRecibida: 0,
        });
        await manager.save(detalle);
      }

      this.logger.log(
        `Transferencia #${transferenciaGuardada.transferenciaId} creada: ${origen.nombre} -> ${destino.nombre} (${dto.detalles.length} medicamentos)`,
      );

      return {
        mensaje: 'Solicitud de transferencia registrada exitosamente',
        transferenciaId: transferenciaGuardada.transferenciaId,
        estado: transferenciaGuardada.estado,
        origen: origen.nombre,
        destino: destino.nombre,
        totalItems: dto.detalles.length,
      };
    });
  }

  /**
   * Despachar / Enviar Transferencia (Impacta Inventario Origen y Kardex de Salida)
   */
  async despacharTransferencia(id: number, dto: DespacharTransferenciaDto) {
    return this.dataSource.transaction(async (manager) => {
      const transferencia = await manager.findOne(Transferencia, {
        where: { transferenciaId: id },
        relations: {
          sucursalOrigen: true,
          sucursalDestino: true,
          transferenciaDetalles: {
            lote: { producto: true },
          },
        },
      });

      if (!transferencia) {
        throw new NotFoundException(`Transferencia #${id} no encontrada`);
      }

      if (transferencia.estado !== 'SOLICITADA' && transferencia.estado !== 'AUTORIZADA') {
        throw new BadRequestException(
          `No se puede despachar la transferencia #${id} porque está en estado "${transferencia.estado}".`,
        );
      }

      // Mapa de ajustes de cantidad si vienen en el DTO
      const mapEnviados = new Map<number, number>();
      if (dto.items && dto.items.length > 0) {
        dto.items.forEach((it) => mapEnviados.set(it.transferenciaDetalleId, it.cantidadEnviada));
      }

      for (const det of transferencia.transferenciaDetalles) {
        const cantEnv = mapEnviados.has(det.transferenciaDetalleId)
          ? mapEnviados.get(det.transferenciaDetalleId)!
          : Number(det.cantidadSolicitada);

        if (cantEnv <= 0) {
          throw new BadRequestException(
            `La cantidad enviada para el lote ${det.lote?.numeroLote} debe ser mayor a 0.`,
          );
        }

        // Validar y descontar stock del inventario en sucursal origen
        const invOrigen = await manager.findOne(Inventario, {
          where: {
            sucursalId: transferencia.sucursalOrigen.sucursalId,
            loteId: det.loteId,
          },
        });

        if (!invOrigen || Number(invOrigen.cantidadDisponible) < cantEnv) {
          const disp = invOrigen ? Number(invOrigen.cantidadDisponible) : 0;
          throw new BadRequestException(
            `No hay suficiente stock en origen para despachar el lote ${det.lote?.numeroLote}. Requerido: ${cantEnv}, Disponible: ${disp}.`,
          );
        }

        const cantAnterior = Number(invOrigen.cantidadDisponible);
        const cantNueva = cantAnterior - cantEnv;
        invOrigen.cantidadDisponible = cantNueva;
        invOrigen.fechaActualizacion = new Date();
        await manager.save(invOrigen);

        // Registrar movimiento de Kardex: Salida por Transferencia
        const mov = manager.create(MovimientoInventario, {
          inventario: invOrigen,
          tipoMovimiento: 'SALIDA',
          cantidad: cantEnv,
          cantidadAnterior: cantAnterior,
          cantidadNueva: cantNueva,
          referenciaTipo: 'TRANSFERENCIA_ENVIO',
          referenciaId: transferencia.transferenciaId,
          observacion: `Despacho de Transferencia #${transferencia.transferenciaId} hacia ${transferencia.sucursalDestino.nombre}`,
          fechaMovimiento: new Date(),
        });
        await manager.save(mov);

        det.cantidadEnviada = cantEnv;
        await manager.save(det);
      }

      transferencia.estado = 'EN_TRANSITO';
      transferencia.fechaEnvio = new Date();
      await manager.save(transferencia);

      this.logger.log(`Transferencia #${id} despachada y puesta EN_TRANSITO`);

      return {
        mensaje: `Transferencia #${id} despachada exitosamente hacia ${transferencia.sucursalDestino.nombre}`,
        estado: transferencia.estado,
        fechaEnvio: transferencia.fechaEnvio,
      };
    });
  }

  /**
   * Confirmar Recepción en Destino (Impacta Inventario Destino y Kardex de Entrada)
   */
  async recibirTransferencia(id: number, dto: RecibirTransferenciaDto) {
    return this.dataSource.transaction(async (manager) => {
      const transferencia = await manager.findOne(Transferencia, {
        where: { transferenciaId: id },
        relations: {
          sucursalOrigen: true,
          sucursalDestino: true,
          transferenciaDetalles: {
            lote: { producto: true },
          },
        },
      });

      if (!transferencia) {
        throw new NotFoundException(`Transferencia #${id} no encontrada`);
      }

      if (transferencia.estado !== 'EN_TRANSITO') {
        throw new BadRequestException(
          `Solo se pueden recibir transferencias en estado "EN_TRANSITO" (Estado actual: ${transferencia.estado}).`,
        );
      }

      const mapRecibidos = new Map<number, number>();
      if (dto.items && dto.items.length > 0) {
        dto.items.forEach((it) => mapRecibidos.set(it.transferenciaDetalleId, it.cantidadRecibida));
      }

      for (const det of transferencia.transferenciaDetalles) {
        const cantRec = mapRecibidos.has(det.transferenciaDetalleId)
          ? mapRecibidos.get(det.transferenciaDetalleId)!
          : Number(det.cantidadEnviada);

        // Validación estricta impuesta por CK_TRANS_DET_CANT (cantidadRecibida <= cantidadEnviada)
        if (cantRec > Number(det.cantidadEnviada)) {
          throw new BadRequestException(
            `La cantidad recibida (${cantRec}) no puede exceder la cantidad enviada (${det.cantidadEnviada}) para el lote ${det.lote?.numeroLote}.`,
          );
        }

        det.cantidadRecibida = cantRec;
        await manager.save(det);

        // Si se recibió mercancía física, sumar a Inventario de Destino
        if (cantRec > 0) {
          let invDestino = await manager.findOne(Inventario, {
            where: {
              sucursalId: transferencia.sucursalDestino.sucursalId,
              loteId: det.loteId,
            },
          });

          let cantAnterior = 0;
          if (!invDestino) {
            invDestino = manager.create(Inventario, {
              sucursalId: transferencia.sucursalDestino.sucursalId,
              loteId: det.loteId,
              cantidadDisponible: cantRec,
              cantidadReservada: 0,
              stockMinimo: 0,
              fechaActualizacion: new Date(),
            });
          } else {
            cantAnterior = Number(invDestino.cantidadDisponible);
            invDestino.cantidadDisponible = cantAnterior + cantRec;
            invDestino.fechaActualizacion = new Date();
          }

          const invGuardado = await manager.save(invDestino);

          // Registrar Kardex: Entrada por Transferencia
          const mov = manager.create(MovimientoInventario, {
            inventario: invGuardado,
            tipoMovimiento: 'ENTRADA',
            cantidad: cantRec,
            cantidadAnterior: cantAnterior,
            cantidadNueva: cantAnterior + cantRec,
            referenciaTipo: 'TRANSFERENCIA_RECEPCION',
            referenciaId: transferencia.transferenciaId,
            observacion: `Recepción de Transferencia #${transferencia.transferenciaId} procedente de ${transferencia.sucursalOrigen.nombre}`,
            fechaMovimiento: new Date(),
          });
          await manager.save(mov);
        }
      }

      transferencia.estado = 'RECIBIDA';
      transferencia.fechaRecepcion = new Date();
      await manager.save(transferencia);

      this.logger.log(`Transferencia #${id} recibida e ingresada al inventario de ${transferencia.sucursalDestino.nombre}`);

      return {
        mensaje: `Transferencia #${id} recibida con éxito en ${transferencia.sucursalDestino.nombre}`,
        estado: transferencia.estado,
        fechaRecepcion: transferencia.fechaRecepcion,
      };
    });
  }

  /**
   * Cancelar transferencia
   */
  async cancelarTransferencia(id: number, motivo?: string) {
    const transferencia = await this.transferenciaRepo.findOne({
      where: { transferenciaId: id },
    });

    if (!transferencia) {
      throw new NotFoundException(`Transferencia #${id} no encontrada`);
    }

    if (transferencia.estado === 'RECIBIDA' || transferencia.estado === 'EN_TRANSITO') {
      throw new BadRequestException(
        `No se puede cancelar la transferencia #${id} porque ya está en estado "${transferencia.estado}".`,
      );
    }

    transferencia.estado = 'CANCELADA';
    if (motivo) {
      transferencia.observacion = transferencia.observacion
        ? `${transferencia.observacion} | Motivo cancelación: ${motivo}`
        : `Motivo cancelación: ${motivo}`;
    }

    await this.transferenciaRepo.save(transferencia);
    return {
      mensaje: `Transferencia #${id} cancelada exitosamente`,
      estado: 'CANCELADA',
    };
  }
}

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ActivoFijo } from '../../database/entities/ActivoFijo';
import { CategoriaActivo } from '../../database/entities/CategoriaActivo';
import { HistorialActivo } from '../../database/entities/HistorialActivo';
import { Sucursal } from '../../database/entities/Sucursal';
import {
  CreateActivoDto,
  UpdateActivoDto,
  TrasladoActivoDto,
  BajaActivoDto,
  FilterActivoDto,
} from './dto/activo.dto';

@Injectable()
export class ActivosService {
  private readonly logger = new Logger(ActivosService.name);

  constructor(
    @InjectRepository(ActivoFijo)
    private readonly activoRepo: Repository<ActivoFijo>,
    @InjectRepository(CategoriaActivo)
    private readonly categoriaRepo: Repository<CategoriaActivo>,
    @InjectRepository(HistorialActivo)
    private readonly historialRepo: Repository<HistorialActivo>,
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Listar activos con paginación server-side y KPIs
   */
  async findAllActivos(filters: FilterActivoDto) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const qb = this.activoRepo
      .createQueryBuilder('act')
      .leftJoinAndSelect('act.categoriaActivo', 'cat')
      .leftJoinAndSelect('act.sucursal', 'suc');

    if (filters.sucursalId) {
      qb.andWhere('suc.sucursalId = :sucursalId', { sucursalId: filters.sucursalId });
    }

    if (filters.categoriaActivoId) {
      qb.andWhere('cat.categoriaActivoId = :catId', { catId: filters.categoriaActivoId });
    }

    if (filters.estado && filters.estado !== 'TODOS') {
      qb.andWhere('act.estado = :estado', { estado: filters.estado });
    }

    if (filters.search) {
      const term = `%${filters.search.toLowerCase().trim()}%`;
      qb.andWhere(
        '(LOWER(act.codigoActivo) LIKE :term OR LOWER(act.descripcion) LIKE :term OR LOWER(act.marca) LIKE :term OR LOWER(act.modelo) LIKE :term OR LOWER(act.numeroSerie) LIKE :term)',
        { term },
      );
    }

    qb.orderBy('act.activoId', 'DESC');
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    // KPIs calculados (globales o por sucursal)
    const kpiQb = (estado?: string) => {
      const q = this.activoRepo
        .createQueryBuilder('act')
        .leftJoin('act.sucursal', 'suc');
      if (filters.sucursalId) {
        q.andWhere('suc.sucursalId = :sucId', { sucId: filters.sucursalId });
      }
      if (estado) {
        q.andWhere('act.estado = :est', { est: estado });
      }
      return q;
    };

    const [totalKpi, activosKpi, deBajaKpi, rawValor] = await Promise.all([
      kpiQb().getCount(),
      kpiQb('ACTIVO').getCount(),
      kpiQb('DE_BAJA').getCount(),
      kpiQb('ACTIVO').select('SUM(act.valorLibros)', 'totalValor').getRawOne(),
    ]);

    const totalValorLibros = Number(rawValor?.totalValor || 0);

    return {
      data: items.map((a) => {
        const catPorcentaje =
          a.categoriaActivo && a.categoriaActivo.vidaUtilMeses > 0
            ? Math.round((12 / a.categoriaActivo.vidaUtilMeses) * 100 * 100) / 100
            : 20;

        return {
          activoId: a.activoId,
          id: a.activoId,
          codigoActivo: a.codigoActivo,
          descripcion: a.descripcion,
          nombre: a.descripcion,
          marca: a.marca,
          modelo: a.modelo,
          numeroSerie: a.numeroSerie,
          categoriaActivoId: a.categoriaActivo?.categoriaActivoId,
          categoriaActivo: a.categoriaActivo
            ? {
                id: a.categoriaActivo.categoriaActivoId,
                categoriaActivoId: a.categoriaActivo.categoriaActivoId,
                codigo: a.categoriaActivo.nombre,
                nombre: a.categoriaActivo.nombre,
                porcentajeDepreciacionAnual: catPorcentaje,
                activo: a.categoriaActivo.estado === 'ACTIVO',
              }
            : null,
          categoria: a.categoriaActivo?.nombre || 'General',
          sucursalId: a.sucursal?.sucursalId,
          sucursal: a.sucursal
            ? {
                id: a.sucursal.sucursalId,
                sucursalId: a.sucursal.sucursalId,
                nombre: a.sucursal.nombre,
              }
            : null,
          valorAdquisicion: Number(a.valorAdquisicion || 0),
          costoAdquisicion: Number(a.valorAdquisicion || 0),
          valorLibros: Number(a.valorLibros || 0),
          depreciacionAcumulada: Number(a.depreciacionAcumulada || 0),
          fechaAdquisicion: a.fechaAdquisicion,
          estado: a.estado === 'ACTIVO' ? 'OPERATIVO' : a.estado,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      kpis: {
        totalActivos: totalKpi,
        activosOperativos: activosKpi,
        activosDeBaja: deBajaKpi,
        totalValorLibros,
        total: totalKpi,
        operativos: activosKpi,
        enMantenimiento: 0,
        enTransito: 0,
        dadosDeBaja: deBajaKpi,
        costoTotal: totalValorLibros,
      },
    };
  }

  /**
   * Detalle de un activo con historial de movimientos
   */
  async findOneActivo(id: number) {
    const activo = await this.activoRepo.findOne({
      where: { activoId: id },
      relations: {
        categoriaActivo: true,
        sucursal: true,
        historialActivos: {
          sucursalOrigen: true,
          sucursalDestino: true,
        },
      },
    });

    if (!activo) {
      throw new NotFoundException(`Activo fijo con ID ${id} no encontrado`);
    }

    const movimientos = (activo.historialActivos || []).sort(
      (a, b) => new Date(b.fechaMovimiento).getTime() - new Date(a.fechaMovimiento).getTime(),
    );

    const catPorcentaje =
      activo.categoriaActivo && activo.categoriaActivo.vidaUtilMeses > 0
        ? Math.round((12 / activo.categoriaActivo.vidaUtilMeses) * 100 * 100) / 100
        : 20;

    let responsable = '';
    let obs = '';
    for (const m of movimientos) {
      if (m.observacion) {
        if (m.observacion.includes('Custodio:')) {
          const match = m.observacion.match(/Custodio:\s*([^.]+)/);
          if (match && !responsable) responsable = match[1].trim();
        }
        if (m.observacion.includes('Observaciones:')) {
          const match = m.observacion.match(/Observaciones:\s*([^.]+)/);
          if (match && !obs) obs = match[1].trim();
        }
      }
    }

    return {
      id: activo.activoId,
      activoId: activo.activoId,
      codigoActivo: activo.codigoActivo,
      nombre: activo.descripcion,
      descripcion: activo.descripcion,
      marca: activo.marca,
      modelo: activo.modelo,
      numeroSerie: activo.numeroSerie,
      fechaAdquisicion: activo.fechaAdquisicion,
      costoAdquisicion: Number(activo.valorAdquisicion || 0),
      valorAdquisicion: Number(activo.valorAdquisicion || 0),
      valorLibros: Number(activo.valorLibros || 0),
      depreciacionAcumulada: Number(activo.depreciacionAcumulada || 0),
      estado: activo.estado === 'ACTIVO' ? 'OPERATIVO' : activo.estado,
      responsableAsignado: responsable,
      observaciones: obs,
      categoriaActivoId: activo.categoriaActivo?.categoriaActivoId,
      categoriaActivo: activo.categoriaActivo
        ? {
            id: activo.categoriaActivo.categoriaActivoId,
            categoriaActivoId: activo.categoriaActivo.categoriaActivoId,
            codigo: activo.categoriaActivo.nombre,
            nombre: activo.categoriaActivo.nombre,
            porcentajeDepreciacionAnual: catPorcentaje,
            activo: activo.categoriaActivo.estado === 'ACTIVO',
          }
        : null,
      sucursalId: activo.sucursal?.sucursalId,
      sucursal: activo.sucursal
        ? {
            id: activo.sucursal.sucursalId,
            sucursalId: activo.sucursal.sucursalId,
            nombre: activo.sucursal.nombre,
          }
        : null,
      historial: movimientos.map((h) => ({
        id: h.historialActivoId,
        historialActivoId: h.historialActivoId,
        activoFijoId: activo.activoId,
        tipoMovimiento: h.tipoMovimiento,
        sucursalOrigenId: h.sucursalOrigen?.sucursalId,
        sucursalOrigen: h.sucursalOrigen ? { id: h.sucursalOrigen.sucursalId, nombre: h.sucursalOrigen.nombre } : undefined,
        sucursalDestinoId: h.sucursalDestino?.sucursalId,
        sucursalDestino: h.sucursalDestino ? { id: h.sucursalDestino.sucursalId, nombre: h.sucursalDestino.nombre } : undefined,
        valorLibros: Number(h.valorLibros || 0),
        motivo: h.observacion || '',
        observacion: h.observacion || '',
        responsable: h.observacion?.includes('Custodio:') ? (h.observacion.match(/Custodio:\s*([^.]+)/)?.[1] || '') : '',
        fechaMovimiento: h.fechaMovimiento,
        creadoEn: h.fechaMovimiento ? h.fechaMovimiento.toISOString() : new Date().toISOString(),
      })),
    };
  }

  /**
   * Crear activo fijo
   */
  async createActivo(dto: CreateActivoDto) {
    return this.dataSource.transaction(async (manager) => {
      const descripcion = (dto.descripcion || dto.nombre || '').trim();
      if (!descripcion) {
        throw new BadRequestException('La descripción o nombre del activo es obligatoria');
      }

      const valor = Number(dto.valorAdquisicion !== undefined ? dto.valorAdquisicion : dto.costoAdquisicion);
      if (isNaN(valor) || valor <= 0) {
        throw new BadRequestException('El valor de adquisición debe ser mayor a 0');
      }

      const codActivo = dto.codigoActivo?.trim() || `ACT-${Date.now().toString().slice(-6)}`;

      const existeCodigo = await manager.findOne(ActivoFijo, {
        where: { codigoActivo: codActivo },
      });
      if (existeCodigo) {
        throw new ConflictException(`El código de placa/activo "${codActivo}" ya existe`);
      }

      const categoria = await manager.findOne(CategoriaActivo, {
        where: { categoriaActivoId: dto.categoriaActivoId },
      });
      if (!categoria) throw new NotFoundException(`Categoría de activo con ID ${dto.categoriaActivoId} no encontrada`);

      const sucursal = await manager.findOne(Sucursal, {
        where: { sucursalId: dto.sucursalId },
      });
      if (!sucursal) throw new NotFoundException(`Sucursal con ID ${dto.sucursalId} no encontrada`);

      const nuevoActivo = manager.create(ActivoFijo, {
        codigoActivo: codActivo,
        descripcion,
        marca: dto.marca?.trim() || null,
        modelo: dto.modelo?.trim() || null,
        numeroSerie: dto.numeroSerie?.trim() || null,
        valorAdquisicion: valor,
        valorLibros: valor,
        valorResidual: 0,
        depreciacionAcumulada: 0,
        fechaAdquisicion: dto.fechaAdquisicion ? new Date(dto.fechaAdquisicion) : new Date(),
        estado: 'ACTIVO',
        categoriaActivo: categoria,
        sucursal,
      });

      const guardado = await manager.save(nuevoActivo);

      // Asiento en HistorialActivo
      const obsParts = [
        'Alta e incorporación al inventario de activos fijos',
        dto.responsableAsignado ? `Custodio: ${dto.responsableAsignado.trim()}` : '',
        dto.observaciones ? `Observaciones: ${dto.observaciones.trim()}` : '',
      ].filter(Boolean).join('. ');

      const hist = manager.create(HistorialActivo, {
        activo: guardado,
        sucursalDestino: sucursal,
        tipoMovimiento: 'ALTA',
        valorLibros: valor,
        observacion: obsParts,
        fechaMovimiento: new Date(),
      });
      await manager.save(hist);

      const catPorcentaje =
        categoria && categoria.vidaUtilMeses > 0
          ? Math.round((12 / categoria.vidaUtilMeses) * 100 * 100) / 100
          : 20;

      return {
        mensaje: `Activo fijo "${guardado.codigoActivo}" registrado exitosamente.`,
        id: guardado.activoId,
        activoId: guardado.activoId,
        codigoActivo: guardado.codigoActivo,
        nombre: guardado.descripcion,
        descripcion: guardado.descripcion,
        marca: guardado.marca,
        modelo: guardado.modelo,
        numeroSerie: guardado.numeroSerie,
        categoriaActivoId: categoria.categoriaActivoId,
        categoriaActivo: {
          id: categoria.categoriaActivoId,
          categoriaActivoId: categoria.categoriaActivoId,
          codigo: categoria.nombre,
          nombre: categoria.nombre,
          porcentajeDepreciacionAnual: catPorcentaje,
          activo: categoria.estado === 'ACTIVO',
        },
        categoria: categoria.nombre,
        sucursalId: sucursal.sucursalId,
        sucursal: {
          id: sucursal.sucursalId,
          sucursalId: sucursal.sucursalId,
          nombre: sucursal.nombre,
        },
        costoAdquisicion: Number(guardado.valorAdquisicion || 0),
        valorAdquisicion: Number(guardado.valorAdquisicion || 0),
        valorLibros: Number(guardado.valorLibros || 0),
        depreciacionAcumulada: Number(guardado.depreciacionAcumulada || 0),
        fechaAdquisicion: guardado.fechaAdquisicion,
        estado: guardado.estado === 'ACTIVO' ? 'OPERATIVO' : guardado.estado,
        responsableAsignado: dto.responsableAsignado?.trim() || '',
        observaciones: dto.observaciones?.trim() || '',
        activo: guardado,
      };
    });
  }

  /**
   * Trasladar activo entre sucursales
   */
  async trasladarActivo(id: number, dto: TrasladoActivoDto) {
    return this.dataSource.transaction(async (manager) => {
      const activo = await manager.findOne(ActivoFijo, {
        where: { activoId: id },
        relations: { sucursal: true },
      });

      if (!activo) throw new NotFoundException(`Activo con ID ${id} no encontrado`);

      if (activo.estado === 'DE_BAJA') {
        throw new BadRequestException('No se puede trasladar un activo que ha sido dado de baja');
      }

      const sucursalDestino = await manager.findOne(Sucursal, {
        where: { sucursalId: dto.sucursalDestinoId },
      });
      if (!sucursalDestino) throw new NotFoundException(`Sucursal destino con ID ${dto.sucursalDestinoId} no encontrada`);

      const origen = activo.sucursal;
      activo.sucursal = sucursalDestino;
      await manager.save(activo);

      // Asiento en HistorialActivo
      const hist = manager.create(HistorialActivo, {
        activo,
        sucursalOrigen: origen,
        sucursalDestino,
        tipoMovimiento: 'TRASLADO',
        valorLibros: Number(activo.valorLibros),
        observacion: dto.motivo.trim(),
        fechaMovimiento: new Date(),
      });
      await manager.save(hist);

      return {
        mensaje: `Activo ${activo.codigoActivo} trasladado con éxito a ${sucursalDestino.nombre}`,
        activoId: id,
        sucursalDestino: sucursalDestino.nombre,
      };
    });
  }

  /**
   * Dar de baja definitiva a un activo fijo
   */
  async bajaActivo(id: number, dto: BajaActivoDto) {
    return this.dataSource.transaction(async (manager) => {
      const activo = await manager.findOne(ActivoFijo, {
        where: { activoId: id },
        relations: { sucursal: true },
      });

      if (!activo) throw new NotFoundException(`Activo con ID ${id} no encontrado`);

      if (activo.estado === 'DE_BAJA') {
        throw new BadRequestException('El activo ya se encuentra dado de baja');
      }

      const valorAnterior = Number(activo.valorLibros);
      activo.estado = 'DE_BAJA';
      activo.valorLibros = 0;
      await manager.save(activo);

      // Asiento en HistorialActivo
      const hist = manager.create(HistorialActivo, {
        activo,
        sucursalOrigen: activo.sucursal,
        tipoMovimiento: 'BAJA',
        valorLibros: 0,
        observacion: dto.motivo.trim(),
        fechaMovimiento: new Date(),
      });
      await manager.save(hist);

      return {
        mensaje: `Activo ${activo.codigoActivo} retirado y dado de baja exitosamente.`,
        activoId: id,
        perdidaLibros: valorAnterior,
      };
    });
  }

  /**
   * Actualizar activo fijo
   */
  async updateActivo(id: number, dto: UpdateActivoDto) {
    return this.dataSource.transaction(async (manager) => {
      const activo = await manager.findOne(ActivoFijo, {
        where: { activoId: id },
        relations: { categoriaActivo: true, sucursal: true },
      });

      if (!activo) {
        throw new NotFoundException(`Activo fijo con ID ${id} no encontrado`);
      }

      if (dto.codigoActivo && dto.codigoActivo.trim() !== activo.codigoActivo) {
        const existe = await manager.findOne(ActivoFijo, {
          where: { codigoActivo: dto.codigoActivo.trim() },
        });
        if (existe && existe.activoId !== id) {
          throw new ConflictException(`El código "${dto.codigoActivo}" ya está asignado a otro activo`);
        }
        activo.codigoActivo = dto.codigoActivo.trim();
      }

      const desc = (dto.descripcion || dto.nombre)?.trim();
      if (desc) {
        activo.descripcion = desc;
      }

      if (dto.marca !== undefined) activo.marca = dto.marca?.trim() || null;
      if (dto.modelo !== undefined) activo.modelo = dto.modelo?.trim() || null;
      if (dto.numeroSerie !== undefined) activo.numeroSerie = dto.numeroSerie?.trim() || null;

      const valor = dto.valorAdquisicion !== undefined
        ? Number(dto.valorAdquisicion)
        : (dto.costoAdquisicion !== undefined ? Number(dto.costoAdquisicion) : undefined);
      if (valor !== undefined && valor > 0) {
        activo.valorAdquisicion = valor;
        activo.valorLibros = valor;
      }

      if (dto.fechaAdquisicion) {
        activo.fechaAdquisicion = new Date(dto.fechaAdquisicion);
      }

      if (dto.categoriaActivoId) {
        const cat = await manager.findOne(CategoriaActivo, {
          where: { categoriaActivoId: dto.categoriaActivoId },
        });
        if (cat) activo.categoriaActivo = cat;
      }

      if (dto.sucursalId) {
        const suc = await manager.findOne(Sucursal, {
          where: { sucursalId: dto.sucursalId },
        });
        if (suc) activo.sucursal = suc;
      }

      const guardado = await manager.save(activo);

      if (dto.responsableAsignado || dto.observaciones) {
        const obsParts = [
          'Actualización de especificaciones y custodia',
          dto.responsableAsignado ? `Custodio: ${dto.responsableAsignado.trim()}` : '',
          dto.observaciones ? `Observaciones: ${dto.observaciones.trim()}` : '',
        ].filter(Boolean).join('. ');

        const hist = manager.create(HistorialActivo, {
          activo: guardado,
          sucursalDestino: guardado.sucursal,
          tipoMovimiento: 'CAMBIO_ESTADO',
          valorLibros: Number(guardado.valorLibros),
          observacion: obsParts,
          fechaMovimiento: new Date(),
        });
        await manager.save(hist);
      }

      const catPorcentaje =
        guardado.categoriaActivo && guardado.categoriaActivo.vidaUtilMeses > 0
          ? Math.round((12 / guardado.categoriaActivo.vidaUtilMeses) * 100 * 100) / 100
          : 20;

      return {
        mensaje: `Activo fijo "${guardado.codigoActivo}" actualizado exitosamente.`,
        id: guardado.activoId,
        activoId: guardado.activoId,
        codigoActivo: guardado.codigoActivo,
        nombre: guardado.descripcion,
        descripcion: guardado.descripcion,
        marca: guardado.marca,
        modelo: guardado.modelo,
        numeroSerie: guardado.numeroSerie,
        categoriaActivoId: guardado.categoriaActivo?.categoriaActivoId,
        categoriaActivo: guardado.categoriaActivo
          ? {
              id: guardado.categoriaActivo.categoriaActivoId,
              categoriaActivoId: guardado.categoriaActivo.categoriaActivoId,
              codigo: guardado.categoriaActivo.nombre,
              nombre: guardado.categoriaActivo.nombre,
              porcentajeDepreciacionAnual: catPorcentaje,
              activo: guardado.categoriaActivo.estado === 'ACTIVO',
            }
          : null,
        categoria: guardado.categoriaActivo?.nombre || 'General',
        sucursalId: guardado.sucursal?.sucursalId,
        sucursal: guardado.sucursal
          ? {
              id: guardado.sucursal.sucursalId,
              sucursalId: guardado.sucursal.sucursalId,
              nombre: guardado.sucursal.nombre,
            }
          : null,
        costoAdquisicion: Number(guardado.valorAdquisicion || 0),
        valorAdquisicion: Number(guardado.valorAdquisicion || 0),
        valorLibros: Number(guardado.valorLibros || 0),
        depreciacionAcumulada: Number(guardado.depreciacionAcumulada || 0),
        fechaAdquisicion: guardado.fechaAdquisicion,
        estado: guardado.estado === 'ACTIVO' ? 'OPERATIVO' : guardado.estado,
        responsableAsignado: dto.responsableAsignado?.trim() || '',
        observaciones: dto.observaciones?.trim() || '',
        activo: guardado,
      };
    });
  }

  /**
   * Catálogo de categorías
   */
  async findAllCategorias() {
    const cats = await this.categoriaRepo.find({
      where: { estado: 'ACTIVO' },
      order: { categoriaActivoId: 'ASC' },
    });
    return cats.map((c) => {
      const porcentaje =
        c.vidaUtilMeses > 0
          ? Math.round((12 / c.vidaUtilMeses) * 100 * 100) / 100
          : 20;
      return {
        id: c.categoriaActivoId,
        categoriaActivoId: c.categoriaActivoId,
        nombre: c.nombre,
        vidaUtilMeses: c.vidaUtilMeses,
        porcentajeDepreciacionAnual: porcentaje,
        estado: c.estado,
        activo: c.estado === 'ACTIVO',
      };
    });
  }
}

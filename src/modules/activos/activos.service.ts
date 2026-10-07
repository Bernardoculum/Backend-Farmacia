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
      data: items.map((a) => ({
        activoId: a.activoId,
        codigoActivo: a.codigoActivo,
        descripcion: a.descripcion,
        marca: a.marca,
        modelo: a.modelo,
        numeroSerie: a.numeroSerie,
        categoria: a.categoriaActivo?.nombre || 'General',
        categoriaId: a.categoriaActivo?.categoriaActivoId,
        sucursal: a.sucursal?.nombre || 'Central',
        sucursalId: a.sucursal?.sucursalId,
        valorAdquisicion: Number(a.valorAdquisicion),
        valorLibros: Number(a.valorLibros),
        depreciacionAcumulada: Number(a.depreciacionAcumulada),
        fechaAdquisicion: a.fechaAdquisicion,
        estado: a.estado,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      kpis: {
        totalActivos: totalKpi,
        activosOperativos: activosKpi,
        activosDeBaja: deBajaKpi,
        totalValorLibros,
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

    return {
      ...activo,
      valorAdquisicion: Number(activo.valorAdquisicion),
      valorLibros: Number(activo.valorLibros),
      historial: movimientos.map((h) => ({
        historialActivoId: h.historialActivoId,
        tipoMovimiento: h.tipoMovimiento,
        sucursalOrigen: h.sucursalOrigen?.nombre,
        sucursalDestino: h.sucursalDestino?.nombre,
        valorLibros: Number(h.valorLibros || 0),
        observacion: h.observacion,
        fechaMovimiento: h.fechaMovimiento,
      })),
    };
  }

  /**
   * Crear activo fijo
   */
  async createActivo(dto: CreateActivoDto) {
    return this.dataSource.transaction(async (manager) => {
      const existeCodigo = await manager.findOne(ActivoFijo, {
        where: { codigoActivo: dto.codigoActivo.trim() },
      });
      if (existeCodigo) {
        throw new ConflictException(`El código de placa/activo "${dto.codigoActivo}" ya existe`);
      }

      const categoria = await manager.findOne(CategoriaActivo, {
        where: { categoriaActivoId: dto.categoriaActivoId },
      });
      if (!categoria) throw new NotFoundException(`Categoría de activo con ID ${dto.categoriaActivoId} no encontrada`);

      const sucursal = await manager.findOne(Sucursal, {
        where: { sucursalId: dto.sucursalId },
      });
      if (!sucursal) throw new NotFoundException(`Sucursal con ID ${dto.sucursalId} no encontrada`);

      const valor = Number(dto.valorAdquisicion);

      const nuevoActivo = manager.create(ActivoFijo, {
        codigoActivo: dto.codigoActivo.trim(),
        descripcion: dto.descripcion.trim(),
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
      const hist = manager.create(HistorialActivo, {
        activo: guardado,
        sucursalDestino: sucursal,
        tipoMovimiento: 'ALTA_INICIAL',
        valorLibros: valor,
        observacion: 'Alta e incorporación al inventario de activos fijos',
        fechaMovimiento: new Date(),
      });
      await manager.save(hist);

      return {
        mensaje: `Activo fijo "${guardado.codigoActivo}" registrado exitosamente.`,
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
        tipoMovimiento: 'TRASLADO_SUCURSAL',
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
        tipoMovimiento: 'BAJA_DEFINITIVA',
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
   * Catálogo de categorías
   */
  async findAllCategorias() {
    return this.categoriaRepo.find({ order: { categoriaActivoId: 'ASC' } });
  }
}

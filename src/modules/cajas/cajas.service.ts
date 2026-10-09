import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Caja } from '../../database/entities/Caja';
import { SesionCaja } from '../../database/entities/SesionCaja';
import { MovimientoCaja } from '../../database/entities/MovimientoCaja';
import { Sucursal } from '../../database/entities/Sucursal';
import { Empleado } from '../../database/entities/Empleado';
import { MetodoPago } from '../../database/entities/MetodoPago';
import { AbrirSesionDto } from './dto/abrir-sesion.dto';
import { CerrarSesionDto } from './dto/cerrar-sesion.dto';
import { CreateMovimientoCajaDto } from './dto/create-movimiento-caja.dto';
import { FilterSesionCajaDto } from './dto/filter-sesion-caja.dto';
import { CreateCajaDto, UpdateCajaDto } from './dto/create-caja.dto';

@Injectable()
export class CajasService {
  private readonly logger = new Logger(CajasService.name);

  constructor(
    @InjectRepository(Caja)
    private readonly cajaRepo: Repository<Caja>,
    @InjectRepository(SesionCaja)
    private readonly sesionRepo: Repository<SesionCaja>,
    @InjectRepository(MovimientoCaja)
    private readonly movimientoRepo: Repository<MovimientoCaja>,
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
    @InjectRepository(Empleado)
    private readonly empleadoRepo: Repository<Empleado>,
    @InjectRepository(MetodoPago)
    private readonly metodoPagoRepo: Repository<MetodoPago>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Listar todas las terminales físicas de caja con sucursal y estado actual
   */
  async findAllCajas(sucursalId?: number) {
    const qb = this.cajaRepo
      .createQueryBuilder('caja')
      .leftJoinAndSelect('caja.sucursal', 'sucursal')
      .orderBy('caja.cajaId', 'ASC');

    if (sucursalId) {
      qb.where('caja.sucursalId = :sucursalId', { sucursalId });
    }

    const cajas = await qb.getMany();

    // Obtener las sesiones actualmente abiertas para saber disponibilidad
    const sesionesAbiertas = await this.sesionRepo.find({
      where: { estado: 'ABIERTA' },
      relations: {
        empleadoApertura: true,
      },
    });

    const mapaAbiertas = new Map<number, SesionCaja>();
    for (const sesion of sesionesAbiertas) {
      if (sesion.caja && sesion.caja.cajaId) {
        mapaAbiertas.set(sesion.caja.cajaId, sesion);
      }
    }

    return cajas.map((c) => {
      const abierta = mapaAbiertas.get(c.cajaId);
      return {
        cajaId: c.cajaId,
        sucursalId: c.sucursalId,
        sucursal: c.sucursal?.nombre || 'Sucursal',
        codigoCaja: c.codigoCaja,
        descripcion: c.descripcion,
        estado: c.estado,
        estaEnUso: !!abierta,
        sesionActivaId: abierta ? abierta.sesionCajaId : null,
        cajeroActivo: abierta ? abierta.empleadoApertura?.nombre : null,
        fechaAperturaActiva: abierta ? abierta.fechaApertura : null,
      };
    });
  }

  /**
   * Crear una nueva terminal de caja física
   */
  async createCaja(dto: CreateCajaDto) {
    const sucursal = await this.sucursalRepo.findOne({
      where: { sucursalId: dto.sucursalId },
    });
    if (!sucursal) {
      throw new NotFoundException(`Sucursal con ID ${dto.sucursalId} no encontrada`);
    }

    const existe = await this.cajaRepo.findOne({
      where: { codigoCaja: dto.codigoCaja.trim() },
    });
    if (existe) {
      throw new ConflictException(`Ya existe una caja con el código "${dto.codigoCaja}"`);
    }

    const nueva = this.cajaRepo.create({
      sucursalId: dto.sucursalId,
      codigoCaja: dto.codigoCaja.trim(),
      descripcion: dto.descripcion?.trim() || null,
      estado: dto.estado || 'ACTIVA',
    });

    const guardada = await this.cajaRepo.save(nueva);
    return {
      mensaje: 'Terminal de caja registrada exitosamente',
      caja: guardada,
    };
  }

  /**
   * Listar todas las sesiones de caja con paginación server-side (OFFSET/FETCH) y KPIs
   */
  async findAllSesiones(filters: FilterSesionCajaDto) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const qb = this.sesionRepo
      .createQueryBuilder('sesion')
      .innerJoinAndSelect('sesion.caja', 'caja')
      .leftJoinAndSelect('caja.sucursal', 'sucursal')
      .leftJoinAndSelect('sesion.empleadoApertura', 'empA')
      .leftJoinAndSelect('sesion.empleadoCierre', 'empC');

    // Filtros
    if (filters.sucursalId) {
      qb.andWhere('caja.sucursalId = :sucursalId', { sucursalId: filters.sucursalId });
    }

    if (filters.cajaId) {
      qb.andWhere('caja.cajaId = :cajaId', { cajaId: filters.cajaId });
    }

    if (filters.estado && filters.estado !== 'TODOS') {
      if (filters.estado === 'DESCUADRE') {
        qb.andWhere('sesion.estado = :estCerrada', { estCerrada: 'CERRADA' });
        qb.andWhere('sesion.diferencia != 0 AND sesion.diferencia IS NOT NULL');
      } else if (filters.estado === 'CUADRE_EXACTO') {
        qb.andWhere('sesion.estado = :estCerrada', { estCerrada: 'CERRADA' });
        qb.andWhere('(sesion.diferencia = 0 OR sesion.diferencia IS NULL)');
      } else {
        qb.andWhere('sesion.estado = :estado', { estado: filters.estado });
      }
    }

    if (filters.search) {
      const term = `%${filters.search.toLowerCase().trim()}%`;
      qb.andWhere(
        '(LOWER(caja.codigoCaja) LIKE :term OR LOWER(empA.nombre) LIKE :term OR LOWER(sucursal.nombre) LIKE :term)',
        { term },
      );
    }

    if (filters.fechaDesde) {
      qb.andWhere('sesion.fechaApertura >= TO_TIMESTAMP(:fDesde, \'YYYY-MM-DD\')', {
        fDesde: filters.fechaDesde,
      });
    }

    if (filters.fechaHasta) {
      qb.andWhere('sesion.fechaApertura <= TO_TIMESTAMP(:fHasta, \'YYYY-MM-DD HH24:MI:SS\')', {
        fHasta: `${filters.fechaHasta} 23:59:59`,
      });
    }

    qb.orderBy('sesion.fechaApertura', 'DESC');
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    // KPIs calculados
    const kpiQb = this.sesionRepo.createQueryBuilder('sesion');
    if (filters.sucursalId) {
      kpiQb
        .innerJoin('sesion.caja', 'caja')
        .where('caja.sucursalId = :sucursalId', { sucursalId: filters.sucursalId });
    }

    const totalKpi = await kpiQb.getCount();
    const abiertasKpi = await kpiQb
      .clone()
      .andWhere('sesion.estado = :est', { est: 'ABIERTA' })
      .getCount();
    const cuadresExactosKpi = await kpiQb
      .clone()
      .andWhere('sesion.estado = :est', { est: 'CERRADA' })
      .andWhere('(sesion.diferencia = 0 OR sesion.diferencia IS NULL)')
      .getCount();
    const descuadresKpi = await kpiQb
      .clone()
      .andWhere('sesion.estado = :est', { est: 'CERRADA' })
      .andWhere('sesion.diferencia != 0 AND sesion.diferencia IS NOT NULL')
      .getCount();

    const data = items.map((s) => {
      const diff = s.diferencia !== null ? Number(s.diferencia) : null;
      let estadoCuadre: 'ABIERTA' | 'CUADRE_EXACTO' | 'SOBRANTE' | 'FALTANTE' = 'ABIERTA';
      if (s.estado === 'CERRADA') {
        if (diff === null || diff === 0) {
          estadoCuadre = 'CUADRE_EXACTO';
        } else if (diff > 0) {
          estadoCuadre = 'SOBRANTE';
        } else {
          estadoCuadre = 'FALTANTE';
        }
      }

      return {
        sesionCajaId: s.sesionCajaId,
        cajaId: s.caja?.cajaId,
        codigoCaja: s.caja?.codigoCaja,
        sucursal: s.caja?.sucursal?.nombre,
        cajeroApertura: s.empleadoApertura?.nombre || 'No asignado',
        cajeroCierre: s.empleadoCierre?.nombre || null,
        fechaApertura: s.fechaApertura,
        fechaCierre: s.fechaCierre,
        saldoInicial: Number(s.saldoInicial) || 0,
        totalIngresos: Number(s.totalIngresos) || 0,
        totalEgresos: Number(s.totalEgresos) || 0,
        efectivoEsperado: s.efectivoEsperado !== null ? Number(s.efectivoEsperado) : null,
        efectivoContado: s.efectivoContado !== null ? Number(s.efectivoContado) : null,
        diferencia: diff,
        estado: s.estado,
        estadoCuadre,
        observacionCierre: s.observacionCierre,
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
        abiertas: abiertasKpi,
        cuadresExactos: cuadresExactosKpi,
        descuadres: descuadresKpi,
      },
    };
  }

  /**
   * Consulta si existe una sesión de caja actualmente abierta para una sucursal
   */
  async findSesionActiva(sucursalId?: number) {
    const qb = this.sesionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.caja', 'caja')
      .leftJoinAndSelect('s.empleadoApertura', 'emp')
      .where('s.estado = :estado', { estado: 'ABIERTA' });

    if (sucursalId) {
      qb.andWhere('caja.sucursalId = :sucursalId', { sucursalId });
    }

    qb.orderBy('s.sesionCajaId', 'DESC');
    const sesion = await qb.getOne();

    if (!sesion) {
      return null;
    }

    return {
      sesionCajaId: sesion.sesionCajaId,
      cajaId: sesion.caja?.cajaId,
      codigoCaja: sesion.caja?.codigoCaja || 'Caja 1',
      sucursalId: sesion.caja?.sucursalId,
      estado: sesion.estado,
      saldoInicial: Number(sesion.saldoInicial || 0),
      totalIngresos: Number(sesion.totalIngresos || 0),
      totalEgresos: Number(sesion.totalEgresos || 0),
      fechaApertura: sesion.fechaApertura,
      cajero: sesion.empleadoApertura
        ? `${sesion.empleadoApertura.nombre} ${sesion.empleadoApertura.apellido}`.trim()
        : 'Cajero',
    };
  }

  /**
   * Detalle completo de una sesión de caja con sus movimientos
   */
  async findOneSesion(id: number) {
    const sesion = await this.sesionRepo.findOne({
      where: { sesionCajaId: id },
      relations: {
        caja: {
          sucursal: true,
        },
        empleadoApertura: true,
        empleadoCierre: true,
        movimientoCajas: {
          metodoPago: true,
          empleado: true,
        },
      },
    });

    if (!sesion) {
      throw new NotFoundException(`Sesión de caja con ID ${id} no encontrada`);
    }

    // Ordenar movimientos cronológicamente
    const movimientos = (sesion.movimientoCajas || []).sort(
      (a, b) => new Date(a.fechaMovimiento).getTime() - new Date(b.fechaMovimiento).getTime(),
    );

    // Agrupar totales por método de pago
    let totalEfectivoIngresos = 0;
    let totalTarjetaIngresos = 0;
    let totalTransferenciaIngresos = 0;

    for (const m of movimientos) {
      const monto = Number(m.monto) || 0;
      const metodo = (m.metodoPago?.nombre || '').toUpperCase();
      if (m.tipoMovimiento === 'INGRESO') {
        if (metodo.includes('EFECTIVO') || m.metodoPago?.metodoPagoId === 1) {
          totalEfectivoIngresos += monto;
        } else if (metodo.includes('TARJETA') || m.metodoPago?.metodoPagoId === 2) {
          totalTarjetaIngresos += monto;
        } else {
          totalTransferenciaIngresos += monto;
        }
      }
    }

    const diff = sesion.diferencia !== null ? Number(sesion.diferencia) : null;
    let estadoCuadre: 'ABIERTA' | 'CUADRE_EXACTO' | 'SOBRANTE' | 'FALTANTE' = 'ABIERTA';
    if (sesion.estado === 'CERRADA') {
      if (diff === null || diff === 0) {
        estadoCuadre = 'CUADRE_EXACTO';
      } else if (diff > 0) {
        estadoCuadre = 'SOBRANTE';
      } else {
        estadoCuadre = 'FALTANTE';
      }
    }

    return {
      sesionCajaId: sesion.sesionCajaId,
      caja: {
        cajaId: sesion.caja?.cajaId,
        codigoCaja: sesion.caja?.codigoCaja,
        descripcion: sesion.caja?.descripcion,
        sucursal: sesion.caja?.sucursal?.nombre,
      },
      empleadoApertura: sesion.empleadoApertura?.nombre,
      empleadoCierre: sesion.empleadoCierre?.nombre,
      fechaApertura: sesion.fechaApertura,
      fechaCierre: sesion.fechaCierre,
      saldoInicial: Number(sesion.saldoInicial) || 0,
      totalIngresos: Number(sesion.totalIngresos) || 0,
      totalEgresos: Number(sesion.totalEgresos) || 0,
      efectivoEsperado: sesion.efectivoEsperado !== null ? Number(sesion.efectivoEsperado) : null,
      efectivoContado: sesion.efectivoContado !== null ? Number(sesion.efectivoContado) : null,
      diferencia: diff,
      estado: sesion.estado,
      estadoCuadre,
      observacionCierre: sesion.observacionCierre,
      resumenMetodosPago: {
        efectivo: totalEfectivoIngresos,
        tarjeta: totalTarjetaIngresos,
        transferencia: totalTransferenciaIngresos,
      },
      movimientos: movimientos.map((m) => ({
        movimientoCajaId: m.movimientoCajaId,
        tipoMovimiento: m.tipoMovimiento,
        monto: Number(m.monto),
        metodoPago: m.metodoPago?.nombre || 'Efectivo',
        descripcion: m.descripcion,
        referenciaTipo: m.referenciaTipo,
        referenciaId: m.referenciaId,
        empleado: m.empleado?.nombre,
        fechaMovimiento: m.fechaMovimiento,
      })),
    };
  }

  /**
   * Apertura de turno / sesión de caja
   */
  async abrirSesion(dto: AbrirSesionDto, user: any) {
    const caja = await this.cajaRepo.findOne({
      where: { cajaId: dto.cajaId },
      relations: { sucursal: true },
    });

    if (!caja) {
      throw new NotFoundException(`Terminal de caja con ID ${dto.cajaId} no encontrada`);
    }

    if (caja.estado !== 'ACTIVA') {
      throw new BadRequestException(
        `La caja ${caja.codigoCaja} se encuentra en estado "${caja.estado}" y no puede ser abierta`,
      );
    }

    // Verificar que no tenga sesión abierta actualmente
    const sesionAbierta = await this.sesionRepo.findOne({
      where: {
        caja: { cajaId: dto.cajaId },
        estado: 'ABIERTA',
      },
    });

    if (sesionAbierta) {
      throw new ConflictException(
        `La caja "${caja.codigoCaja}" ya tiene una sesión abierta (ID #${sesionAbierta.sesionCajaId}). Debes cerrarla antes de abrir un nuevo turno.`,
      );
    }

    // Resolver empleado
    let empId = dto.empleadoId || user?.empleadoId;
    if (!empId) {
      const primerEmp = await this.empleadoRepo.findOne({ order: { empleadoId: 'ASC' } });
      empId = primerEmp?.empleadoId || 1;
    }

    const empleado = await this.empleadoRepo.findOne({ where: { empleadoId: empId } });
    if (!empleado) {
      throw new NotFoundException(`Empleado con ID ${empId} no encontrado`);
    }

    const nuevaSesion = this.sesionRepo.create({
      caja,
      empleadoApertura: empleado,
      saldoInicial: Number(dto.saldoInicial),
      totalIngresos: 0,
      totalEgresos: 0,
      estado: 'ABIERTA',
      fechaApertura: new Date(),
    });

    const guardada = await this.sesionRepo.save(nuevaSesion);
    this.logger.log(
      `Sesión de caja abierta: ID #${guardada.sesionCajaId} en caja ${caja.codigoCaja} (${caja.sucursal?.nombre}) con fondo inicial Q ${dto.saldoInicial}`,
    );

    return {
      mensaje: `Sesión de caja #${guardada.sesionCajaId} abierta exitosamente`,
      sesionCajaId: guardada.sesionCajaId,
      caja: caja.codigoCaja,
      sucursal: caja.sucursal?.nombre,
      cajero: empleado.nombre,
      saldoInicial: guardada.saldoInicial,
      fechaApertura: guardada.fechaApertura,
      estado: guardada.estado,
    };
  }

  /**
   * Registro de movimiento manual (Ingreso / Egreso menor de caja chica)
   */
  async registrarMovimiento(sesionId: number, dto: CreateMovimientoCajaDto, user: any) {
    return this.dataSource.transaction(async (manager) => {
      const sesion = await manager.findOne(SesionCaja, {
        where: { sesionCajaId: sesionId },
        relations: { caja: true },
      });

      if (!sesion) {
        throw new NotFoundException(`Sesión de caja con ID ${sesionId} no encontrada`);
      }

      if (sesion.estado !== 'ABIERTA') {
        throw new BadRequestException(
          `No se pueden registrar movimientos en una sesión que está "${sesion.estado}"`,
        );
      }

      const metodoPago = await manager.findOne(MetodoPago, {
        where: { metodoPagoId: dto.metodoPagoId },
      });
      if (!metodoPago) {
        throw new NotFoundException(`Método de pago con ID ${dto.metodoPagoId} no encontrado`);
      }

      let empId = user?.empleadoId;
      if (!empId) {
        const primerEmp = await manager.findOne(Empleado, { order: { empleadoId: 'ASC' } });
        empId = primerEmp?.empleadoId || 1;
      }
      const empleado = await manager.findOne(Empleado, { where: { empleadoId: empId } });

      const movimiento = manager.create(MovimientoCaja, {
        sesionCaja: sesion,
        tipoMovimiento: dto.tipoMovimiento,
        monto: Number(dto.monto),
        metodoPago,
        referenciaTipo: dto.referenciaTipo || 'MOVIMIENTO_MANUAL',
        referenciaId: dto.referenciaId || null,
        descripcion: dto.descripcion.trim(),
        empleado: empleado!,
        fechaMovimiento: new Date(),
      });

      await manager.save(movimiento);

      // Actualizar acumuladores en la sesión
      if (dto.tipoMovimiento === 'INGRESO') {
        sesion.totalIngresos = Number(sesion.totalIngresos || 0) + Number(dto.monto);
      } else {
        sesion.totalEgresos = Number(sesion.totalEgresos || 0) + Number(dto.monto);
      }

      await manager.save(sesion);

      return {
        mensaje: `${dto.tipoMovimiento === 'INGRESO' ? 'Ingreso' : 'Egreso'} registrado exitosamente`,
        movimientoId: movimiento.movimientoCajaId,
        tipoMovimiento: movimiento.tipoMovimiento,
        monto: movimiento.monto,
        totalIngresosSesion: sesion.totalIngresos,
        totalEgresosSesion: sesion.totalEgresos,
      };
    });
  }

  /**
   * Cierre y Arqueo de turno de caja
   */
  async cerrarSesion(id: number, dto: CerrarSesionDto, user: any) {
    return this.dataSource.transaction(async (manager) => {
      const sesion = await manager.findOne(SesionCaja, {
        where: { sesionCajaId: id },
        relations: {
          caja: { sucursal: true },
          movimientoCajas: { metodoPago: true },
          empleadoApertura: true,
        },
      });

      if (!sesion) {
        throw new NotFoundException(`Sesión de caja con ID ${id} no encontrada`);
      }

      if (sesion.estado !== 'ABIERTA') {
        throw new BadRequestException(
          `La sesión #${id} ya se encuentra "${sesion.estado}" y no puede volver a cerrarse`,
        );
      }

      // Sumar ingresos en efectivo y egresos en efectivo
      let ingresosEfectivo = 0;
      let egresosEfectivo = 0;

      for (const m of sesion.movimientoCajas || []) {
        const monto = Number(m.monto) || 0;
        const nombreMetodo = (m.metodoPago?.nombre || '').toUpperCase();
        const esEfectivo = nombreMetodo.includes('EFECTIVO') || m.metodoPago?.metodoPagoId === 1;

        if (esEfectivo) {
          if (m.tipoMovimiento === 'INGRESO') {
            ingresosEfectivo += monto;
          } else {
            egresosEfectivo += monto;
          }
        } else {
          // Si es egreso en otro método, igual se descuenta
          if (m.tipoMovimiento === 'EGRESO') {
            egresosEfectivo += monto;
          }
        }
      }

      const saldoInicial = Number(sesion.saldoInicial) || 0;
      const efectivoEsperado = saldoInicial + ingresosEfectivo - egresosEfectivo;
      const efectivoContado = Number(dto.efectivoContado);
      const diferencia = efectivoContado - efectivoEsperado;

      // Resolver empleado de cierre
      let empId = dto.empleadoId || user?.empleadoId;
      if (!empId) {
        empId = sesion.empleadoApertura?.empleadoId || 1;
      }
      const empleadoCierre = await manager.findOne(Empleado, { where: { empleadoId: empId } });

      sesion.efectivoEsperado = efectivoEsperado;
      sesion.efectivoContado = efectivoContado;
      sesion.diferencia = diferencia;
      sesion.observacionCierre = dto.observacionCierre?.trim() || null;
      sesion.fechaCierre = new Date();
      sesion.estado = 'CERRADA';
      if (empleadoCierre) {
        sesion.empleadoCierre = empleadoCierre;
      }

      await manager.save(sesion);

      let estadoArqueo: 'CUADRE_EXACTO' | 'SOBRANTE' | 'FALTANTE';
      if (diferencia === 0) {
        estadoArqueo = 'CUADRE_EXACTO';
      } else if (diferencia > 0) {
        estadoArqueo = 'SOBRANTE';
      } else {
        estadoArqueo = 'FALTANTE';
      }

      this.logger.log(
        `Sesión #${sesion.sesionCajaId} cerrada. Esperado: Q ${efectivoEsperado.toFixed(2)} | Contado: Q ${efectivoContado.toFixed(2)} | Diferencia: Q ${diferencia.toFixed(2)} (${estadoArqueo})`,
      );

      return {
        mensaje: `Turno de caja #${sesion.sesionCajaId} cerrado exitosamente`,
        sesionCajaId: sesion.sesionCajaId,
        caja: sesion.caja?.codigoCaja,
        sucursal: sesion.caja?.sucursal?.nombre,
        cajeroApertura: sesion.empleadoApertura?.nombre,
        cajeroCierre: empleadoCierre?.nombre,
        saldoInicial,
        totalIngresos: Number(sesion.totalIngresos),
        totalEgresos: Number(sesion.totalEgresos),
        efectivoEsperado,
        efectivoContado,
        diferencia,
        estadoArqueo,
        observacionCierre: sesion.observacionCierre,
        fechaCierre: sesion.fechaCierre,
      };
    });
  }
}

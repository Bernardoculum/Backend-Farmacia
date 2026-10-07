import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Planilla } from '../../database/entities/Planilla';
import { PlanillaDetalle } from '../../database/entities/PlanillaDetalle';
import { Empleado } from '../../database/entities/Empleado';
import { Puesto } from '../../database/entities/Puesto';
import { Sucursal } from '../../database/entities/Sucursal';
import { HistorialSalario } from '../../database/entities/HistorialSalario';
import {
  GenerarPlanillaDto,
  CreateEmpleadoDto,
  UpdateEmpleadoDto,
  FilterPlanillaDto,
  DesembolsarPlanillaDto,
} from './dto/planilla.dto';
import { BranchScopeContext } from '../../common/branch-scope';

@Injectable()
export class PlanillasService {
  private readonly logger = new Logger(PlanillasService.name);

  constructor(
    @InjectRepository(Planilla)
    private readonly planillaRepo: Repository<Planilla>,
    @InjectRepository(PlanillaDetalle)
    private readonly detalleRepo: Repository<PlanillaDetalle>,
    @InjectRepository(Empleado)
    private readonly empleadoRepo: Repository<Empleado>,
    @InjectRepository(Puesto)
    private readonly puestoRepo: Repository<Puesto>,
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Listar planillas históricas con paginación server-side y recuento real de colaboradores
   */
  async findAllPlanillas(filters: FilterPlanillaDto) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const qb = this.planillaRepo
      .createQueryBuilder('p')
      .leftJoin('p.planillaDetalles', 'd')
      .select('p.PLANILLA_ID', 'planillaId')
      .addSelect('p.FECHA_INICIO', 'fechaInicio')
      .addSelect('p.FECHA_FIN', 'fechaFin')
      .addSelect('p.FECHA_PAGO', 'fechaPago')
      .addSelect('p.ESTADO', 'estado')
      .addSelect('p.TIPO_PERIODO', 'tipoPeriodo')
      .addSelect('p.OBSERVACIONES', 'observaciones')
      .addSelect('p.SUCURSAL_ID', 'sucursalId')
      .addSelect('p.ORIGEN_FONDOS', 'origenFondos')
      .addSelect('p.REFERENCIA_PAGO', 'referenciaPago')
      .addSelect('p.BANCO_ORIGEN', 'bancoOrigen')
      .addSelect('COUNT(d.PLANILLA_DETALLE_ID)', 'totalColaboradores')
      .addSelect('COALESCE(SUM(d.SALARIO_BASE + d.BONIFICACIONES + d.HORAS_EXTRA), p.TOTAL_BRUTO)', 'totalBruto')
      .addSelect('COALESCE(SUM(d.DESCUENTOS), p.TOTAL_DESCUENTOS)', 'totalDescuentos')
      .addSelect('COALESCE(SUM(d.TOTAL_PAGAR), p.TOTAL_NETO)', 'totalNeto');

    if (filters.sucursalId) {
      qb.where('p.SUCURSAL_ID = :sucId', { sucId: Number(filters.sucursalId) });
    }

    qb.groupBy('p.PLANILLA_ID')
      .addGroupBy('p.FECHA_INICIO')
      .addGroupBy('p.FECHA_FIN')
      .addGroupBy('p.FECHA_PAGO')
      .addGroupBy('p.ESTADO')
      .addGroupBy('p.TIPO_PERIODO')
      .addGroupBy('p.OBSERVACIONES')
      .addGroupBy('p.SUCURSAL_ID')
      .addGroupBy('p.ORIGEN_FONDOS')
      .addGroupBy('p.REFERENCIA_PAGO')
      .addGroupBy('p.BANCO_ORIGEN')
      .addGroupBy('p.TOTAL_BRUTO')
      .addGroupBy('p.TOTAL_DESCUENTOS')
      .addGroupBy('p.TOTAL_NETO')
      .orderBy('p.FECHA_INICIO', 'DESC')
      .offset(skip)
      .limit(limit);

    const rawItems = await qb.getRawMany();
    const countQb = this.planillaRepo.createQueryBuilder('p');
    if (filters.sucursalId) {
      countQb.where('p.SUCURSAL_ID = :sucId', { sucId: Number(filters.sucursalId) });
    }
    const total = await countQb.getCount();

    const sucursalesList = await this.sucursalRepo.find();
    const sucMap = new Map(sucursalesList.map((s) => [s.sucursalId, s.nombre]));

    const totalKpi = total;
    const pagadasKpi = await countQb.clone().andWhere("p.ESTADO = 'PAGADA'").getCount();
    const empCountQb = this.empleadoRepo.createQueryBuilder('e').where("e.ESTADO = 'ACTIVO'");
    if (filters.sucursalId) {
      empCountQb.andWhere('e.SUCURSAL_ID = :sucId', { sucId: Number(filters.sucursalId) });
    }
    const colaboradoresKpi = await empCountQb.getCount();

    return {
      data: rawItems.map((r) => {
        const sId = r.sucursalId ? Number(r.sucursalId) : null;
        return {
          planillaId: Number(r.planillaId),
          fechaInicio: r.fechaInicio,
          fechaFin: r.fechaFin,
          fechaPago: r.fechaPago,
          tipoPeriodo: r.tipoPeriodo || 'MENSUAL',
          observaciones: r.observaciones || '',
          sucursalId: sId,
          sucursalNombre: sId ? (sucMap.get(sId) || `Sucursal #${sId}`) : 'Consolidada (Todas las Sedes)',
          origenFondos: r.origenFondos || null,
          referenciaPago: r.referenciaPago || null,
          bancoOrigen: r.bancoOrigen || null,
          totalBruto: Number(r.totalBruto || 0),
          totalDescuentos: Number(r.totalDescuentos || 0),
          totalNeto: Number(r.totalNeto || 0),
          estado: r.estado,
          totalColaboradores: Number(r.totalColaboradores || 0),
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      kpis: {
        totalPlanillas: totalKpi,
        planillasPagadas: pagadasKpi,
        colaboradoresActivos: colaboradoresKpi,
      },
    };
  }

  /**
   * Consultar detalle de una planilla con boletas individuales de colaboradores
   */
  async findOnePlanilla(id: number, scope?: BranchScopeContext) {
    const planilla = await this.planillaRepo.findOne({
      where: { planillaId: id },
      relations: {
        planillaDetalles: {
          empleado: {
            puesto: true,
            sucursal: true,
          },
        },
      },
    });

    if (!planilla) {
      throw new NotFoundException(`Planilla con ID ${id} no encontrada`);
    }

    if (scope && !scope.isGlobal && scope.effectiveSucursalId) {
      if (planilla.sucursalId && Number(planilla.sucursalId) !== Number(scope.effectiveSucursalId)) {
        throw new ForbiddenException(
          `No tienes autorización para consultar la planilla de otra sede (Sede #${planilla.sucursalId}).`
        );
      }
    }

    let sucursalNombre = 'Consolidada (Todas las Sedes)';
    if (planilla.sucursalId) {
      const s = await this.sucursalRepo.findOne({ where: { sucursalId: planilla.sucursalId } });
      if (s) sucursalNombre = s.nombre;
    }

    return {
      planillaId: planilla.planillaId,
      fechaInicio: planilla.fechaInicio,
      fechaFin: planilla.fechaFin,
      fechaPago: planilla.fechaPago,
      tipoPeriodo: planilla.tipoPeriodo || 'MENSUAL',
      observaciones: planilla.observaciones || '',
      sucursalId: planilla.sucursalId ? Number(planilla.sucursalId) : null,
      sucursalNombre,
      origenFondos: planilla.origenFondos,
      referenciaPago: planilla.referenciaPago,
      bancoOrigen: planilla.bancoOrigen,
      observacionesPago: planilla.observacionesPago,
      totalBruto: Number(planilla.totalBruto),
      totalDescuentos: Number(planilla.totalDescuentos),
      totalNeto: Number(planilla.totalNeto),
      estado: planilla.estado,
      detalles: (planilla.planillaDetalles || []).map((d) => ({
        planillaDetalleId: d.planillaDetalleId,
        empleadoId: d.empleadoId,
        colaborador: `${d.empleado?.nombre} ${d.empleado?.apellido || ''}`.trim(),
        dpi: d.empleado?.dpi || 'N/A',
        nit: d.empleado?.nit || 'CF',
        noAfiliacionIgss: d.empleado?.noAfiliacionIgss || 'N/A',
        formaPago: d.empleado?.formaPago || 'TRANSFERENCIA',
        banco: d.empleado?.banco || 'N/A',
        numeroCuenta: d.empleado?.numeroCuenta || 'N/A',
        email: d.empleado?.email || '',
        puesto: d.empleado?.puesto?.nombre || 'General',
        sucursal: d.empleado?.sucursal?.nombre || 'Central',
        salarioBase: Number(d.salarioBase),
        bonificaciones: Number(d.bonificaciones),
        horasExtra: Number(d.horasExtra),
        descuentos: Number(d.descuentos),
        descuentoIgss: Number(d.descuentoIgss || d.descuentos || 0),
        diasTrabajados: Number(d.diasTrabajados || 30),
        totalPagar: Number(d.totalPagar),
      })),
    };
  }

  /**
   * Generar planilla masiva atómica con reglas laborales de Guatemala:
   * - Bonificación Incentivo Decreto 37-2001 (Q250.00 mensual / Q125.00 quincenal exenta de IGSS).
   * - Retención IGSS Laboral 4.83% sobre el Sueldo Devengado (NUNCA sobre la bonificación).
   */
  async generarPlanilla(dto: GenerarPlanillaDto) {
    const inicio = new Date(dto.fechaInicio);
    const fin = new Date(dto.fechaFin);

    if (inicio > fin) {
      throw new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin');
    }

    return this.dataSource.transaction(async (manager) => {
      // 1. Validar traslapes de fechas
      const traslape = await manager
        .getRepository(Planilla)
        .createQueryBuilder('p')
        .where("p.ESTADO != 'CANCELADA'")
        .andWhere('(p.FECHA_INICIO <= :fin AND p.FECHA_FIN >= :inicio)', { inicio, fin })
        .getOne();

      if (traslape) {
        const fIni = new Date(traslape.fechaInicio).toISOString().substring(0, 10);
        const fFin = new Date(traslape.fechaFin).toISOString().substring(0, 10);
        throw new ConflictException(
          `Ya existe una planilla (#${traslape.planillaId}) en el rango del ${fIni} al ${fFin}. No se permiten traslapes de períodos de planilla.`,
        );
      }

      // 2. Filtrar colaboradores activos
      const empQb = manager
        .getRepository(Empleado)
        .createQueryBuilder('e')
        .leftJoinAndSelect('e.puesto', 'puesto')
        .leftJoinAndSelect('e.sucursal', 'sucursal')
        .where("e.ESTADO = 'ACTIVO'");

      if (dto.sucursalId && dto.sucursalId !== 'TODAS' && Number(dto.sucursalId) > 0) {
        empQb.andWhere('e.SUCURSAL_ID = :sucId', { sucId: Number(dto.sucursalId) });
      }

      const empleadosActivos = await empQb.getMany();

      if (!empleadosActivos || empleadosActivos.length === 0) {
        throw new BadRequestException('No hay colaboradores activos registrados para generar la planilla');
      }

      // 3. Determinar período y reglas nominales
      let tipoPeriodo = dto.tipoPeriodo;
      const diffDays = Math.ceil(Math.abs(fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const esQuincenal = tipoPeriodo ? (tipoPeriodo.includes('QUINCENA')) : (diffDays <= 16);
      if (!tipoPeriodo) {
        tipoPeriodo = esQuincenal ? 'PRIMERA_QUINCENA' : 'MENSUAL';
      }

      const diasPeriodoNominal = esQuincenal ? 15 : 30;
      const bonifLeyNominal = esQuincenal ? 125.0 : 250.0; // Dto. 37-2001

      const sucursalIdFinal =
        dto.sucursalId && dto.sucursalId !== 'TODAS' && Number(dto.sucursalId) > 0
          ? Number(dto.sucursalId)
          : null;

      // 4. Crear cabecera de planilla
      const nuevaPlanilla = manager.create(Planilla, {
        fechaInicio: inicio,
        fechaFin: fin,
        fechaPago: null,
        estado: 'ABIERTA',
        tipoPeriodo,
        observaciones: dto.observaciones || dto.observacion || null,
        sucursalId: sucursalIdFinal,
        totalBruto: 0,
        totalDescuentos: 0,
        totalNeto: 0,
      });
      const planillaGuardada = await manager.save(nuevaPlanilla);

      let acumBruto = 0;
      let acumDescuentos = 0;
      let acumNeto = 0;

      // 5. Procesar boleta individual por colaborador con legislación de Guatemala
      for (const emp of empleadosActivos) {
        const salarioMensual = Number(emp.salarioActual) || 3500.0;
        const fechaIngreso = emp.fechaIngreso ? new Date(emp.fechaIngreso) : inicio;

        let diasLaborados = diasPeriodoNominal;
        if (fechaIngreso > inicio) {
          const ms = fin.getTime() - fechaIngreso.getTime();
          const dias = Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1;
          diasLaborados = Math.max(0, Math.min(diasPeriodoNominal, dias));
        }

        // Sueldo Devengado Proporcional
        const sueldoDiario = salarioMensual / 30;
        const sueldoDevengado = Number((sueldoDiario * diasLaborados).toFixed(2));

        // Bonificación Incentivo Decreto 37-2001 (EXENTA DE IGSS)
        const bonifIncentivo = Number(((bonifLeyNominal / diasPeriodoNominal) * diasLaborados).toFixed(2));

        // Retención IGSS Laboral 4.83% (ÚNICAMENTE sobre Sueldo Devengado)
        const igssLaboral = Number((sueldoDevengado * 0.0483).toFixed(2));

        // Total Bruto = Sueldo Devengado + Bonificación Incentivo
        const totalBrutoEmp = Number((sueldoDevengado + bonifIncentivo).toFixed(2));

        // Total Neto = Total Bruto - IGSS Laboral
        const totalPagar = Number((totalBrutoEmp - igssLaboral).toFixed(2));

        acumBruto += totalBrutoEmp;
        acumDescuentos += igssLaboral;
        acumNeto += totalPagar;

        const detalle = manager.create(PlanillaDetalle, {
          planilla: planillaGuardada,
          empleado: emp,
          salarioBase: sueldoDevengado,
          bonificaciones: bonifIncentivo,
          horasExtra: 0,
          descuentoIgss: igssLaboral,
          descuentos: igssLaboral,
          diasTrabajados: diasLaborados,
          totalPagar,
        });
        await manager.save(detalle);
      }

      planillaGuardada.totalBruto = Number(acumBruto.toFixed(2));
      planillaGuardada.totalDescuentos = Number(acumDescuentos.toFixed(2));
      planillaGuardada.totalNeto = Number(acumNeto.toFixed(2));
      await manager.save(planillaGuardada);

      this.logger.log(
        `Planilla #${planillaGuardada.planillaId} (${tipoPeriodo}) generada para ${empleadosActivos.length} colaboradores. Total Neto: Q ${planillaGuardada.totalNeto.toFixed(2)}`,
      );

      return {
        mensaje: `Planilla #${planillaGuardada.planillaId} (${tipoPeriodo}) generada exitosamente`,
        planillaId: planillaGuardada.planillaId,
        colaboradoresProcesados: empleadosActivos.length,
        totalBruto: planillaGuardada.totalBruto,
        totalDescuentos: planillaGuardada.totalDescuentos,
        totalNeto: planillaGuardada.totalNeto,
      };
    });
  }

  /**
   * Pagar / desembolsar planilla con origen de fondos y control estricto de sucursal
   */
  async pagarPlanilla(id: number, dto: DesembolsarPlanillaDto, scope: BranchScopeContext) {
    const planilla = await this.planillaRepo.findOne({ where: { planillaId: id } });
    if (!planilla) {
      throw new NotFoundException(`Planilla con ID ${id} no encontrada`);
    }

    if (planilla.estado === 'PAGADA') {
      throw new BadRequestException('Esta planilla ya se encuentra en estado PAGADA');
    }

    // Regla de Seguridad Crítica: Un Gerente de Sucursal NO puede desembolsar la planilla general ni de otra sede
    if (!scope.isGlobal && scope.effectiveSucursalId) {
      if (!planilla.sucursalId) {
        throw new ForbiddenException(
          'Acceso denegado: Un Gerente de Sucursal no puede desembolsar la planilla general consolidada. Esta operación es exclusiva de la Administración Central / SUPER_ADMIN.',
        );
      }
      if (Number(planilla.sucursalId) !== Number(scope.effectiveSucursalId)) {
        throw new ForbiddenException(
          `Acceso denegado: No tienes autorización para desembolsar la planilla de una sucursal distinta a la tuya (Sede asignada #${scope.effectiveSucursalId}).`,
        );
      }
    }

    planilla.estado = 'PAGADA';
    planilla.fechaPago = new Date();
    planilla.origenFondos = dto.origenFondos;
    planilla.referenciaPago = dto.referenciaPago;
    planilla.bancoOrigen = dto.bancoOrigen || null;
    planilla.observacionesPago = dto.observacionesPago || null;
    await this.planillaRepo.save(planilla);

    return {
      mensaje: `Planilla #${id} desembolsada exitosamente con cargo a ${
        dto.origenFondos === 'BANCO' ? 'Banco: ' + (dto.bancoOrigen || 'Corporativo') : 'Caja de Tienda'
      }.`,
      planillaId: id,
      fechaPago: planilla.fechaPago,
      origenFondos: planilla.origenFondos,
      referenciaPago: planilla.referenciaPago,
    };
  }

  /**
   * Directorio de empleados con campos completos
   */
  async findAllEmpleados(sucursalId?: number) {
    const qb = this.empleadoRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.puesto', 'puesto')
      .leftJoinAndSelect('e.sucursal', 'sucursal');

    if (sucursalId) {
      qb.where('sucursal.sucursalId = :sucursalId', { sucursalId });
    }

    qb.orderBy('e.empleadoId', 'ASC');
    const empleados = await qb.getMany();

    return empleados.map((e) => ({
      empleadoId: e.empleadoId,
      nombre: e.nombre,
      apellido: e.apellido,
      nombreCompleto: `${e.nombre} ${e.apellido}`.trim(),
      dpi: e.dpi || 'Sin DPI',
      telefono: e.telefono || 'Sin teléfono',
      nit: e.nit || 'CF',
      noAfiliacionIgss: e.noAfiliacionIgss || 'Sin IGSS',
      formaPago: e.formaPago || 'TRANSFERENCIA',
      banco: e.banco || 'N/A',
      numeroCuenta: e.numeroCuenta || 'N/A',
      email: e.email || '',
      salarioActual: Number(e.salarioActual),
      fechaIngreso: e.fechaIngreso,
      estado: e.estado,
      puesto: e.puesto?.nombre || 'Puesto General',
      puestoId: e.puesto?.puestoId,
      sucursal: e.sucursal?.nombre || 'Sucursal',
      sucursalId: e.sucursal?.sucursalId,
    }));
  }

  /**
   * Crear empleado con todos los campos laborales y de pago
   */
  async createEmpleado(dto: CreateEmpleadoDto) {
    return this.dataSource.transaction(async (manager) => {
      const puesto = await manager.findOne(Puesto, { where: { puestoId: dto.puestoId } });
      if (!puesto) throw new NotFoundException(`Puesto con ID ${dto.puestoId} no encontrado`);

      const sucursal = await manager.findOne(Sucursal, { where: { sucursalId: dto.sucursalId } });
      if (!sucursal) throw new NotFoundException(`Sucursal con ID ${dto.sucursalId} no encontrada`);

      const emp = manager.create(Empleado, {
        nombre: dto.nombre.trim(),
        apellido: dto.apellido.trim(),
        dpi: dto.dpi?.trim() || null,
        telefono: dto.telefono?.trim() || null,
        nit: dto.nit?.trim() || null,
        noAfiliacionIgss: dto.noAfiliacionIgss?.trim() || null,
        formaPago: dto.formaPago || 'TRANSFERENCIA',
        banco: dto.banco?.trim() || null,
        numeroCuenta: dto.numeroCuenta?.trim() || null,
        email: dto.email?.trim() || null,
        salarioActual: Number(dto.salarioActual),
        puesto,
        sucursal,
        fechaIngreso: dto.fechaIngreso ? new Date(dto.fechaIngreso) : new Date(),
        estado: 'ACTIVO',
      });

      const guardado = await manager.save(emp);

      // Asiento en HistorialSalario
      const hist = manager.create(HistorialSalario, {
        empleado: guardado,
        salarioAnterior: 0,
        salarioNuevo: Number(dto.salarioActual),
        motivo: 'Salario inicial de contratación',
        fechaCambio: new Date(),
      });
      await manager.save(hist);

      return {
        mensaje: `Colaborador ${guardado.nombre} ${guardado.apellido} registrado exitosamente.`,
        empleado: guardado,
      };
    });
  }

  /**
   * Catálogo de puestos
   */
  async findAllPuestos() {
    return this.puestoRepo.find({ order: { puestoId: 'ASC' } });
  }

  /**
   * Actualizar datos del colaborador y su salario con registro en historial
   */
  async updateEmpleado(id: number, dto: UpdateEmpleadoDto, sucursalId?: number) {
    return this.dataSource.transaction(async (manager) => {
      const emp = await manager.findOne(Empleado, {
        where: { empleadoId: id },
        relations: { puesto: true, sucursal: true },
      });
      if (!emp) {
        throw new NotFoundException(`Colaborador con ID ${id} no encontrado`);
      }

      if (sucursalId && Number(emp.sucursal?.sucursalId) !== Number(sucursalId)) {
        throw new BadRequestException('No puedes modificar colaboradores de otra sucursal.');
      }

      if (dto.nombre) emp.nombre = dto.nombre.trim();
      if (dto.apellido) emp.apellido = dto.apellido.trim();
      if (dto.dpi !== undefined) emp.dpi = dto.dpi ? dto.dpi.trim() : null;
      if (dto.telefono !== undefined) emp.telefono = dto.telefono ? dto.telefono.trim() : null;
      if (dto.fechaIngreso) emp.fechaIngreso = new Date(dto.fechaIngreso);
      if (dto.nit !== undefined) emp.nit = dto.nit ? dto.nit.trim() : null;
      if (dto.noAfiliacionIgss !== undefined) emp.noAfiliacionIgss = dto.noAfiliacionIgss ? dto.noAfiliacionIgss.trim() : null;
      if (dto.formaPago !== undefined) emp.formaPago = dto.formaPago || 'TRANSFERENCIA';
      if (dto.banco !== undefined) emp.banco = dto.banco ? dto.banco.trim() : null;
      if (dto.numeroCuenta !== undefined) emp.numeroCuenta = dto.numeroCuenta ? dto.numeroCuenta.trim() : null;
      if (dto.email !== undefined) emp.email = dto.email ? dto.email.trim() : null;
      if (dto.estado) emp.estado = dto.estado;

      if (dto.puestoId) {
        const puesto = await manager.findOne(Puesto, { where: { puestoId: dto.puestoId } });
        if (!puesto) throw new NotFoundException(`Puesto con ID ${dto.puestoId} no encontrado`);
        emp.puesto = puesto;
      }

      if (dto.sucursalId) {
        const targetSuc = sucursalId || dto.sucursalId;
        const sucursal = await manager.findOne(Sucursal, { where: { sucursalId: targetSuc } });
        if (!sucursal) throw new NotFoundException(`Sucursal con ID ${targetSuc} no encontrada`);
        emp.sucursal = sucursal;
      }

      // Si cambia el salario, asentar en HistorialSalario
      if (dto.salarioActual !== undefined && Number(dto.salarioActual) !== Number(emp.salarioActual)) {
        const salarioPrevio = Number(emp.salarioActual);
        const salarioNuevo = Number(dto.salarioActual);

        const hist = manager.create(HistorialSalario, {
          empleado: emp,
          salarioAnterior: salarioPrevio,
          salarioNuevo: salarioNuevo,
          motivo: 'Ajuste / Actualización salarial',
          fechaCambio: new Date(),
        });
        await manager.save(hist);

        emp.salarioActual = salarioNuevo;
      }

      const actualizado = await manager.save(emp);

      return {
        mensaje: `Colaborador ${actualizado.nombre} ${actualizado.apellido} actualizado exitosamente.`,
        empleado: {
          empleadoId: actualizado.empleadoId,
          nombre: actualizado.nombre,
          apellido: actualizado.apellido,
          nombreCompleto: `${actualizado.nombre} ${actualizado.apellido}`.trim(),
          dpi: actualizado.dpi,
          telefono: actualizado.telefono,
          nit: actualizado.nit,
          noAfiliacionIgss: actualizado.noAfiliacionIgss,
          formaPago: actualizado.formaPago,
          banco: actualizado.banco,
          numeroCuenta: actualizado.numeroCuenta,
          email: actualizado.email,
          salarioActual: Number(actualizado.salarioActual),
          fechaIngreso: actualizado.fechaIngreso,
          estado: actualizado.estado,
          puesto: actualizado.puesto?.nombre,
          puestoId: actualizado.puesto?.puestoId,
          sucursal: actualizado.sucursal?.nombre,
          sucursalId: actualizado.sucursal?.sucursalId,
        },
      };
    });
  }

  /**
   * Cambiar estado operativo del colaborador (Baja laboral / Reactivación)
   */
  async toggleEstadoEmpleado(id: number, nuevoEstado?: string, sucursalId?: number) {
    const emp = await this.empleadoRepo.findOne({
      where: { empleadoId: id },
      relations: { sucursal: true },
    });
    if (!emp) {
      throw new NotFoundException(`Colaborador con ID ${id} no encontrado`);
    }

    if (sucursalId && Number(emp.sucursal?.sucursalId) !== Number(sucursalId)) {
      throw new BadRequestException('No puedes dar de baja o reactivar colaboradores de otra sucursal.');
    }

    const estadoFinal = nuevoEstado || (emp.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO');
    emp.estado = estadoFinal;
    await this.empleadoRepo.save(emp);

    return {
      mensaje: `Colaborador ${emp.nombre} ${emp.apellido} marcado como ${estadoFinal}.`,
      empleadoId: emp.empleadoId,
      estado: emp.estado,
    };
  }
}

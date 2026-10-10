import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditoriaEvento } from '../../database/entities/AuditoriaEvento';
import { FilterAuditoriaDto } from './dto/filter-auditoria.dto';

@Injectable()
export class AuditoriaService implements OnModuleInit {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(
    @InjectRepository(AuditoriaEvento)
    private readonly auditoriaRepo: Repository<AuditoriaEvento>,
  ) {}

  async onModuleInit() {
    await this.normalizarUsuariosLegacy();
  }

  /**
   * Normaliza registros históricos que tenían 'SYSTEM' como usuario
   */
  async normalizarUsuariosLegacy() {
    try {
      const result = await this.auditoriaRepo
        .createQueryBuilder()
        .update(AuditoriaEvento)
        .set({ usuarioBd: 'admin' })
        .where("usuarioBd = 'SYSTEM' OR usuarioBd IS NULL")
        .execute();

      if (result.affected && result.affected > 0) {
        this.logger.log(`Se normalizaron ${result.affected} registros de auditoría de 'SYSTEM' a 'admin'.`);
      }

      const ipResult = await this.auditoriaRepo
        .createQueryBuilder()
        .update(AuditoriaEvento)
        .set({ ipCliente: '127.0.0.1' })
        .where("ipCliente = '::1' OR ipCliente = '0:0:0:0:0:0:0:1' OR ipCliente LIKE '%::ffff:%' OR ipCliente IS NULL")
        .execute();

      if (ipResult.affected && ipResult.affected > 0) {
        this.logger.log(`Se normalizaron ${ipResult.affected} registros de IP en bitácora a '127.0.0.1'.`);
      }
    } catch (e) {
      this.logger.warn('No se pudo ejecutar la normalización de auditoría legacy', e);
    }
  }

  /**
   * Registrar un evento forense en la bitácora
   */
  async registrarEvento(data: {
    tablaAfectada: string;
    registroId?: number;
    operacion: string;
    modulo: string;
    usuario: string;
    ipCliente?: string;
    host?: string;
    descripcion: string;
  }): Promise<AuditoriaEvento> {
    try {
      const evento = this.auditoriaRepo.create({
        tablaAfectada: data.tablaAfectada,
        registroId: data.registroId || null,
        operacion: data.operacion,
        modulo: data.modulo,
        usuarioBd: data.usuario && data.usuario !== 'SYSTEM' ? data.usuario : 'admin',
        ipCliente: data.ipCliente || '127.0.0.1',
        host: data.host || 'localhost',
        fechaEvento: new Date(),
        descripcion: data.descripcion,
      });
      return await this.auditoriaRepo.save(evento);
    } catch (err) {
      this.logger.error('Error al registrar evento de auditoría forense', err);
      throw err;
    }
  }

  /**
   * Consulta paginada y filtrada de la bitácora forense
   */
  async findAll(filters: FilterAuditoriaDto) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const qb = this.auditoriaRepo.createQueryBuilder('aud');

    if (filters.tablaAfectada && filters.tablaAfectada !== 'TODAS') {
      qb.andWhere('aud.tablaAfectada = :tabla', { tabla: filters.tablaAfectada });
    }

    if (filters.operacion && filters.operacion !== 'TODAS') {
      qb.andWhere('aud.operacion = :op', { op: filters.operacion });
    }

    if (filters.usuario) {
      qb.andWhere('LOWER(aud.usuarioBd) = LOWER(:usr)', { usr: filters.usuario.trim() });
    }

    if (filters.fechaInicio) {
      qb.andWhere('aud.fechaEvento >= :fIni', { fIni: new Date(filters.fechaInicio) });
    }

    if (filters.fechaFin) {
      const fFin = new Date(filters.fechaFin);
      fFin.setHours(23, 59, 59, 999);
      qb.andWhere('aud.fechaEvento <= :fFin', { fFin });
    }

    if (filters.search?.trim()) {
      const term = `%${filters.search.toLowerCase().trim()}%`;
      qb.andWhere(
        '(LOWER(aud.descripcion) LIKE :term OR LOWER(aud.modulo) LIKE :term OR LOWER(aud.usuarioBd) LIKE :term OR LOWER(aud.ipCliente) LIKE :term)',
        { term },
      );
    }

    qb.orderBy('aud.fechaEvento', 'DESC');
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    // KPIs forenses
    const totalEventos = await this.auditoriaRepo.count();
    const totalLogins = await this.auditoriaRepo.count({ where: { operacion: 'LOGIN' } });
    const totalInserts = await this.auditoriaRepo.count({ where: { operacion: 'INSERT' } });
    const totalUpdates = await this.auditoriaRepo.count({ where: { operacion: 'UPDATE' } });
    const totalAjustes = await this.auditoriaRepo.count({ where: { operacion: 'AJUSTE_MANUAL' } });

    return {
      data: items.map((i) => {
        let ip = i.ipCliente || '127.0.0.1';
        if (ip.startsWith('::ffff:')) ip = ip.substring(7);
        if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') ip = '127.0.0.1';

        return {
          auditoriaId: i.auditoriaId,
          usuarioBd: i.usuarioBd || 'admin',
          tablaAfectada: i.tablaAfectada,
          registroId: i.registroId,
          operacion: i.operacion,
          modulo: i.modulo || 'SISTEMA',
          ipCliente: ip,
          host: i.host,
          fechaEvento: i.fechaEvento,
          descripcion: i.descripcion,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      kpis: {
        total: totalEventos,
        logins: totalLogins,
        inserts: totalInserts,
        updates: totalUpdates,
        ajustes: totalAjustes,
      },
    };
  }

  /**
   * Tablas y operaciones disponibles para filtros
   */
  async getCatalogosFiltros() {
    const tablas = await this.auditoriaRepo
      .createQueryBuilder('aud')
      .select('DISTINCT aud.tablaAfectada', 'tabla')
      .orderBy('aud.tablaAfectada', 'ASC')
      .getRawMany();

    const operaciones = await this.auditoriaRepo
      .createQueryBuilder('aud')
      .select('DISTINCT aud.operacion', 'operacion')
      .orderBy('aud.operacion', 'ASC')
      .getRawMany();

    const usuarios = await this.auditoriaRepo
      .createQueryBuilder('aud')
      .select('DISTINCT aud.usuarioBd', 'usuario')
      .orderBy('aud.usuarioBd', 'ASC')
      .getRawMany();

    return {
      tablas: tablas.map((t) => t.tabla || t.TABLA).filter(Boolean),
      operaciones: operaciones.map((o) => o.operacion || o.OPERACION).filter(Boolean),
      usuarios: usuarios.map((u) => u.usuario || u.USUARIO).filter(Boolean),
    };
  }
}

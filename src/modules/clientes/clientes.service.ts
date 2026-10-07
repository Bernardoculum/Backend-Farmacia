import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from '../../database/entities/Cliente';
import { Laboratorio } from '../../database/entities/Laboratorio';
import { Municipio } from '../../database/entities/Municipio';
import {
  CreateClienteDto,
  UpdateClienteDto,
  FilterClienteDto,
  CreateLaboratorioDto,
  UpdateLaboratorioDto,
} from './dto/cliente.dto';

@Injectable()
export class ClientesService {
  private readonly logger = new Logger(ClientesService.name);

  constructor(
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(Laboratorio)
    private readonly laboratorioRepo: Repository<Laboratorio>,
    @InjectRepository(Municipio)
    private readonly municipioRepo: Repository<Municipio>,
  ) {}

  /**
   * Listar clientes con paginación server-side (OFFSET/FETCH) y KPIs
   */
  async findAllClientes(filters: FilterClienteDto) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const qb = this.clienteRepo
      .createQueryBuilder('cli')
      .leftJoinAndSelect('cli.municipio', 'muni')
      .leftJoinAndSelect('muni.departamento', 'dep');

    if (filters.estado && filters.estado !== 'TODOS') {
      qb.andWhere('cli.estado = :estado', { estado: filters.estado });
    }

    if (filters.search) {
      const term = `%${filters.search.toLowerCase().trim()}%`;
      qb.andWhere(
        '(LOWER(cli.nombre) LIKE :term OR LOWER(cli.apellido) LIKE :term OR LOWER(cli.telefono) LIKE :term OR LOWER(cli.direccion) LIKE :term)',
        { term },
      );
    }

    qb.orderBy('cli.fechaRegistro', 'DESC');
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    // KPIs
    const totalKpi = await this.clienteRepo.count();
    const activosKpi = await this.clienteRepo.count({ where: { estado: 'ACTIVO' } });
    const inactivosKpi = await this.clienteRepo.count({ where: { estado: 'INACTIVO' } });

    return {
      data: items.map((c) => ({
        clienteId: c.clienteId,
        nombre: c.nombre,
        apellido: c.apellido,
        nombreCompleto: `${c.nombre} ${c.apellido || ''}`.trim(),
        telefono: c.telefono,
        email: c.email,
        direccion: c.direccion,
        referenciaDireccion: c.referenciaDireccion,
        municipio: c.municipio?.nombre,
        departamento: c.municipio?.departamento?.nombre,
        fechaRegistro: c.fechaRegistro,
        estado: c.estado,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      kpis: {
        total: totalKpi,
        activos: activosKpi,
        inactivos: inactivosKpi,
      },
    };
  }

  /**
   * Detalle de un cliente con sus últimos pedidos
   */
  async findOneCliente(id: number) {
    const cliente = await this.clienteRepo.findOne({
      where: { clienteId: id },
      relations: {
        municipio: { departamento: true },
        pedidos: {
          sucursalPreparacion: true,
          metodoPago: true,
        },
      },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    return {
      ...cliente,
      pedidos: (cliente.pedidos || [])
        .sort((a, b) => new Date(b.fechaPedido).getTime() - new Date(a.fechaPedido).getTime())
        .slice(0, 10),
    };
  }

  /**
   * Crear cliente
   */
  async createCliente(dto: CreateClienteDto) {
    const existeTel = await this.clienteRepo.findOne({
      where: { telefono: dto.telefono.trim() },
    });

    if (existeTel) {
      throw new ConflictException(
        `El número de teléfono "${dto.telefono}" ya se encuentra registrado para el cliente "${existeTel.nombre} ${existeTel.apellido || ''}".`,
      );
    }

    let municipio: Municipio | null = null;
    if (dto.municipioId) {
      municipio = await this.municipioRepo.findOne({ where: { municipioId: dto.municipioId } });
    }

    const nuevo = this.clienteRepo.create({
      nombre: dto.nombre.trim(),
      apellido: dto.apellido?.trim() || null,
      telefono: dto.telefono.trim(),
      email: dto.email?.trim() || null,
      direccion: dto.direccion.trim(),
      referenciaDireccion: dto.referenciaDireccion?.trim() || null,
      latitud: dto.latitud || null,
      longitud: dto.longitud || null,
      estado: 'ACTIVO',
      municipio: municipio!,
      fechaRegistro: new Date(),
    });

    const guardado = await this.clienteRepo.save(nuevo);
    this.logger.log(`Cliente registrado: ${guardado.nombre} ${guardado.apellido || ''} (ID: ${guardado.clienteId})`);

    return {
      mensaje: 'Cliente registrado exitosamente',
      cliente: guardado,
    };
  }

  /**
   * Actualizar cliente
   */
  async updateCliente(id: number, dto: UpdateClienteDto) {
    const cliente = await this.clienteRepo.findOne({ where: { clienteId: id } });
    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    if (dto.telefono && dto.telefono.trim() !== cliente.telefono) {
      const existeTel = await this.clienteRepo.findOne({
        where: { telefono: dto.telefono.trim() },
      });
      if (existeTel && existeTel.clienteId !== id) {
        throw new ConflictException(`El teléfono "${dto.telefono}" ya está asignado a otro cliente.`);
      }
      cliente.telefono = dto.telefono.trim();
    }

    if (dto.nombre) cliente.nombre = dto.nombre.trim();
    if (dto.apellido !== undefined) cliente.apellido = dto.apellido?.trim() || null;
    if (dto.email !== undefined) cliente.email = dto.email?.trim() || null;
    if (dto.direccion) cliente.direccion = dto.direccion.trim();
    if (dto.referenciaDireccion !== undefined) cliente.referenciaDireccion = dto.referenciaDireccion?.trim() || null;
    if (dto.estado) cliente.estado = dto.estado;

    const actualizado = await this.clienteRepo.save(cliente);
    return {
      mensaje: 'Cliente actualizado exitosamente',
      cliente: actualizado,
    };
  }

  /**
   * Desactivar cliente
   */
  async desactivarCliente(id: number) {
    const cliente = await this.clienteRepo.findOne({ where: { clienteId: id } });
    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    cliente.estado = 'INACTIVO';
    await this.clienteRepo.save(cliente);
    return {
      mensaje: `Cliente "${cliente.nombre} ${cliente.apellido || ''}" desactivado exitosamente`,
    };
  }

  /**
   * Listar todos los laboratorios con conteo de medicamentos y estado
   */
  async findAllLaboratorios() {
    const laboratorios = await this.laboratorioRepo.find({
      relations: { productos: true },
      order: { nombre: 'ASC' },
    });

    return laboratorios.map((l: any) => ({
      laboratorioId: l.laboratorioId,
      nombre: l.nombre,
      telefono: l.telefono || 'Sin teléfono',
      estado: l.estado || 'ACTIVO',
      totalMedicamentos: (l.productos || []).length,
    }));
  }

  /**
   * Crear laboratorio
   */
  async createLaboratorio(dto: CreateLaboratorioDto) {
    const existe = await this.laboratorioRepo.findOne({
      where: { nombre: dto.nombre.trim() },
    });

    if (existe) {
      throw new ConflictException(`El laboratorio "${dto.nombre}" ya existe en el catálogo.`);
    }

    const nuevo = this.laboratorioRepo.create({
      nombre: dto.nombre.trim(),
      telefono: dto.telefono?.trim() || null,
      estado: 'ACTIVO',
    });

    const guardado = await this.laboratorioRepo.save(nuevo);
    return {
      mensaje: 'Laboratorio registrado exitosamente',
      laboratorio: guardado,
    };
  }

  /**
   * Actualizar datos de un laboratorio
   */
  async updateLaboratorio(id: number, dto: UpdateLaboratorioDto) {
    const lab = await this.laboratorioRepo.findOne({ where: { laboratorioId: id } });
    if (!lab) {
      throw new NotFoundException(`Laboratorio con ID ${id} no encontrado`);
    }

    if (dto.nombre && dto.nombre.trim() !== lab.nombre) {
      const existe = await this.laboratorioRepo.findOne({ where: { nombre: dto.nombre.trim() } });
      if (existe && existe.laboratorioId !== id) {
        throw new ConflictException(`Ya existe otro laboratorio con el nombre "${dto.nombre}".`);
      }
      lab.nombre = dto.nombre.trim();
    }

    if (dto.telefono !== undefined) {
      lab.telefono = dto.telefono ? dto.telefono.trim() : null;
    }

    if (dto.estado) {
      lab.estado = dto.estado;
    }

    const guardado = await this.laboratorioRepo.save(lab);
    return {
      mensaje: `Laboratorio "${guardado.nombre}" actualizado exitosamente`,
      laboratorio: guardado,
    };
  }

  /**
   * Alternar estado (dar de baja o reactivar) de un laboratorio
   */
  async toggleEstadoLaboratorio(id: number, nuevoEstado?: string) {
    const lab = await this.laboratorioRepo.findOne({ where: { laboratorioId: id } });
    if (!lab) {
      throw new NotFoundException(`Laboratorio con ID ${id} no encontrado`);
    }

    const estadoFinal = nuevoEstado || (lab.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO');
    lab.estado = estadoFinal;
    await this.laboratorioRepo.save(lab);

    return {
      mensaje: `Laboratorio "${lab.nombre}" ahora está ${estadoFinal}.`,
      laboratorio: lab,
    };
  }
}

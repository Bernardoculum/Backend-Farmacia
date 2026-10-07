import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Credencial } from '../../database/entities/Credencial';
import { Empleado } from '../../database/entities/Empleado';
import { Rol } from '../../database/entities/Rol';
import { Sucursal } from '../../database/entities/Sucursal';
import { Puesto } from '../../database/entities/Puesto';
import { AuditoriaEvento } from '../../database/entities/AuditoriaEvento';
import { CreateUserDto, UpdateUserDto, FilterUserDto, ChangePasswordDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(Credencial)
    private readonly credencialRepo: Repository<Credencial>,
    @InjectRepository(Empleado)
    private readonly empleadoRepo: Repository<Empleado>,
    @InjectRepository(Rol)
    private readonly rolRepo: Repository<Rol>,
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
    @InjectRepository(Puesto)
    private readonly puestoRepo: Repository<Puesto>,
    @InjectRepository(AuditoriaEvento)
    private readonly auditoriaRepo: Repository<AuditoriaEvento>,
    private readonly dataSource: DataSource,
  ) {}

  private async registrarAuditoria(datos: {
    usuario: string;
    registroId?: number;
    operacion: 'INSERT' | 'UPDATE' | 'DELETE' | 'AJUSTE_MANUAL';
    descripcion: string;
  }) {
    try {
      const evento = this.auditoriaRepo.create({
        tablaAfectada: 'CREDENCIAL',
        registroId: datos.registroId || null,
        operacion: datos.operacion,
        modulo: 'SEGURIDAD',
        usuarioBd: datos.usuario || 'SYSTEM',
        ipCliente: '127.0.0.1',
        host: 'localhost',
        fechaEvento: new Date(),
        descripcion: datos.descripcion,
      });
      await this.auditoriaRepo.save(evento);
    } catch (err) {
      this.logger.warn('No se pudo registrar auditoría de usuario', err);
    }
  }

  /**
   * Catálogo de roles activos para formularios
   */
  async getRoles() {
    return this.rolRepo.find({
      where: { estado: 'ACTIVO' },
      order: { rolId: 'ASC' },
    });
  }

  /**
   * Listado paginado de usuarios con KPIs y filtros
   */
  async findAll(filters: FilterUserDto) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const qb = this.credencialRepo
      .createQueryBuilder('cred')
      .leftJoinAndSelect('cred.rol', 'rol')
      .leftJoinAndSelect('cred.empleado', 'emp')
      .leftJoinAndSelect('emp.sucursal', 'suc')
      .leftJoinAndSelect('emp.puesto', 'puesto');

    if (filters.search?.trim()) {
      const term = `%${filters.search.toLowerCase().trim()}%`;
      qb.andWhere(
        '(LOWER(cred.username) LIKE :term OR LOWER(emp.nombre) LIKE :term OR LOWER(emp.apellido) LIKE :term OR LOWER(emp.dpi) LIKE :term)',
        { term },
      );
    }

    if (filters.rolId) {
      qb.andWhere('cred.rol.rolId = :rolId', { rolId: filters.rolId });
    }

    if (filters.sucursalId) {
      qb.andWhere('emp.sucursal.sucursalId = :sucursalId', { sucursalId: filters.sucursalId });
    }

    if (filters.estado && filters.estado !== 'TODOS') {
      qb.andWhere('cred.estado = :estado', { estado: filters.estado });
    }

    qb.orderBy('cred.credencialId', 'DESC');
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    // KPIs globales de usuarios
    const totalCount = await this.credencialRepo.count();
    const activosCount = await this.credencialRepo.count({ where: { estado: 'ACTIVO' } });
    const inactivosCount = totalCount - activosCount;
    const superAdminsCount = await this.credencialRepo
      .createQueryBuilder('cred')
      .innerJoin('cred.rol', 'rol')
      .where('rol.nombre = :rolNombre', { rolNombre: 'SUPER_ADMIN' })
      .getCount();

    const data = items.map((c) => ({
      credencialId: c.credencialId,
      username: c.username,
      estado: c.estado,
      ultimoLogin: c.ultimoLogin,
      fechaRegistro: c.fechaRegistro,
      rolId: c.rol?.rolId,
      rolNombre: c.rol?.nombre,
      rolDescripcion: c.rol?.descripcion,
      empleadoId: c.empleado?.empleadoId,
      nombre: c.empleado?.nombre,
      apellido: c.empleado?.apellido,
      nombreCompleto: c.empleado ? `${c.empleado.nombre} ${c.empleado.apellido}` : c.username,
      dpi: c.empleado?.dpi,
      telefono: c.empleado?.telefono,
      sucursalId: c.empleado?.sucursal?.sucursalId,
      sucursalNombre: c.empleado?.sucursal?.nombre || 'Sin Asignar',
      puestoId: c.empleado?.puesto?.puestoId,
      puestoNombre: c.empleado?.puesto?.nombre || 'Operador',
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      kpis: {
        total: totalCount,
        activos: activosCount,
        inactivos: inactivosCount,
        superAdmins: superAdminsCount,
      },
    };
  }

  /**
   * Consultar un usuario por ID
   */
  async findOne(id: number) {
    const c = await this.credencialRepo
      .createQueryBuilder('cred')
      .leftJoinAndSelect('cred.rol', 'rol')
      .leftJoinAndSelect('cred.empleado', 'emp')
      .leftJoinAndSelect('emp.sucursal', 'suc')
      .leftJoinAndSelect('emp.puesto', 'puesto')
      .where('cred.credencialId = :id', { id })
      .getOne();

    if (!c) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado.`);
    }

    return {
      credencialId: c.credencialId,
      username: c.username,
      estado: c.estado,
      ultimoLogin: c.ultimoLogin,
      fechaRegistro: c.fechaRegistro,
      rolId: c.rol?.rolId,
      rolNombre: c.rol?.nombre,
      empleadoId: c.empleado?.empleadoId,
      nombre: c.empleado?.nombre,
      apellido: c.empleado?.apellido,
      dpi: c.empleado?.dpi,
      telefono: c.empleado?.telefono,
      sucursalId: c.empleado?.sucursal?.sucursalId,
      sucursalNombre: c.empleado?.sucursal?.nombre,
      puestoId: c.empleado?.puesto?.puestoId,
      puestoNombre: c.empleado?.puesto?.nombre,
    };
  }

  /**
   * Crear un nuevo usuario en una transacción atómica única
   */
  async create(dto: CreateUserDto, operadorUser: string = 'SYSTEM') {
    const cleanUsername = dto.username.trim().toLowerCase();

    // Validar existencia previa de username
    const existeUsername = await this.credencialRepo.findOne({
      where: { username: cleanUsername },
    });
    if (existeUsername) {
      throw new ConflictException(`El nombre de usuario "${cleanUsername}" ya está en uso.`);
    }

    // Validar existencia de DPI si se proveyó
    if (dto.dpi?.trim()) {
      const existeDpi = await this.empleadoRepo.findOne({
        where: { dpi: dto.dpi.trim() },
      });
      if (existeDpi) {
        throw new ConflictException(`Ya existe un empleado con el DPI "${dto.dpi.trim()}".`);
      }
    }

    // Validar existencia de Rol y Sucursal
    const rol = await this.rolRepo.findOne({ where: { rolId: dto.rolId } });
    if (!rol) throw new NotFoundException(`El rol con ID ${dto.rolId} no existe.`);

    const sucursal = await this.sucursalRepo.findOne({ where: { sucursalId: dto.sucursalId } });
    if (!sucursal) throw new NotFoundException(`La sucursal con ID ${dto.sucursalId} no existe.`);

    // Obtener puesto asignado o fallback al primer puesto
    let puesto: Puesto | null = null;
    if (dto.puestoId) {
      puesto = await this.puestoRepo.findOne({ where: { puestoId: dto.puestoId } });
    }
    if (!puesto) {
      const puestos = await this.puestoRepo.find({ take: 1 });
      puesto = puestos[0] || null;
    }

    // Hashear contraseña con bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    return this.dataSource.transaction(async (manager) => {
      // 1. Crear Empleado
      const nuevoEmpleado = manager.create(Empleado, {
        nombre: dto.nombre.trim(),
        apellido: dto.apellido.trim(),
        dpi: dto.dpi?.trim() || null,
        telefono: dto.telefono?.trim() || null,
        salarioActual: 3500.0, // Salario base inicial estándar
        fechaIngreso: new Date(),
        estado: 'ACTIVO',
        sucursal,
        puesto: puesto || undefined,
      });
      const empleadoGuardado = await manager.save(nuevoEmpleado);

      // 2. Crear Credencial vinculada
      const nuevaCredencial = manager.create(Credencial, {
        username: cleanUsername,
        passwordHash,
        estado: 'ACTIVO',
        fechaRegistro: new Date(),
        empleado: empleadoGuardado,
        rol,
      });
      const credencialGuardada = await manager.save(nuevaCredencial);

      // 3. Auditoría Forense
      await this.registrarAuditoria({
        usuario: operadorUser,
        registroId: credencialGuardada.credencialId,
        operacion: 'INSERT',
        descripcion: `Creación de nuevo usuario '${cleanUsername}' con rol '${rol.nombre}' para ${dto.nombre} ${dto.apellido}.`,
      });

      return {
        message: 'Usuario creado exitosamente',
        credencialId: credencialGuardada.credencialId,
        username: credencialGuardada.username,
      };
    });
  }

  /**
   * Actualizar datos de un usuario existente
   */
  async update(id: number, dto: UpdateUserDto, operadorUser: string = 'SYSTEM', operadorId?: number) {
    const credencial = await this.credencialRepo.findOne({
      where: { credencialId: id },
      relations: {
        empleado: {
          sucursal: true,
          puesto: true,
        },
        rol: true,
      },
    });

    if (!credencial) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado.`);
    }

    // Regla de seguridad: Si es tu propia cuenta en sesión
    if (operadorId && id === operadorId) {
      if (dto.estado && dto.estado === 'INACTIVO') {
        throw new BadRequestException('Operación no permitida: No puedes desactivar tu propia cuenta activa.');
      }
      if (dto.rolId && credencial.rol?.rolId && dto.rolId !== credencial.rol.rolId && credencial.rol.nombre === 'SUPER_ADMIN') {
        throw new BadRequestException('Operación no permitida: No puedes revocar tu propio rol de Super Administrador.');
      }
    }

    return this.dataSource.transaction(async (manager) => {
      // Si cambia el username, validar unicidad
      if (dto.username && dto.username.trim().toLowerCase() !== credencial.username.toLowerCase()) {
        const cleanUser = dto.username.trim().toLowerCase();
        const existe = await manager.findOne(Credencial, { where: { username: cleanUser } });
        if (existe && existe.credencialId !== id) {
          throw new ConflictException(`El nombre de usuario "${cleanUser}" ya pertenece a otra cuenta.`);
        }
        credencial.username = cleanUser;
      }

      // Si cambia el rol
      if (dto.rolId && dto.rolId !== credencial.rol?.rolId) {
        const rol = await manager.findOne(Rol, { where: { rolId: dto.rolId } });
        if (!rol) throw new NotFoundException(`Rol con ID ${dto.rolId} no encontrado.`);
        credencial.rol = rol;
      }

      // Si cambia el estado
      if (dto.estado) {
        credencial.estado = dto.estado;
        if (credencial.empleado) {
          credencial.empleado.estado = dto.estado;
        }
      }

      // Si viene nueva contraseña
      if (dto.password?.trim()) {
        const salt = await bcrypt.genSalt(10);
        credencial.passwordHash = await bcrypt.hash(dto.password.trim(), salt);
      }

      // Actualizar datos del empleado asociado
      if (credencial.empleado) {
        if (dto.nombre) credencial.empleado.nombre = dto.nombre.trim();
        if (dto.apellido) credencial.empleado.apellido = dto.apellido.trim();
        if (dto.dpi !== undefined) credencial.empleado.dpi = dto.dpi?.trim() || null;
        if (dto.telefono !== undefined) credencial.empleado.telefono = dto.telefono?.trim() || null;

        if (dto.sucursalId && dto.sucursalId !== credencial.empleado.sucursal?.sucursalId) {
          const suc = await manager.findOne(Sucursal, { where: { sucursalId: dto.sucursalId } });
          if (!suc) throw new NotFoundException(`Sucursal con ID ${dto.sucursalId} no encontrada.`);
          credencial.empleado.sucursal = suc;
        }

        if (dto.puestoId && dto.puestoId !== credencial.empleado.puesto?.puestoId) {
          const puesto = await manager.findOne(Puesto, { where: { puestoId: dto.puestoId } });
          if (puesto) credencial.empleado.puesto = puesto;
        }

        await manager.save(credencial.empleado);
      }

      await manager.save(credencial);

      // Auditoría
      await this.registrarAuditoria({
        usuario: operadorUser,
        registroId: credencial.credencialId,
        operacion: 'UPDATE',
        descripcion: `Actualización de cuenta de usuario '${credencial.username}'.`,
      });

      return {
        message: 'Usuario actualizado exitosamente',
        credencialId: credencial.credencialId,
        username: credencial.username,
      };
    });
  }

  /**
   * Alternar estado Activo / Inactivo
   */
  async toggleEstado(id: number, operadorUser: string = 'SYSTEM', operadorId?: number) {
    if (operadorId && id === operadorId) {
      throw new BadRequestException('Operación no permitida: No puedes desactivar tu propia cuenta en sesión activa.');
    }

    const credencial = await this.credencialRepo.findOne({
      where: { credencialId: id },
      relations: { empleado: true },
    });

    if (!credencial) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado.`);
    }

    const nuevoEstado = credencial.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';

    return this.dataSource.transaction(async (manager) => {
      credencial.estado = nuevoEstado;
      if (credencial.empleado) {
        credencial.empleado.estado = nuevoEstado;
        await manager.save(credencial.empleado);
      }
      await manager.save(credencial);

      await this.registrarAuditoria({
        usuario: operadorUser,
        registroId: credencial.credencialId,
        operacion: 'UPDATE',
        descripcion: `Cambio de estado a '${nuevoEstado}' para el usuario '${credencial.username}'.`,
      });

      return {
        message: `Usuario ${nuevoEstado === 'ACTIVO' ? 'reactivado' : 'desactivado'} con éxito`,
        estado: nuevoEstado,
      };
    });
  }

  /**
   * Resetear contraseña
   */
  async changePassword(id: number, dto: ChangePasswordDto, operadorUser: string = 'SYSTEM') {
    const credencial = await this.credencialRepo.findOne({
      where: { credencialId: id },
    });

    if (!credencial) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado.`);
    }

    const salt = await bcrypt.genSalt(10);
    credencial.passwordHash = await bcrypt.hash(dto.newPassword.trim(), salt);
    await this.credencialRepo.save(credencial);

    await this.registrarAuditoria({
      usuario: operadorUser,
      registroId: credencial.credencialId,
      operacion: 'UPDATE',
      descripcion: `Restablecimiento de contraseña para el usuario '${credencial.username}'.`,
    });

    return {
      message: `Contraseña restablecida exitosamente para '${credencial.username}'.`,
    };
  }
}

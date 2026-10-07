import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sucursal } from '../../database/entities/Sucursal';
import { CreateSucursalDto } from './dto/create-sucursal.dto';
import { UpdateSucursalDto } from './dto/update-sucursal.dto';
import { FilterSucursalDto } from './dto/filter-sucursal.dto';

@Injectable()
export class SucursalesService {
  private readonly logger = new Logger(SucursalesService.name);

  constructor(
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
  ) {}

  /**
   * Listado paginado de sucursales con OFFSET / FETCH
   */
  async findAll(filterDto: FilterSucursalDto) {
    const qb = this.sucursalRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.municipio', 'm')
      .leftJoinAndSelect('m.departamento', 'dep');

    if (filterDto.search?.trim()) {
      const term = `%${filterDto.search.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(s.nombre) LIKE :term OR LOWER(s.direccion) LIKE :term)', {
        term,
      });
    }

    if (filterDto.tipoSucursal) {
      qb.andWhere('s.tipoSucursal = :tipoSucursal', {
        tipoSucursal: filterDto.tipoSucursal,
      });
    }

    if (filterDto.estado) {
      qb.andWhere('s.estado = :estado', { estado: filterDto.estado });
    }

    qb.orderBy('s.sucursalId', 'ASC');

    const page = Number(filterDto.page) || 1;
    const limit = Number(filterDto.limit) || 20;
    const skip = (page - 1) * limit;

    qb.skip(skip).take(limit);

    const [sucursales, total] = await qb.getManyAndCount();

    const data = sucursales.map((s) => ({
      sucursalId: s.sucursalId,
      nombre: s.nombre,
      tipoSucursal: s.tipoSucursal,
      direccion: s.direccion,
      telefono: s.telefono,
      latitud: s.latitud ? Number(s.latitud) : null,
      longitud: s.longitud ? Number(s.longitud) : null,
      fechaApertura: s.fechaApertura,
      estado: s.estado,
      municipio: s.municipio
        ? {
            municipioId: s.municipio.municipioId,
            nombre: s.municipio.nombre,
            departamento: s.municipio.departamento?.nombre,
          }
        : null,
    }));

    // KPIs agregados
    const [totalKpi, bodegasKpi, farmaciasKpi, standsKpi] = await Promise.all([
      this.sucursalRepo.count(),
      this.sucursalRepo.count({ where: { tipoSucursal: 'BODEGA_CENTRAL' } }),
      this.sucursalRepo.count({ where: { tipoSucursal: 'FARMACIA' } }),
      this.sucursalRepo.count({ where: { tipoSucursal: 'STAND' } }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      kpis: {
        total: totalKpi,
        bodegas: bodegasKpi,
        farmacias: farmaciasKpi,
        stands: standsKpi,
      },
    };
  }

  /**
   * Lista ligera de sucursales para combos / dropdowns
   */
  async findAllList() {
    const sucursales = await this.sucursalRepo.find({
      where: { estado: 'ACTIVA' },
      order: { sucursalId: 'ASC' },
      select: {
        sucursalId: true,
        nombre: true,
        tipoSucursal: true,
        direccion: true,
        telefono: true,
      },
    });

    return sucursales.map((s) => ({
      sucursalId: s.sucursalId,
      nombre: s.nombre,
      tipoSucursal: s.tipoSucursal,
      direccion: s.direccion,
      telefono: s.telefono,
      esBodegaCentral: s.tipoSucursal === 'BODEGA_CENTRAL',
    }));
  }

  /**
   * Detalle de una sucursal por ID
   */
  async findOne(id: number) {
    const sucursal = await this.sucursalRepo.findOne({
      where: { sucursalId: id },
      relations: {
        municipio: {
          departamento: true,
        },
      },
    });

    if (!sucursal) {
      throw new NotFoundException(`Sucursal con ID #${id} no encontrada`);
    }

    return sucursal;
  }

  /**
   * Crear nueva sucursal
   */
  async create(dto: CreateSucursalDto) {
    const existe = await this.sucursalRepo.findOne({
      where: { nombre: dto.nombre.trim() },
    });

    if (existe) {
      throw new ConflictException(
        `Ya existe una sucursal registrada con el nombre "${dto.nombre}".`,
      );
    }

    const nueva = this.sucursalRepo.create({
      nombre: dto.nombre.trim(),
      tipoSucursal: dto.tipoSucursal,
      direccion: dto.direccion.trim(),
      telefono: dto.telefono?.trim() || null,
      latitud: dto.latitud !== undefined ? Number(dto.latitud) : null,
      longitud: dto.longitud !== undefined ? Number(dto.longitud) : null,
      estado: dto.estado || 'ACTIVA',
      municipio: { municipioId: dto.municipioId ? Number(dto.municipioId) : 1 } as any,
    });

    const guardada = await this.sucursalRepo.save(nueva);
    this.logger.log(`Sucursal creada exitosamente: ${guardada.nombre} (ID: ${guardada.sucursalId})`);
    return guardada;
  }

  /**
   * Actualizar sucursal existente
   */
  async update(id: number, dto: UpdateSucursalDto) {
    const sucursal = await this.findOne(id);

    if (dto.nombre && dto.nombre.trim() !== sucursal.nombre) {
      const existe = await this.sucursalRepo.findOne({
        where: { nombre: dto.nombre.trim() },
      });
      if (existe && existe.sucursalId !== id) {
        throw new ConflictException(
          `Ya existe otra sucursal registrada con el nombre "${dto.nombre}".`,
        );
      }
      sucursal.nombre = dto.nombre.trim();
    }

    if (dto.tipoSucursal) sucursal.tipoSucursal = dto.tipoSucursal;
    if (dto.direccion) sucursal.direccion = dto.direccion.trim();
    if (dto.telefono !== undefined) sucursal.telefono = dto.telefono?.trim() || null;
    if (dto.latitud !== undefined) sucursal.latitud = Number(dto.latitud);
    if (dto.longitud !== undefined) sucursal.longitud = Number(dto.longitud);
    if (dto.estado) sucursal.estado = dto.estado;
    if (dto.municipioId !== undefined) {
      sucursal.municipio = dto.municipioId ? ({ municipioId: dto.municipioId } as any) : null;
    }

    return this.sucursalRepo.save(sucursal);
  }
}

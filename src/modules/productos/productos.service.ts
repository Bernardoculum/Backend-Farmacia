import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Producto } from '../../database/entities/Producto';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { FilterProductoDto } from './dto/filter-producto.dto';
import { ProductoMapper } from './mappers/producto.mapper';

@Injectable()
export class ProductosService {
  private readonly logger = new Logger(ProductosService.name);

  constructor(
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
  ) {}

  // Listar productos con filtros dinámicos y paginación
  async findAll(filterDto: FilterProductoDto) {
    const {
      search,
      categoriaId,
      laboratorioId,
      requiereReceta,
      estado = 'ACTIVO',
      sucursalId,
      page = 1,
      limit = 20,
    } = filterDto;

    const query = this.productoRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.categoria', 'cat')
      .leftJoinAndSelect('p.laboratorio', 'lab')
      .leftJoinAndSelect('p.unidadMedida', 'um')
      .leftJoinAndSelect('p.lotes', 'lote')
      .leftJoinAndSelect('lote.inventarios', 'inv')
      .leftJoinAndSelect('inv.sucursal', 'suc');

    if (estado) {
      query.andWhere('p.estado = :estado', { estado });
    }

    if (categoriaId) {
      query.andWhere('cat.categoriaId = :categoriaId', { categoriaId });
    }

    if (laboratorioId) {
      query.andWhere('lab.laboratorioId = :laboratorioId', { laboratorioId });
    }

    const receta = requiereReceta || filterDto.conReceta;
    if (receta) {
      query.andWhere('p.requiereReceta = :receta', { receta });
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query.andWhere(
        '(LOWER(p.nombre) LIKE :term OR LOWER(p.codigoProducto) LIKE :term OR LOWER(p.principioActivo) LIKE :term)',
        { term },
      );
    }

    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);
    query.orderBy('p.nombre', 'ASC');

    const [productos, total] = await query.getManyAndCount();

    // Mapeo limpio y desacoplado mediante ProductoMapper (aislando por sucursal si corresponde)
    const data = productos.map((p) => ProductoMapper.toListItem(p, sucursalId));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Obtener detalle de un producto por ID
  async findOne(id: number) {
    const prod = await this.productoRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.categoria', 'cat')
      .leftJoinAndSelect('p.laboratorio', 'lab')
      .leftJoinAndSelect('p.unidadMedida', 'um')
      .leftJoinAndSelect('p.lotes', 'lote')
      .leftJoinAndSelect('lote.inventarios', 'inv')
      .leftJoinAndSelect('inv.sucursal', 'suc')
      .where('p.productoId = :id', { id })
      .getOne();

    if (!prod) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    return ProductoMapper.toDetailItem(prod);
  }

  // Crear un nuevo medicamento
  async create(createDto: CreateProductoDto) {
    let codigo = createDto.codigoProducto?.trim();

    if (!codigo) {
      const count = await this.productoRepo.count();
      codigo = `MED-${String(count + 1).padStart(4, '0')}`;
    }

    const existe = await this.productoRepo.findOne({
      where: { codigoProducto: codigo },
    });

    if (existe) {
      throw new ConflictException(
        `Ya existe un producto con el código "${codigo}"`,
      );
    }

    const nuevo = this.productoRepo.create({
      codigoProducto: codigo,
      nombre: createDto.nombre.trim(),
      precioVenta: createDto.precioVenta,
      porcentajeIva: createDto.porcentajeIva ?? 12,
      principioActivo: createDto.principioActivo?.trim() || null,
      presentacion: createDto.presentacion?.trim() || null,
      concentracion: createDto.concentracion?.trim() || null,
      requiereReceta: createDto.requiereReceta || 'N',
      estado: 'ACTIVO',
      categoria: { categoriaId: createDto.categoriaId } as any,
      laboratorio: { laboratorioId: createDto.laboratorioId } as any,
      unidadMedida: { unidadMedidaId: createDto.unidadMedidaId } as any,
    });

    const guardado = await this.productoRepo.save(nuevo);
    this.logger.log(`Producto registrado: ${guardado.nombre} (ID: ${guardado.productoId}, Código: ${guardado.codigoProducto})`);
    return this.findOne(guardado.productoId);
  }

  // Actualizar datos del producto
  async update(id: number, updateDto: UpdateProductoDto) {
    const prod = await this.productoRepo.findOne({ where: { productoId: id } });
    if (!prod) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    if (updateDto.codigoProducto && updateDto.codigoProducto !== prod.codigoProducto) {
      const existe = await this.productoRepo.findOne({
        where: { codigoProducto: updateDto.codigoProducto.trim() },
      });
      if (existe) {
        throw new ConflictException(
          `El código "${updateDto.codigoProducto}" ya está en uso por otro producto`,
        );
      }
      prod.codigoProducto = updateDto.codigoProducto.trim();
    }

    if (updateDto.nombre) prod.nombre = updateDto.nombre.trim();
    if (updateDto.precioVenta !== undefined) prod.precioVenta = updateDto.precioVenta;
    if (updateDto.porcentajeIva !== undefined) prod.porcentajeIva = updateDto.porcentajeIva;
    if (updateDto.principioActivo !== undefined) prod.principioActivo = updateDto.principioActivo;
    if (updateDto.presentacion !== undefined) prod.presentacion = updateDto.presentacion;
    if (updateDto.concentracion !== undefined) prod.concentracion = updateDto.concentracion;
    if (updateDto.requiereReceta !== undefined) prod.requiereReceta = updateDto.requiereReceta;
    if (updateDto.estado !== undefined) prod.estado = updateDto.estado;

    if (updateDto.categoriaId) {
      prod.categoria = { categoriaId: updateDto.categoriaId } as any;
    }
    if (updateDto.laboratorioId) {
      prod.laboratorio = { laboratorioId: updateDto.laboratorioId } as any;
    }
    if (updateDto.unidadMedidaId) {
      prod.unidadMedida = { unidadMedidaId: updateDto.unidadMedidaId } as any;
    }

    await this.productoRepo.save(prod);
    return this.findOne(id);
  }

  // Desactivación lógica
  async remove(id: number) {
    const prod = await this.productoRepo.findOne({ where: { productoId: id } });
    if (!prod) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }
    prod.estado = 'INACTIVO';
    await this.productoRepo.save(prod);
    return { message: `Producto "${prod.nombre}" desactivado correctamente` };
  }
}

import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Lote } from '../../database/entities/Lote';
import { Producto } from '../../database/entities/Producto';
import { Inventario } from '../../database/entities/Inventario';
import { MovimientoInventario } from '../../database/entities/MovimientoInventario';
import { CreateLoteDto } from './dto/create-lote.dto';
import { UpdateLoteDto } from './dto/update-lote.dto';
import { FilterLoteDto } from './dto/filter-lote.dto';

@Injectable()
export class LotesService {
  private readonly logger = new Logger(LotesService.name);

  constructor(
    @InjectRepository(Lote)
    private readonly loteRepo: Repository<Lote>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(Inventario)
    private readonly inventarioRepo: Repository<Inventario>,
    @InjectRepository(MovimientoInventario)
    private readonly movimientoRepo: Repository<MovimientoInventario>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Listado de todos los lotes con cálculo dinámico de caducidad y existencias
   */
  async findAll(filterDto: FilterLoteDto) {
    const qb = this.loteRepo
      .createQueryBuilder('l')
      .innerJoinAndSelect('l.producto', 'p')
      .leftJoinAndSelect('l.inventarios', 'inv')
      .leftJoinAndSelect('inv.sucursal', 'suc');

    if (filterDto.search?.trim()) {
      const term = `%${filterDto.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(l.numeroLote) LIKE :term OR LOWER(p.nombre) LIKE :term OR LOWER(p.codigoProducto) LIKE :term)',
        { term },
      );
    }

    if (filterDto.productoId) {
      qb.andWhere('l.productoId = :productoId', {
        productoId: filterDto.productoId,
      });
    }

    qb.orderBy('l.fechaVencimiento', 'ASC');

    const lotes = await qb.getMany();
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const resultado = lotes.map((lote) => {
      const fechaVenc = new Date(lote.fechaVencimiento);
      fechaVenc.setHours(0, 0, 0, 0);

      const diffTime = fechaVenc.getTime() - hoy.getTime();
      const diasParaVencer = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let estadoVencimiento: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO';
      if (diasParaVencer < 0) {
        estadoVencimiento = 'VENCIDO';
      } else if (diasParaVencer <= 90) {
        estadoVencimiento = 'POR_VENCER';
      } else {
        estadoVencimiento = 'VIGENTE';
      }

      let stockTotalLote = 0;
      const inventariosDesglose = (lote.inventarios || []).map((inv) => {
        const disp = Number(inv.cantidadDisponible) || 0;
        stockTotalLote += disp;
        return {
          inventarioId: inv.inventarioId,
          sucursalId: inv.sucursalId,
          sucursal: inv.sucursal?.nombre || `Sucursal ${inv.sucursalId}`,
          disponible: disp,
          reservado: Number(inv.cantidadReservada) || 0,
        };
      });

      return {
        loteId: lote.loteId,
        numeroLote: lote.numeroLote,
        fechaVencimiento: lote.fechaVencimiento,
        fechaFabricacion: lote.fechaFabricacion,
        costoUnitario: Number(lote.costoUnitario),
        diasParaVencer,
        estadoVencimiento,
        producto: {
          productoId: lote.producto.productoId,
          codigoProducto: lote.producto.codigoProducto,
          nombre: lote.producto.nombre,
          principioActivo: lote.producto.principioActivo,
          presentacion: lote.producto.presentacion,
          concentracion: lote.producto.concentracion,
          precioVenta: Number(lote.producto.precioVenta),
          requiereReceta: lote.producto.requiereReceta,
        },
        stockTotalLote,
        inventarios: inventariosDesglose,
      };
    });

    // Filtro semafórico opcional
    if (
      filterDto.estadoVencimiento &&
      filterDto.estadoVencimiento !== 'TODOS'
    ) {
      return resultado.filter(
        (l) => l.estadoVencimiento === filterDto.estadoVencimiento,
      );
    }

    return resultado;
  }

  /**
   * Detalle de un lote específico
   */
  async findOne(id: number) {
    const lote = await this.loteRepo.findOne({
      where: { loteId: id },
      relations: {
        producto: true,
        inventarios: {
          sucursal: true,
        },
      },
    });

    if (!lote) {
      throw new NotFoundException(`Lote con ID ${id} no encontrado`);
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaVenc = new Date(lote.fechaVencimiento);
    fechaVenc.setHours(0, 0, 0, 0);

    const diffTime = fechaVenc.getTime() - hoy.getTime();
    const diasParaVencer = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let estadoVencimiento: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO';
    if (diasParaVencer < 0) {
      estadoVencimiento = 'VENCIDO';
    } else if (diasParaVencer <= 90) {
      estadoVencimiento = 'POR_VENCER';
    } else {
      estadoVencimiento = 'VIGENTE';
    }

    let stockTotalLote = 0;
    const inventarios = (lote.inventarios || []).map((inv) => {
      const disp = Number(inv.cantidadDisponible) || 0;
      stockTotalLote += disp;
      return {
        inventarioId: inv.inventarioId,
        sucursalId: inv.sucursalId,
        sucursal: inv.sucursal?.nombre,
        disponible: disp,
        reservado: Number(inv.cantidadReservada) || 0,
      };
    });

    return {
      loteId: lote.loteId,
      numeroLote: lote.numeroLote,
      fechaVencimiento: lote.fechaVencimiento,
      fechaFabricacion: lote.fechaFabricacion,
      costoUnitario: Number(lote.costoUnitario),
      diasParaVencer,
      estadoVencimiento,
      producto: lote.producto,
      stockTotalLote,
      inventarios,
    };
  }

  /**
   * Creación transaccional de un nuevo Lote (con stock inicial opcional en Kardex)
   */
  async create(dto: CreateLoteDto) {
    return this.dataSource.transaction(async (manager) => {
      // 1. Validar que el producto exista
      const producto = await manager.findOne(Producto, {
        where: { productoId: dto.productoId },
      });
      if (!producto) {
        throw new NotFoundException(
          `Producto con ID ${dto.productoId} no encontrado`,
        );
      }

      // 2. Validar que el número de lote no exista ya para este producto
      const loteExistente = await manager.findOne(Lote, {
        where: {
          productoId: dto.productoId,
          numeroLote: dto.numeroLote.trim(),
        },
      });

      if (loteExistente) {
        throw new ConflictException(
          `El lote "${dto.numeroLote}" ya se encuentra registrado para el producto "${producto.nombre}"`,
        );
      }

      // 3. Crear y persistir el lote
      const nuevoLote = manager.create(Lote, {
        productoId: dto.productoId,
        numeroLote: dto.numeroLote.trim(),
        fechaVencimiento: new Date(dto.fechaVencimiento),
        fechaFabricacion: dto.fechaFabricacion
          ? new Date(dto.fechaFabricacion)
          : null,
        costoUnitario: dto.costoUnitario,
      });

      const loteGuardado = await manager.save(nuevoLote);
      this.logger.log(
        `Lote creado: ${loteGuardado.numeroLote} para producto: ${producto.nombre} (ID: ${loteGuardado.loteId})`,
      );

      // 4. Si se especificó stock inicial y sucursal, asentar en Inventario y Kardex
      let stockAsignado = 0;
      if (dto.sucursalId && dto.stockInicial && dto.stockInicial > 0) {
        stockAsignado = Number(dto.stockInicial);

        const inventario = manager.create(Inventario, {
          sucursalId: dto.sucursalId,
          loteId: loteGuardado.loteId,
          cantidadDisponible: stockAsignado,
          cantidadReservada: 0,
          stockMinimo: 0,
          fechaActualizacion: new Date(),
        });

        const inventarioGuardado = await manager.save(inventario);

        // Registro de Kardex
        const movimiento = manager.create(MovimientoInventario, {
          inventario: inventarioGuardado,
          tipoMovimiento: 'ENTRADA',
          cantidad: stockAsignado,
          cantidadAnterior: 0,
          cantidadNueva: stockAsignado,
          referenciaTipo: 'INGRESO_LOTE_NUEVO',
          referenciaId: loteGuardado.loteId,
          observacion: `Ingreso inicial al crear lote ${loteGuardado.numeroLote}`,
          fechaMovimiento: new Date(),
        });

        await manager.save(movimiento);
        this.logger.log(
          `Stock inicial asignado: ${stockAsignado} unidades en sucursal ${dto.sucursalId} con asiento en Kardex`,
        );
      }

      return {
        mensaje: 'Lote registrado exitosamente',
        loteId: loteGuardado.loteId,
        numeroLote: loteGuardado.numeroLote,
        producto: producto.nombre,
        fechaVencimiento: loteGuardado.fechaVencimiento,
        costoUnitario: loteGuardado.costoUnitario,
        stockInicial: stockAsignado,
      };
    });
  }

  /**
   * Actualizar fecha de vencimiento o costo de un lote
   */
  async update(id: number, dto: UpdateLoteDto) {
    const lote = await this.loteRepo.findOne({ where: { loteId: id } });
    if (!lote) {
      throw new NotFoundException(`Lote con ID ${id} no encontrado`);
    }

    if (dto.fechaVencimiento) {
      lote.fechaVencimiento = new Date(dto.fechaVencimiento);
    }
    if (dto.costoUnitario !== undefined) {
      lote.costoUnitario = dto.costoUnitario;
    }

    await this.loteRepo.save(lote);
    return {
      mensaje: 'Lote actualizado exitosamente',
      loteId: lote.loteId,
      numeroLote: lote.numeroLote,
      fechaVencimiento: lote.fechaVencimiento,
      costoUnitario: lote.costoUnitario,
    };
  }
}

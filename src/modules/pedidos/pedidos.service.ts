import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Pedido } from '../../database/entities/Pedido';
import { PedidoDetalle } from '../../database/entities/PedidoDetalle';
import { Entrega } from '../../database/entities/Entrega';
import { Cliente } from '../../database/entities/Cliente';
import { MetodoPago } from '../../database/entities/MetodoPago';
import { Sucursal } from '../../database/entities/Sucursal';
import { Producto } from '../../database/entities/Producto';
import { Lote } from '../../database/entities/Lote';
import { Inventario } from '../../database/entities/Inventario';
import { MovimientoInventario } from '../../database/entities/MovimientoInventario';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateEstadoPedidoDto } from './dto/update-estado-pedido.dto';
import { FilterPedidoDto } from './dto/filter-pedido.dto';
import { EvaluarDespachoDto } from './dto/evaluar-despacho.dto';

@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);

  constructor(
    @InjectRepository(Pedido)
    private readonly pedidoRepo: Repository<Pedido>,
    @InjectRepository(PedidoDetalle)
    private readonly detalleRepo: Repository<PedidoDetalle>,
    @InjectRepository(Entrega)
    private readonly entregaRepo: Repository<Entrega>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(MetodoPago)
    private readonly metodoPagoRepo: Repository<MetodoPago>,
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(Lote)
    private readonly loteRepo: Repository<Lote>,
    @InjectRepository(Inventario)
    private readonly inventarioRepo: Repository<Inventario>,
    @InjectRepository(MovimientoInventario)
    private readonly movimientoRepo: Repository<MovimientoInventario>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Registro Transaccional de Venta / Pedido (POS o Call Center)
   * Aplica regla FEFO automática y salida de Kardex en inventario.
   */
  async crearPedido(dto: CreatePedidoDto) {
    if (!dto.detalles || dto.detalles.length === 0) {
      throw new BadRequestException('El pedido debe incluir al menos un medicamento');
    }

    return this.dataSource.transaction(async (manager) => {
      // 1. Validar Sucursal
      const sucursal = await manager.findOne(Sucursal, {
        where: { sucursalId: dto.sucursalId },
      });
      if (!sucursal) {
        throw new NotFoundException(`Sucursal con ID ${dto.sucursalId} no encontrada`);
      }

      // 2. Validar Método de Pago
      const metodoPago = await manager.findOne(MetodoPago, {
        where: { metodoPagoId: dto.metodoPagoId },
      });
      if (!metodoPago) {
        throw new NotFoundException(`Método de pago con ID ${dto.metodoPagoId} no encontrado`);
      }

      // 3. Resolver Cliente
      let cliente: Cliente;
      if (dto.clienteId) {
        const cli = await manager.findOne(Cliente, { where: { clienteId: dto.clienteId } });
        if (!cli) throw new NotFoundException(`Cliente con ID ${dto.clienteId} no encontrado`);
        cliente = cli;
      } else if (dto.origen === 'CALL_CENTER' && dto.datosEntrega?.telefonoContacto) {
        // Buscar por teléfono en Call Center
        const tel = dto.datosEntrega.telefonoContacto.trim();
        let cli = await manager.findOne(Cliente, { where: { telefono: tel } });
        if (!cli) {
          cli = manager.create(Cliente, {
            nombre: dto.datosEntrega.personaRecibe?.trim() || 'Cliente Call Center',
            telefono: tel,
            direccion: dto.datosEntrega.direccionEntrega.trim(),
            referenciaDireccion: dto.datosEntrega.observacionEntrega || null,
            estado: 'ACTIVO',
          });
          cli = await manager.save(cli);
        }
        cliente = cli;
      } else {
        // En mostrador: Consumidor Final (ID 6 o primer cliente existente)
        let cf = await manager.findOne(Cliente, { where: { clienteId: 6 } });
        if (!cf) {
          cf = await manager.findOne(Cliente, { order: { clienteId: 'ASC' } });
        }
        cliente = cf!;
      }

      // 4. Procesar Medicamentos y Aplicar Regla FEFO
      let totalPedido = 0;
      const itemsPreparados: {
        producto: Producto;
        lote: Lote;
        cantidad: number;
        precioUnitario: number;
        subtotal: number;
      }[] = [];

      for (const item of dto.detalles) {
        const producto = await manager.findOne(Producto, {
          where: { productoId: item.productoId },
        });
        if (!producto) {
          throw new NotFoundException(`Medicamento con ID ${item.productoId} no encontrado`);
        }

        let loteSeleccionado: Lote | null = null;
        let inventarioLote: Inventario | null = null;

        if (item.loteId) {
          // Lote explícito
          loteSeleccionado = await manager.findOne(Lote, { where: { loteId: item.loteId } });
          if (!loteSeleccionado) {
            throw new NotFoundException(`Lote con ID ${item.loteId} no encontrado`);
          }
          inventarioLote = await manager.findOne(Inventario, {
            where: { loteId: loteSeleccionado.loteId, sucursalId: dto.sucursalId },
          });
        } else {
          // Regla FEFO: Buscar lote vigente que vence primero con stock en esa sucursal
          const qb = manager
            .createQueryBuilder(Inventario, 'inv')
            .innerJoinAndSelect('inv.lote', 'lote')
            .where('inv.sucursalId = :sucursalId', { sucursalId: dto.sucursalId })
            .andWhere('lote.productoId = :productoId', { productoId: item.productoId })
            .andWhere('inv.cantidadDisponible >= :cant', { cant: item.cantidad })
            .orderBy('lote.fechaVencimiento', 'ASC');

          inventarioLote = await qb.getOne();

          if (!inventarioLote) {
            // Intentar con cualquier lote disponible
            const qbFallback = manager
              .createQueryBuilder(Inventario, 'inv')
              .innerJoinAndSelect('inv.lote', 'lote')
              .where('inv.sucursalId = :sucursalId', { sucursalId: dto.sucursalId })
              .andWhere('lote.productoId = :productoId', { productoId: item.productoId })
              .andWhere('inv.cantidadDisponible > 0')
              .orderBy('lote.fechaVencimiento', 'ASC');

            inventarioLote = await qbFallback.getOne();
          }

          if (inventarioLote) {
            loteSeleccionado = inventarioLote.lote;
          }
        }

        if (!loteSeleccionado || !inventarioLote) {
          throw new BadRequestException(
            `No hay inventario disponible en la sucursal "${sucursal.nombre}" para el medicamento "${producto.nombre}".`,
          );
        }

        const disponibleActual = Number(inventarioLote.cantidadDisponible) || 0;
        if (disponibleActual < item.cantidad) {
          throw new BadRequestException(
            `Stock insuficiente en ${sucursal.nombre} para "${producto.nombre}" (Lote: ${loteSeleccionado.numeroLote}). Disponible: ${disponibleActual}, Solicitado: ${item.cantidad}`,
          );
        }

        // Descontar inventario
        const nuevoDisponible = disponibleActual - item.cantidad;
        inventarioLote.cantidadDisponible = nuevoDisponible;
        inventarioLote.fechaActualizacion = new Date();
        await manager.save(inventarioLote);

        // Asentar salida en Kardex
        const movimientoKardex = manager.create(MovimientoInventario, {
          inventario: inventarioLote,
          tipoMovimiento: 'SALIDA',
          cantidad: item.cantidad,
          cantidadAnterior: disponibleActual,
          cantidadNueva: nuevoDisponible,
          referenciaTipo: 'VENTA_PEDIDO',
          observacion: `Venta ${dto.origen} | Sucursal: ${sucursal.nombre}`,
          fechaMovimiento: new Date(),
        });
        await manager.save(movimientoKardex);

        const precio = Number(producto.precioVenta);
        const subtotal = precio * item.cantidad;
        totalPedido += subtotal;

        itemsPreparados.push({
          producto,
          lote: loteSeleccionado,
          cantidad: item.cantidad,
          precioUnitario: precio,
          subtotal,
        });
      }

      // 5. Crear Cabecera del Pedido
      const nuevoPedido = manager.create(Pedido, {
        origen: dto.origen === 'MOSTRADOR' ? 'SUCURSAL' : dto.origen,
        total: totalPedido,
        observacion: dto.observacion || null,
        cliente,
        metodoPago,
        sucursalPreparacion: sucursal,
        estado: dto.origen === 'MOSTRADOR' ? 'CONFIRMADO' : 'RECIBIDO',
        fechaPedido: new Date(),
        fechaConfirmacion: dto.origen === 'MOSTRADOR' ? new Date() : null,
      });

      const pedidoGuardado = await manager.save(nuevoPedido);

      // 6. Guardar Detalles
      for (const it of itemsPreparados) {
        const detalle = manager.create(PedidoDetalle, {
          pedido: pedidoGuardado,
          producto: it.producto,
          lote: it.lote,
          cantidad: it.cantidad,
          precioUnitario: it.precioUnitario,
          subtotal: it.subtotal,
        });
        await manager.save(detalle);
      }

      // 7. Si es Call Center, Portal Web o Teléfono, crear Entrega a Domicilio
      let entregaGuardada: Entrega | null = null;
      if (dto.origen === 'CALL_CENTER' || dto.origen === 'PORTAL' || dto.origen === 'TELEFONO') {
        const entrega = manager.create(Entrega, {
          pedido: pedidoGuardado,
          sucursal,
          personaRecibe: dto.datosEntrega?.personaRecibe || `${cliente.nombre} ${cliente.apellido || ''}`.trim(),
          fechaProgramada: dto.datosEntrega?.fechaProgramada ? new Date(dto.datosEntrega.fechaProgramada) : new Date(),
          observacion: dto.datosEntrega?.observacionEntrega || `Dirección: ${dto.datosEntrega?.direccionEntrega || cliente.direccion}`,
          estado: 'PENDIENTE',
        });
        entregaGuardada = await manager.save(entrega);
      }

      this.logger.log(
        `Pedido #${pedidoGuardado.pedidoId} creado exitosamente [${dto.origen}]. Total: Q ${totalPedido} | Sucursal: ${sucursal.nombre}`,
      );

      return {
        mensaje: dto.origen === 'MOSTRADOR' ? 'Venta procesada exitosamente' : 'Pedido de Call Center generado',
        pedidoId: pedidoGuardado.pedidoId,
        origen: pedidoGuardado.origen,
        total: totalPedido,
        cliente: `${cliente.nombre} ${cliente.apellido || ''}`.trim(),
        sucursal: sucursal.nombre,
        metodoPago: metodoPago.nombre,
        estado: pedidoGuardado.estado,
        fechaPedido: pedidoGuardado.fechaPedido,
        entrega: entregaGuardada
          ? {
              entregaId: entregaGuardada.entregaId,
              personaRecibe: entregaGuardada.personaRecibe,
              estado: entregaGuardada.estado,
              fechaProgramada: entregaGuardada.fechaProgramada,
            }
          : null,
        detalles: itemsPreparados.map((it) => ({
          medicamento: it.producto.nombre,
          lote: it.lote.numeroLote,
          vence: it.lote.fechaVencimiento,
          cantidad: it.cantidad,
          precioUnitario: it.precioUnitario,
          subtotal: it.subtotal,
        })),
      };
    });
  }

  /**
   * Listar pedidos con filtros (origen, sucursal, estado, búsqueda)
   */
  async findAll(filterDto: FilterPedidoDto) {
    const qb = this.pedidoRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.cliente', 'c')
      .innerJoinAndSelect('p.metodoPago', 'mp')
      .innerJoinAndSelect('p.sucursalPreparacion', 'suc')
      .leftJoinAndSelect('p.pedidoDetalles', 'det')
      .leftJoinAndSelect('det.producto', 'prod')
      .leftJoinAndSelect('det.lote', 'lote')
      .leftJoinAndSelect('p.entrega', 'ent');

    if (filterDto.origen) {
      qb.andWhere('p.origen = :origen', { origen: filterDto.origen });
    }

    if (filterDto.sucursalId) {
      qb.andWhere('p.sucursalPreparacion.sucursalId = :sucursalId', {
        sucursalId: filterDto.sucursalId,
      });
    }

    if (filterDto.estado) {
      qb.andWhere('p.estado = :estado', { estado: filterDto.estado });
    }

    if (filterDto.search?.trim()) {
      const term = `%${filterDto.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(c.nombre) LIKE :term OR LOWER(c.telefono) LIKE :term OR CAST(p.pedidoId AS VARCHAR2(20)) LIKE :term)',
        { term },
      );
    }

    qb.orderBy('p.fechaPedido', 'DESC');

    const [pedidos, total] = await qb
      .skip(((filterDto.page || 1) - 1) * (filterDto.limit || 20))
      .take(filterDto.limit || 20)
      .getManyAndCount();

    const mapped = pedidos.map((p) => ({
      pedidoId: p.pedidoId,
      origen: p.origen,
      total: Number(p.total),
      estado: p.estado,
      fechaPedido: p.fechaPedido,
      fechaConfirmacion: p.fechaConfirmacion,
      cliente: {
        clienteId: p.cliente?.clienteId,
        nombre: `${p.cliente?.nombre || ''} ${p.cliente?.apellido || ''}`.trim(),
        telefono: p.cliente?.telefono,
        direccion: p.cliente?.direccion,
      },
      sucursal: p.sucursalPreparacion?.nombre,
      sucursalId: p.sucursalPreparacion?.sucursalId,
      metodoPago: p.metodoPago?.nombre,
      entrega: p.entrega
        ? {
            entregaId: p.entrega.entregaId,
            estado: p.entrega.estado,
            personaRecibe: p.entrega.personaRecibe,
            fechaProgramada: p.entrega.fechaProgramada,
          }
        : null,
      totalItems: p.pedidoDetalles?.length || 0,
    }));

    return {
      data: mapped,
      total,
      page: Number(filterDto.page) || 1,
      limit: Number(filterDto.limit) || 20,
    };
  }

  /**
   * Consulta de un pedido específico con comprobante/ticket completo
   */
  async findOne(id: number) {
    const p = await this.pedidoRepo.findOne({
      where: { pedidoId: id },
      relations: {
        cliente: true,
        metodoPago: true,
        sucursalPreparacion: true,
        pedidoDetalles: {
          producto: true,
          lote: true,
        },
        entrega: true,
      },
    });

    if (!p) {
      throw new NotFoundException(`Pedido #${id} no encontrado`);
    }

    const subtotalBruto = Number(p.total) / 1.12;
    const ivaCalculado = Number(p.total) - subtotalBruto;

    return {
      pedidoId: p.pedidoId,
      origen: p.origen,
      total: Number(p.total),
      subtotalSinIva: Number(subtotalBruto.toFixed(2)),
      iva: Number(ivaCalculado.toFixed(2)),
      estado: p.estado,
      observacion: p.observacion,
      fechaPedido: p.fechaPedido,
      fechaConfirmacion: p.fechaConfirmacion,
      cliente: {
        clienteId: p.cliente.clienteId,
        nombre: `${p.cliente.nombre} ${p.cliente.apellido || ''}`.trim(),
        telefono: p.cliente.telefono,
        direccion: p.cliente.direccion,
      },
      sucursal: {
        sucursalId: p.sucursalPreparacion.sucursalId,
        nombre: p.sucursalPreparacion.nombre,
        direccion: p.sucursalPreparacion.direccion,
        telefono: p.sucursalPreparacion.telefono,
      },
      metodoPago: p.metodoPago.nombre,
      entrega: p.entrega
        ? {
            entregaId: p.entrega.entregaId,
            estado: p.entrega.estado,
            personaRecibe: p.entrega.personaRecibe,
            fechaProgramada: p.entrega.fechaProgramada,
            fechaSalida: p.entrega.fechaSalida,
            fechaEntrega: p.entrega.fechaEntrega,
            observacion: p.entrega.observacion,
          }
        : null,
      detalles: (p.pedidoDetalles || []).map((d) => ({
        detalleId: d.pedidoDetalleId,
        codigoProducto: d.producto?.codigoProducto,
        nombre: d.producto?.nombre,
        presentacion: d.producto?.presentacion,
        numeroLote: d.lote?.numeroLote,
        fechaVencimiento: d.lote?.fechaVencimiento,
        cantidad: Number(d.cantidad),
        precioUnitario: Number(d.precioUnitario),
        subtotal: Number(d.subtotal),
      })),
    };
  }

  /**
   * Actualizar estado del pedido o entrega
   */
  async actualizarEstado(id: number, dto: UpdateEstadoPedidoDto) {
    return this.dataSource.transaction(async (manager) => {
      const pedido = await manager.findOne(Pedido, {
        where: { pedidoId: id },
        relations: {
          entrega: true,
          sucursalPreparacion: true,
          pedidoDetalles: {
            producto: true,
            lote: true,
          },
        },
      });

      if (!pedido) {
        throw new NotFoundException(`Pedido #${id} no encontrado`);
      }

      const estadoAnterior = pedido.estado;
      let estadoPedido = dto.estado;
      let estadoEntrega: string | null = null;

      if (dto.estado === 'EN_CAMINO' || dto.estado === 'EN_ENTREGA') {
        estadoPedido = 'EN_ENTREGA';
        estadoEntrega = 'EN_RUTA';
      } else if (dto.estado === 'ENTREGADO' || dto.estado === 'ENTREGADA') {
        estadoPedido = 'ENTREGADO';
        estadoEntrega = 'ENTREGADA';
      } else if (dto.estado === 'CONFIRMADO') {
        estadoPedido = 'CONFIRMADO';
        estadoEntrega = 'PROGRAMADA';
      } else if (dto.estado === 'CANCELADO') {
        estadoPedido = 'CANCELADO';
        estadoEntrega = 'CANCELADA';
      }

      // Si el pedido pasa a CANCELADO y no estaba previamente cancelado, reintegrar stock al inventario
      if (estadoPedido === 'CANCELADO' && estadoAnterior !== 'CANCELADO') {
        const sucursalId = pedido.sucursalPreparacion?.sucursalId;
        for (const det of pedido.pedidoDetalles || []) {
          const loteId = det.lote?.loteId;
          const cantidadReintegrar = Number(det.cantidad) || 0;

          if (loteId && sucursalId && cantidadReintegrar > 0) {
            const inventario = await manager.findOne(Inventario, {
              where: { loteId, sucursalId },
            });

            if (inventario) {
              const disponibleAnterior = Number(inventario.cantidadDisponible) || 0;
              const nuevoDisponible = disponibleAnterior + cantidadReintegrar;

              inventario.cantidadDisponible = nuevoDisponible;
              inventario.fechaActualizacion = new Date();
              await manager.save(inventario);

              // Registrar movimiento de Kardex (ENTRADA por reversión/anulación)
              const movimientoKardex = manager.create(MovimientoInventario, {
                inventario,
                tipoMovimiento: 'ENTRADA',
                cantidad: cantidadReintegrar,
                cantidadAnterior: disponibleAnterior,
                cantidadNueva: nuevoDisponible,
                referenciaTipo: 'ANULACION_PEDIDO',
                referenciaId: pedido.pedidoId,
                observacion: `Reversión por cancelación de Pedido #${pedido.pedidoId} (${det.producto?.nombre || 'Medicamento'})`,
                fechaMovimiento: new Date(),
              });
              await manager.save(movimientoKardex);
            }
          }
        }
        this.logger.log(
          `Pedido #${id} cancelado: inventario reintegrado al stock de la sucursal y asentado en Kardex.`,
        );
      }

      pedido.estado = estadoPedido;
      if (estadoPedido === 'CONFIRMADO' && !pedido.fechaConfirmacion) {
        pedido.fechaConfirmacion = new Date();
      }
      await manager.save(pedido);

      // Si tiene entrega a domicilio, sincronizar
      if (pedido.entrega && estadoEntrega) {
        pedido.entrega.estado = estadoEntrega;
        if (estadoEntrega === 'EN_RUTA') {
          pedido.entrega.fechaSalida = new Date();
        } else if (estadoEntrega === 'ENTREGADA') {
          pedido.entrega.fechaEntrega = new Date();
        }
        if (dto.observacion) {
          pedido.entrega.observacion = dto.observacion;
        }
        await manager.save(pedido.entrega);
      }

      return {
        mensaje: `Estado de pedido #${id} actualizado a ${dto.estado}${estadoPedido === 'CANCELADO' ? ' (Inventario reintegrado)' : ''}`,
        pedidoId: pedido.pedidoId,
        nuevoEstado: pedido.estado,
      };
    });
  }

  /**
   * Buscar clientes por teléfono o nombre
   */
  async buscarClientes(termino: string) {
    if (!termino || termino.trim().length === 0) {
      return this.clienteRepo.find({ take: 10, order: { clienteId: 'ASC' } });
    }

    const term = `%${termino.trim().toLowerCase()}%`;
    return this.clienteRepo
      .createQueryBuilder('c')
      .where('(LOWER(c.nombre) LIKE :term OR LOWER(c.telefono) LIKE :term OR LOWER(c.apellido) LIKE :term)', { term })
      .take(15)
      .getMany();
  }

  /**
   * Crear cliente rápido
   */
  async crearCliente(dto: CreateClienteDto) {
    const clienteExistente = await this.clienteRepo.findOne({
      where: { telefono: dto.telefono.trim() },
    });

    if (clienteExistente) {
      return clienteExistente;
    }

    const nuevo = this.clienteRepo.create({
      nombre: dto.nombre.trim(),
      apellido: dto.apellido?.trim() || null,
      telefono: dto.telefono.trim(),
      direccion: dto.direccion.trim(),
      referenciaDireccion: dto.referenciaDireccion?.trim() || null,
      email: dto.email?.trim() || null,
      estado: 'ACTIVO',
    });

    return this.clienteRepo.save(nuevo);
  }

  /**
   * Obtener métodos de pago disponibles
   */
  async obtenerMetodosPago() {
    return this.metodoPagoRepo.find({
      where: { estado: 'ACTIVO' },
      order: { metodoPagoId: 'ASC' },
    });
  }

  /**
   * Evaluación Inteligente de Despacho para Call Center
   * Calcula distancias reales (Haversine con lat/lon Oracle), stock multisucursal en tiempo real y tiempo estimado de entrega (ETA).
   */
  async evaluarDespacho(dto: EvaluarDespachoDto) {
    let latDestino = dto.latitudDestino ? Number(dto.latitudDestino) : null;
    let lonDestino = dto.longitudDestino ? Number(dto.longitudDestino) : null;
    let direccionDestino = dto.direccionDestino || '';

    if (dto.clienteId) {
      const cli = await this.clienteRepo.findOne({ where: { clienteId: dto.clienteId } });
      if (cli) {
        if (!latDestino && cli.latitud) latDestino = Number(cli.latitud);
        if (!lonDestino && cli.longitud) lonDestino = Number(cli.longitud);
        if (!direccionDestino) direccionDestino = cli.direccion;
      }
    }

    // Coordenada predeterminada si no hay GPS (Zona 9 / 10 Ciudad de Guatemala)
    if (!latDestino || !lonDestino) {
      latDestino = 14.595;
      lonDestino = -90.518;
    }

    const sucursales = await this.sucursalRepo.find({
      where: { estado: 'ACTIVA' },
      order: { sucursalId: 'ASC' },
    });

    const resultadosSucursales: any[] = [];

    for (const suc of sucursales) {
      const sucLat = suc.latitud ? Number(suc.latitud) : 14.603;
      const sucLon = suc.longitud ? Number(suc.longitud) : -90.513;

      // Cálculo Haversine en kilómetros
      const R = 6371;
      const dLat = (sucLat - latDestino) * (Math.PI / 180);
      const dLon = (sucLon - lonDestino) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(latDestino * (Math.PI / 180)) *
        Math.cos(sucLat * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanciaKm = Number((R * c).toFixed(1));

      // Tiempo estimado (ETA): 15 min base preparación + 3.2 min por km en moto
      const tiempoEstimadoMinutos = Math.max(20, Math.round(15 + distanciaKm * 3.2));
      const rangoTiempo = `${tiempoEstimadoMinutos - 5} - ${tiempoEstimadoMinutos + 10} min`;

      // Verificar existencias de cada medicamento en esta sucursal
      let stockCompleto = true;
      const stockDetalle: any[] = [];

      for (const item of (dto.items || [])) {
        const invSum = await this.inventarioRepo
          .createQueryBuilder('inv')
          .innerJoin('inv.lote', 'lote')
          .where('inv.sucursalId = :sucId', { sucId: suc.sucursalId })
          .andWhere('lote.productoId = :prodId', { prodId: item.productoId })
          .select('SUM(inv.cantidadDisponible)', 'total')
          .getRawOne();

        const disponible = Number(invSum?.total) || 0;
        const suficiente = disponible >= item.cantidad;
        if (!suficiente) {
          stockCompleto = false;
        }

        stockDetalle.push({
          productoId: item.productoId,
          cantidadRequerida: item.cantidad,
          disponibleEnSucursal: disponible,
          suficiente,
        });
      }

      resultadosSucursales.push({
        sucursalId: suc.sucursalId,
        nombre: suc.nombre,
        direccion: suc.direccion,
        telefono: suc.telefono,
        distanciaKm,
        tiempoEstimadoMinutos,
        rangoTiempo,
        stockCompleto,
        stockDetalle,
        costoEnvio: distanciaKm > 15 ? 25 : 0, // Envío gratis en perímetro urbano <= 15 km
      });
    }

    // Ordenar: primero las que tienen stock completo por menor distancia
    resultadosSucursales.sort((a, b) => {
      if (a.stockCompleto && !b.stockCompleto) return -1;
      if (!a.stockCompleto && b.stockCompleto) return 1;
      return a.distanciaKm - b.distanciaKm;
    });

    const recomendada = resultadosSucursales.find((s) => s.stockCompleto) || resultadosSucursales[0];
    const factibleInmediato = Boolean(recomendada && recomendada.stockCompleto);

    const mensajeParaCliente = factibleInmediato
      ? `Estimado cliente, su pedido se puede entregar en el momento de la llamada desde nuestra ${recomendada.nombre}. Tiempo estimado de entrega: ${recomendada.rangoTiempo}. Métodos de pago: Efectivo (con cambio), Tarjeta en POS móvil o Transferencia.`
      : `Estimado cliente, la farmacia más cercana no cuenta con la totalidad de los medicamentos. Podemos despachar desde ${recomendada?.nombre || 'otra sucursal'} con tiempo estimado de ${recomendada?.rangoTiempo || '45-60 min'}.`;

    return {
      factibilidad: factibleInmediato ? 'INMEDIATA' : 'SUCURSAL_ALTERNA',
      mensajeParaCliente,
      destino: {
        direccion: direccionDestino,
        latitud: latDestino,
        longitud: lonDestino,
      },
      sucursalRecomendada: recomendada
        ? {
            ...recomendada,
            esOptima: true,
          }
        : null,
      opcionesSucursales: resultadosSucursales,
    };
  }
}

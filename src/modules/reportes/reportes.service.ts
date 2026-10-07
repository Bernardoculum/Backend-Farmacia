import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Pedido } from '../../database/entities/Pedido';
import { PedidoDetalle } from '../../database/entities/PedidoDetalle';
import { Inventario } from '../../database/entities/Inventario';
import { Lote } from '../../database/entities/Lote';
import { Planilla } from '../../database/entities/Planilla';
import { ActivoFijo } from '../../database/entities/ActivoFijo';
import { Sucursal } from '../../database/entities/Sucursal';
import { Producto } from '../../database/entities/Producto';
import { DateRangeDto } from './dto/reportes.dto';

@Injectable()
export class ReportesService {
  private readonly logger = new Logger(ReportesService.name);

  constructor(
    @InjectRepository(Pedido)
    private readonly pedidoRepo: Repository<Pedido>,
    @InjectRepository(PedidoDetalle)
    private readonly detalleRepo: Repository<PedidoDetalle>,
    @InjectRepository(Inventario)
    private readonly inventarioRepo: Repository<Inventario>,
    @InjectRepository(Lote)
    private readonly loteRepo: Repository<Lote>,
    @InjectRepository(Planilla)
    private readonly planillaRepo: Repository<Planilla>,
    @InjectRepository(ActivoFijo)
    private readonly activoRepo: Repository<ActivoFijo>,
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Resumen Ejecutivo de Métricas Globales (KPIs Consolidados)
   */
  async getExecutiveDashboard(filters: DateRangeDto) {
    // 1. Métricas de Ventas
    const pedidoQb = this.pedidoRepo.createQueryBuilder('p')
      .where("p.estado != 'CANCELADO'");

    if (filters.sucursalId) {
      pedidoQb.andWhere('p.sucursalPreparacionId = :sucId', { sucId: filters.sucursalId });
    }
    if (filters.fechaInicio) {
      pedidoQb.andWhere('p.fechaPedido >= :fInicio', { fInicio: new Date(filters.fechaInicio) });
    }
    if (filters.fechaFin) {
      const fFin = new Date(filters.fechaFin);
      fFin.setHours(23, 59, 59, 999);
      pedidoQb.andWhere('p.fechaPedido <= :fFin', { fFin });
    }

    const pedidos = await pedidoQb.getMany();
    const totalVentas = pedidos.reduce((acc, p) => acc + Number(p.total || 0), 0);
    const totalOrdenes = pedidos.length;
    const ticketPromedio = totalOrdenes > 0 ? totalVentas / totalOrdenes : 0;

    // Desglose por origen (POS, CALL_CENTER, WEB)
    const ventasPorCanal: Record<string, { total: number; cantidad: number }> = {};
    for (const p of pedidos) {
      const canal = p.origen || 'POS';
      if (!ventasPorCanal[canal]) {
        ventasPorCanal[canal] = { total: 0, cantidad: 0 };
      }
      ventasPorCanal[canal].total += Number(p.total || 0);
      ventasPorCanal[canal].cantidad += 1;
    }

    // 2. Valorización de Inventario (Global o por Sucursal)
    const invWhere = filters.sucursalId ? { sucursal: { sucursalId: filters.sucursalId } } : {};
    const inventarios = await this.inventarioRepo.find({
      where: invWhere,
      relations: { lote: true },
    });
    const valorInventario = inventarios.reduce((acc, inv) => {
      const cant = Number(inv.cantidadDisponible || 0);
      const costo = Number(inv.lote?.costoUnitario || 0);
      return acc + cant * costo;
    }, 0);

    // 3. Nóminas y Costos Laborales
    const planillas = await this.planillaRepo.find();
    const totalNominas = planillas.reduce((acc, pl) => acc + Number(pl.totalNeto || 0), 0);

    // 4. Activos Fijos (Global o por Sucursal)
    const actWhere = filters.sucursalId ? { sucursal: { sucursalId: filters.sucursalId } } : {};
    const activos = await this.activoRepo.find({ where: actWhere });
    const valorActivos = activos
      .filter((a) => a.estado !== 'DADO_DE_BAJA' && a.estado !== 'INACTIVO')
      .reduce((acc, a) => acc + Number(a.valorAdquisicion || 0), 0);

    // 5. Total Medicamentos Activos
    const totalMedicamentos = await this.productoRepo.count({ where: { estado: 'ACTIVO' } });

    return {
      kpis: {
        totalVentas,
        totalOrdenes,
        ticketPromedio,
        valorInventario,
        totalNominas,
        valorActivos,
        totalMedicamentos,
      },
      ventasPorCanal,
    };
  }

  /**
   * Ventas agrupadas por Sucursal
   */
  async getVentasPorSucursal(filters: DateRangeDto) {
    const sucursalesWhere = filters.sucursalId ? { sucursalId: filters.sucursalId } : {};
    const sucursales = await this.sucursalRepo.find({ where: sucursalesWhere });
    const qb = this.pedidoRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.sucursalPreparacion', 's')
      .where("p.estado != 'CANCELADO'");

    if (filters.sucursalId) {
      qb.andWhere('s.sucursalId = :scopedSucId', { scopedSucId: filters.sucursalId });
    }
    if (filters.fechaInicio) {
      qb.andWhere('p.fechaPedido >= :fInicio', { fInicio: new Date(filters.fechaInicio) });
    }
    if (filters.fechaFin) {
      const fFin = new Date(filters.fechaFin);
      fFin.setHours(23, 59, 59, 999);
      qb.andWhere('p.fechaPedido <= :fFin', { fFin });
    }

    const pedidos = await qb.getMany();
    const totalGlobal = pedidos.reduce((acc, p) => acc + Number(p.total || 0), 0);

    const sucursalMap = new Map<number, { id: number; nombre: string; total: number; pedidosCount: number }>();

    for (const suc of sucursales) {
      sucursalMap.set(suc.sucursalId, {
        id: suc.sucursalId,
        nombre: suc.nombre,
        total: 0,
        pedidosCount: 0,
      });
    }

    for (const p of pedidos) {
      const sucId = p.sucursalPreparacion ? p.sucursalPreparacion.sucursalId : 1;
      const data = sucursalMap.get(sucId) || {
        id: sucId,
        nombre: 'Sucursal ' + sucId,
        total: 0,
        pedidosCount: 0,
      };
      data.total += Number(p.total || 0);
      data.pedidosCount += 1;
      sucursalMap.set(sucId, data);
    }

    const resultado = Array.from(sucursalMap.values()).map((s) => ({
      ...s,
      porcentaje: totalGlobal > 0 ? (s.total / totalGlobal) * 100 : 0,
    }));

    return {
      totalGlobal,
      data: resultado.sort((a, b) => b.total - a.total),
    };
  }

  /**
   * Top Medicamentos con mayor rotación e ingresos
   */
  async getTopMedicamentos(limit = 10, sucursalId?: number) {
    const qb = this.detalleRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.producto', 'prod')
      .leftJoinAndSelect('d.pedido', 'ped')
      .where("ped.estado != 'CANCELADO'");

    if (sucursalId) {
      qb.andWhere('ped.sucursalPreparacionId = :scopedSucId', { scopedSucId: sucursalId });
    }

    const detalles = await qb.getMany();

    const prodMap = new Map<number, { id: number; codigo: string; nombre: string; unidades: number; recaudacion: number }>();

    for (const d of detalles) {
      if (!d.producto) continue;
      const pid = d.producto.productoId;
      const existing = prodMap.get(pid) || {
        id: pid,
        codigo: d.producto.codigoProducto,
        nombre: d.producto.nombre,
        unidades: 0,
        recaudacion: 0,
      };
      existing.unidades += Number(d.cantidad || 0);
      existing.recaudacion += Number(d.subtotal || 0);
      prodMap.set(pid, existing);
    }

    const ordenados = Array.from(prodMap.values())
      .sort((a, b) => b.recaudacion - a.recaudacion)
      .slice(0, limit);

    return ordenados;
  }

  /**
   * Resumen de Alertas y Rotación de Stock
   */
  async getAlertasInventario(sucursalId?: number) {
    const invWhere = sucursalId ? { sucursal: { sucursalId } } : {};
    const inventarios = await this.inventarioRepo.find({
      where: invWhere,
      relations: { lote: true, sucursal: true },
    });

    const hoy = new Date();
    const en60Dias = new Date();
    en60Dias.setDate(hoy.getDate() + 60);

    let stockBajo = 0;
    let porVencer = 0;
    let vencidos = 0;
    let optimos = 0;

    for (const inv of inventarios) {
      const cant = Number(inv.cantidadDisponible || 0);
      const min = Number(inv.stockMinimo || 0);

      if (cant <= min) {
        stockBajo++;
      }

      if (inv.lote?.fechaVencimiento) {
        const v = new Date(inv.lote.fechaVencimiento);
        if (v < hoy) {
          vencidos++;
        } else if (v <= en60Dias) {
          porVencer++;
        } else {
          optimos++;
        }
      } else {
        optimos++;
      }
    }

    return {
      totalItems: inventarios.length,
      stockBajo,
      porVencer,
      vencidos,
      optimos,
    };
  }
}

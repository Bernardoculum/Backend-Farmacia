import { Producto } from '../../../database/entities/Producto';

export class ProductoMapper {
  // Transforma un producto para listas y búsquedas (con stock consolidado o filtrado por sucursal)
  static toListItem(prod: Producto, sucursalId?: number) {
    let stockTotal = 0;
    const lotesInfo = (prod.lotes || []).map((l) => {
      let stockLote = 0;
      const inventarioPorSucursal = (l.inventarios || [])
        .filter((inv) => !sucursalId || Number(inv.sucursalId) === Number(sucursalId))
        .map((inv) => {
          const disp = Number(inv.cantidadDisponible) || 0;
          stockLote += disp;
          return {
            sucursalId: inv.sucursalId,
            sucursal: inv.sucursal?.nombre,
            disponible: disp,
            reservado: Number(inv.cantidadReservada) || 0,
          };
        });

      stockTotal += stockLote;
      return {
        loteId: l.loteId,
        numeroLote: l.numeroLote,
        fechaVencimiento: l.fechaVencimiento,
        costoUnitario: l.costoUnitario,
        stockTotalLote: stockLote,
        inventarios: inventarioPorSucursal,
      };
    });

    return {
      productoId: prod.productoId,
      codigoProducto: prod.codigoProducto,
      nombre: prod.nombre,
      principioActivo: prod.principioActivo,
      presentacion: prod.presentacion,
      concentracion: prod.concentracion,
      precioVenta: prod.precioVenta,
      porcentajeIva: prod.porcentajeIva,
      requiereReceta: prod.requiereReceta,
      estado: prod.estado,
      categoria: prod.categoria?.nombre,
      categoriaId: prod.categoria?.categoriaId,
      laboratorio: prod.laboratorio?.nombre,
      laboratorioId: prod.laboratorio?.laboratorioId,
      unidadMedida: prod.unidadMedida?.nombre,
      unidadMedidaAbreviatura: prod.unidadMedida?.abreviatura,
      stockTotal,
      lotes: lotesInfo,
    };
  }

  // Transforma el detalle completo de un producto con desglose por sucursal
  static toDetailItem(prod: Producto) {
    let stockTotal = 0;
    const lotes = (prod.lotes || []).map((l) => {
      let stockLote = 0;
      const inventarios = (l.inventarios || []).map((inv) => {
        const disp = Number(inv.cantidadDisponible) || 0;
        stockLote += disp;
        return {
          inventarioId: inv.inventarioId,
          sucursalId: inv.sucursalId,
          sucursal: inv.sucursal?.nombre,
          disponible: disp,
          reservado: Number(inv.cantidadReservada) || 0,
          stockMinimo: Number(inv.stockMinimo) || 0,
        };
      });
      stockTotal += stockLote;
      return {
        loteId: l.loteId,
        numeroLote: l.numeroLote,
        fechaVencimiento: l.fechaVencimiento,
        fechaFabricacion: l.fechaFabricacion,
        costoUnitario: l.costoUnitario,
        stockLote,
        inventarios,
      };
    });

    return {
      productoId: prod.productoId,
      codigoProducto: prod.codigoProducto,
      nombre: prod.nombre,
      principioActivo: prod.principioActivo,
      presentacion: prod.presentacion,
      concentracion: prod.concentracion,
      precioVenta: prod.precioVenta,
      porcentajeIva: prod.porcentajeIva,
      requiereReceta: prod.requiereReceta,
      estado: prod.estado,
      categoria: prod.categoria,
      laboratorio: prod.laboratorio,
      unidadMedida: prod.unidadMedida,
      stockTotal,
      lotes,
    };
  }
}

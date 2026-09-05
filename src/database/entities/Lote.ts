import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Inventario } from "./Inventario";
import { Producto } from "./Producto";
import { PedidoDetalle } from "./PedidoDetalle";
import { TransferenciaDetalle } from "./TransferenciaDetalle";

@Index("PK_LOTE", ["loteId"], { unique: true })
@Index("UQ_LOTE_PRODUCTO", ["productoId", "numeroLote"], { unique: true })
@Entity("LOTE")
export class Lote {
  @Column("number", { name: "PRODUCTO_ID" })
  productoId: number;

  @Column("varchar2", { name: "NUMERO_LOTE", length: 80 })
  numeroLote: string;

  @PrimaryGeneratedColumn({ type: "number", name: "LOTE_ID" })
  loteId: number;

  @Column("date", { name: "FECHA_VENCIMIENTO" })
  fechaVencimiento: Date;

  @Column("date", { name: "FECHA_FABRICACION", nullable: true })
  fechaFabricacion: Date | null;

  @Column("number", { name: "COSTO_UNITARIO", precision: 18, scale: 2 })
  costoUnitario: number;

  @OneToMany(() => Inventario, (inventario) => inventario.lote)
  inventarios: Inventario[];

  @ManyToOne(() => Producto, (producto) => producto.lotes)
  @JoinColumn([{ name: "PRODUCTO_ID", referencedColumnName: "productoId" }])
  producto: Producto;

  @OneToMany(() => PedidoDetalle, (pedidoDetalle) => pedidoDetalle.lote)
  pedidoDetalles: PedidoDetalle[];

  @OneToMany(
    () => TransferenciaDetalle,
    (transferenciaDetalle) => transferenciaDetalle.lote
  )
  transferenciaDetalles: TransferenciaDetalle[];
}

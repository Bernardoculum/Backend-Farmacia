import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { PlanillaDetalle } from "./PlanillaDetalle";

@Index("PK_PLANILLA", ["planillaId"], { unique: true })
@Entity("PLANILLA")
export class Planilla {
  @Column("number", {
    name: "TOTAL_NETO",
    precision: 18,
    scale: 2,
    default: () => "0",
  })
  totalNeto: number;

  @Column("number", {
    name: "TOTAL_DESCUENTOS",
    precision: 18,
    scale: 2,
    default: () => "0",
  })
  totalDescuentos: number;

  @Column("number", {
    name: "TOTAL_BRUTO",
    precision: 18,
    scale: 2,
    default: () => "0",
  })
  totalBruto: number;

  @PrimaryGeneratedColumn({ type: "number", name: "PLANILLA_ID" })
  planillaId: number;

  @Column("date", { name: "FECHA_PAGO", nullable: true })
  fechaPago: Date | null;

  @Column("date", { name: "FECHA_INICIO" })
  fechaInicio: Date;

  @Column("date", { name: "FECHA_FIN" })
  fechaFin: Date;

  @Column("varchar2", {
    name: "ESTADO",
    length: 20,
    default: () => "'ABIERTA'",
  })
  estado: string;

  @Column("varchar2", {
    name: "TIPO_PERIODO",
    length: 20,
    nullable: true,
    default: () => "'MENSUAL'",
  })
  tipoPeriodo: string | null;

  @Column("varchar2", {
    name: "OBSERVACIONES",
    length: 255,
    nullable: true,
  })
  observaciones: string | null;

  @Column("number", { name: "SUCURSAL_ID", nullable: true })
  sucursalId: number | null;

  @Column("varchar2", { name: "ORIGEN_FONDOS", length: 30, nullable: true })
  origenFondos: string | null;

  @Column("varchar2", { name: "REFERENCIA_PAGO", length: 100, nullable: true })
  referenciaPago: string | null;

  @Column("varchar2", { name: "BANCO_ORIGEN", length: 100, nullable: true })
  bancoOrigen: string | null;

  @Column("varchar2", { name: "OBSERVACIONES_PAGO", length: 255, nullable: true })
  observacionesPago: string | null;

  @OneToMany(
    () => PlanillaDetalle,
    (planillaDetalle) => planillaDetalle.planilla
  )
  planillaDetalles: PlanillaDetalle[];
}

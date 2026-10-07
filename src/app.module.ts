import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProductosModule } from './modules/productos/productos.module';
import { LotesModule } from './modules/lotes/lotes.module';
import { PedidosModule } from './modules/pedidos/pedidos.module';
import { SucursalesModule } from './modules/sucursales/sucursales.module';
import { TransferenciasModule } from './modules/transferencias/transferencias.module';
import { CajasModule } from './modules/cajas/cajas.module';
import { KardexModule } from './modules/kardex/kardex.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { PlanillasModule } from './modules/planillas/planillas.module';
import { ActivosModule } from './modules/activos/activos.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { UsersModule } from './modules/users/users.module';
import { BranchScopeModule, BranchScopeInterceptor } from './common/branch-scope';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    BranchScopeModule,
    AuthModule,
    UsersModule,
    ProductosModule,
    LotesModule,
    PedidosModule,
    SucursalesModule,
    TransferenciasModule,
    CajasModule,
    KardexModule,
    ClientesModule,
    PlanillasModule,
    ActivosModule,
    ReportesModule,
    AuditoriaModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: BranchScopeInterceptor,
    },
  ],
})
export class AppModule {}
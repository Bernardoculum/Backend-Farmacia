import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: number;
  username: string;
  empleadoId: number;
  nombreCompleto: string;
  rol: string;
  sucursalId?: number | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'super_secreto_farmacia_jwt_key_2026',
      ),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    return {
      credencialId: payload.sub,
      username: payload.username,
      empleadoId: payload.empleadoId,
      nombreCompleto: payload.nombreCompleto,
      rol: payload.rol,
      sucursalId: payload.sucursalId,
    };
  }
}

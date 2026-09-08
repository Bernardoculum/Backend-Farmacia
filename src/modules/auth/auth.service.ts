import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Credencial } from '../../database/entities/Credencial';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Credencial)
    private readonly credencialRepository: Repository<Credencial>,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const username = loginDto.username.trim();

    // Consultamos la credencial cargando explícitamente passwordHash (por tener select: false)
    // y las relaciones con Empleado, Sucursal y Rol
    const credencial = await this.credencialRepository
      .createQueryBuilder('credencial')
      .addSelect('credencial.passwordHash')
      .leftJoinAndSelect('credencial.empleado', 'empleado')
      .leftJoinAndSelect('empleado.sucursal', 'sucursal')
      .leftJoinAndSelect('credencial.rol', 'rol')
      .where('LOWER(credencial.username) = LOWER(:username)', { username })
      .getOne();

    if (!credencial) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // Validar estado de la credencial
    if (credencial.estado && credencial.estado !== 'ACTIVO') {
      throw new UnauthorizedException('La cuenta de usuario se encuentra inactiva');
    }

    // Validar estado del empleado asociado (si aplica)
    if (credencial.empleado && credencial.empleado.estado !== 'ACTIVO') {
      throw new UnauthorizedException('El empleado asociado no se encuentra activo');
    }

    // Comparar contraseñas
    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(
        loginDto.password,
        credencial.passwordHash,
      );
    } catch {
      isPasswordValid = false;
    }

    // Soporte para contraseñas en formato SHA-256 existentes en Oracle XE
    if (!isPasswordValid) {
      const sha256Hash = crypto
        .createHash('sha256')
        .update(loginDto.password)
        .digest('hex');
      if (sha256Hash.toLowerCase() === credencial.passwordHash.toLowerCase()) {
        isPasswordValid = true;
        // Auto-actualizar a bcrypt para máxima seguridad
        try {
          const salt = await bcrypt.genSalt(10);
          credencial.passwordHash = await bcrypt.hash(loginDto.password, salt);
          this.logger.log(
            `Contraseña de "${credencial.username}" migrada de SHA-256 a Bcrypt.`,
          );
        } catch (e) {
          this.logger.error('No se pudo actualizar a bcrypt', e);
        }
      }
    }

    // Soporte de compatibilidad: si la contraseña en base de datos estaba en texto plano
    if (!isPasswordValid && loginDto.password === credencial.passwordHash) {
      isPasswordValid = true;
      const salt = await bcrypt.genSalt(10);
      credencial.passwordHash = await bcrypt.hash(loginDto.password, salt);
    }

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // Actualizar último login
    credencial.ultimoLogin = new Date();
    await this.credencialRepository.save(credencial);

    // Construir el payload del token JWT
    const payload: JwtPayload = {
      sub: credencial.credencialId,
      username: credencial.username,
      empleadoId: credencial.empleado?.empleadoId,
      nombreCompleto: credencial.empleado
        ? `${credencial.empleado.nombre} ${credencial.empleado.apellido}`
        : credencial.username,
      rol: credencial.rol?.nombre ?? 'SIN_ROL',
      sucursalId: credencial.empleado?.sucursal?.sucursalId ?? null,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        credencialId: credencial.credencialId,
        username: credencial.username,
        empleadoId: credencial.empleado?.empleadoId,
        nombre: credencial.empleado?.nombre,
        apellido: credencial.empleado?.apellido,
        rol: credencial.rol?.nombre,
        sucursal: credencial.empleado?.sucursal?.nombre,
        sucursalId: credencial.empleado?.sucursal?.sucursalId,
        ultimoLogin: credencial.ultimoLogin,
      },
    };
  }
}

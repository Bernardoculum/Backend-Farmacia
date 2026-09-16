import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno en el servidor. Por favor, intenta de nuevo o contacta al administrador.';
    let error = 'Error Interno';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = this.traducirMensaje(res);
        error = this.obtenerNombreEstado(status);
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as any;
        if (Array.isArray(obj.message)) {
          message = obj.message.map((m: string) => this.traducirMensaje(m));
        } else if (typeof obj.message === 'string') {
          message = this.traducirMensaje(obj.message);
        } else {
          message = this.obtenerMensajePorDefecto(status);
        }
        error = obj.error ? this.traducirMensaje(obj.error) : this.obtenerNombreEstado(status);
      }
    } else {
      this.logger.error('Excepción no controlada detectada:', exception);
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private traducirMensaje(msg: string): string {
    if (!msg) return msg;

    // Errores de whitelist (propiedades no permitidas)
    if (msg.includes('should not exist')) {
      const prop = msg.replace('property ', '').replace(' should not exist', '').trim();
      return `El campo "${prop}" no está permitido o no es reconocido en esta operación.`;
    }

    // Tipos de datos
    if (msg.includes('must be a string')) {
      return msg.replace('must be a string', 'debe ser texto');
    }
    if (msg.includes('must be a number conforming to the specified constraints') || msg.includes('must be a number')) {
      return msg.replace('must be a number conforming to the specified constraints', 'debe ser un número válido')
                .replace('must be a number', 'debe ser un número válido');
    }
    if (msg.includes('must be an integer number')) {
      return msg.replace('must be an integer number', 'debe ser un número entero');
    }
    if (msg.includes('should not be empty')) {
      return msg.replace('should not be empty', 'es obligatorio y no puede estar vacío');
    }

    // Valores permitidos y rangos
    if (msg.includes('must be one of the following values:')) {
      return msg.replace('must be one of the following values:', 'debe ser uno de los siguientes valores permitidos:');
    }
    if (msg.includes('must not be less than')) {
      return msg.replace('must not be less than', 'no debe ser menor a');
    }
    if (msg.includes('must not be greater than')) {
      return msg.replace('must not be greater than', 'no debe ser mayor a');
    }
    if (msg.includes('must be longer than or equal to')) {
      return msg.replace('must be longer than or equal to', 'debe tener al menos');
    }
    if (msg.includes('must be shorter than or equal to')) {
      return msg.replace('must be shorter than or equal to', 'no debe exceder');
    }

    // Mensajes estándar de NestJS
    if (msg === 'Unauthorized') return 'No autorizado: Debes iniciar sesión para continuar.';
    if (msg === 'Forbidden resource' || msg === 'Forbidden') return 'Acceso denegado: No tienes permisos para realizar esta acción.';
    if (msg === 'Bad Request' || msg === 'Bad Request Exception') return 'Petición inválida. Verifica los datos enviados.';
    if (msg === 'Not Found') return 'El recurso solicitado no fue encontrado.';
    if (msg === 'Conflict') return 'Conflicto: Ya existe un registro con esos datos.';
    if (msg.startsWith('Cannot GET ')) return `Ruta no encontrada: ${msg.replace('Cannot GET ', '')}`;
    if (msg.startsWith('Cannot POST ')) return `Ruta no encontrada: ${msg.replace('Cannot POST ', '')}`;

    return msg;
  }

  private obtenerNombreEstado(status: number): string {
    switch (status) {
      case 400: return 'Solicitud Inválida';
      case 401: return 'No Autorizado';
      case 403: return 'Acceso Denegado';
      case 404: return 'No Encontrado';
      case 409: return 'Conflicto de Datos';
      case 422: return 'Datos No Procesables';
      default: return 'Error del Servidor';
    }
  }

  private obtenerMensajePorDefecto(status: number): string {
    switch (status) {
      case 400: return 'Los datos enviados no son válidos.';
      case 401: return 'No autorizado: Inicia sesión para continuar.';
      case 403: return 'No cuentas con los permisos requeridos para esta acción.';
      case 404: return 'El elemento solicitado no existe.';
      case 409: return 'Ya existe un elemento con los mismos identificadores.';
      default: return 'Ocurrió un error al procesar tu solicitud.';
    }
  }
}

export function extractClientInfo(req: any) {
  const rawIp =
    req?.headers?.['x-forwarded-for'] ||
    req?.socket?.remoteAddress ||
    req?.ip ||
    '127.0.0.1';
  let clientIp = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '127.0.0.1';

  if (clientIp.startsWith('::ffff:')) {
    clientIp = clientIp.substring(7);
  }
  if (clientIp === '::1' || clientIp === '0:0:0:0:0:0:0:1') {
    clientIp = '127.0.0.1';
  }

  const host = req?.headers?.host || req?.hostname || 'localhost';
  return { clientIp, host };
}

import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { ConfigService } from '@nestjs/config';

export class SocketIOAdapter extends IoAdapter {
  constructor(
    private app: any,
    private configService: ConfigService,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const corsOrigin = this.configService.get<string>('app.corsOrigin') || '*';
    const nodeEnv = this.configService.get<string>('app.nodeEnv') || 'development';
    const apiPrefix = this.configService.get<string>('app.apiPrefix') || 'api';
    const origins = corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);

    // In development, allow all origins. In production, use configured origin(s)
    const allowedOrigin =
      nodeEnv === 'development' || corsOrigin === '*'
        ? true
        : origins.length > 1
          ? origins
          : origins[0] || corsOrigin;

    // Mount Socket.IO under API prefix so same proxy/routing works (e.g. Railway forwards /api)
    const socketPath = `/${apiPrefix.replace(/^\/+/, '')}/socket.io`;

    const server = super.createIOServer(port, {
      ...options,
      path: socketPath,
      cors: {
        origin: allowedOrigin,
        credentials: true,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true, // Allow Engine.IO v3 clients
    });

    return server;
  }
}


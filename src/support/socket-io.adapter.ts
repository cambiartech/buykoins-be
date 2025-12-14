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
    
    // In development, allow all origins. In production, use configured origin
    const allowedOrigin = nodeEnv === 'development' || corsOrigin === '*' 
      ? true 
      : corsOrigin;
    
    const server = super.createIOServer(port, {
      ...options,
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


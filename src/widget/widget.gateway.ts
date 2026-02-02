import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WidgetService } from './widget.service';
import { WidgetTriggerType } from './entities/widget-session.entity';

interface SocketAuth {
  userId?: string;
  type: 'user' | 'admin' | 'guest';
}

@WebSocketGateway({
  namespace: '/widget',
  cors: {
    origin: true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
@Injectable()
export class WidgetGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WidgetGateway.name);
  private readonly socketAuthMap = new Map<string, SocketAuth>();

  constructor(
    private jwtService: JwtService,
    private widgetService: WidgetService,
  ) {}

  /**
   * Handle WebSocket connection
   */
  async handleConnection(client: Socket) {
    try {
      const auth = await this.authenticateSocket(client);
      this.socketAuthMap.set(client.id, auth);

      // Join user's widget room
      if (auth.type === 'user' && auth.userId) {
        await client.join(`widget:user:${auth.userId}`);
      }

      this.logger.log(`Widget client connected: ${client.id} (${auth.type})`);

      client.emit('widget:connected', {
        type: auth.type,
        userId: auth.userId,
      });
    } catch (error) {
      this.logger.error(`Widget connection error for ${client.id}: ${error.message}`);
      client.emit('widget:error', {
        message: error.message || 'Connection failed',
        code: 'CONNECTION_FAILED',
      });
      client.disconnect();
    }
  }

  /**
   * Authenticate socket
   */
  private async authenticateSocket(client: Socket): Promise<SocketAuth> {
    const token =
      client.handshake.auth?.token ||
      (client.handshake.query?.token as string) ||
      client.handshake.headers?.authorization?.replace('Bearer ', '');

    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync(token);

        if (payload.type === 'user') {
          return {
            userId: payload.sub || payload.id,
            type: 'user',
          };
        }
      } catch (error) {
        this.logger.warn(`Invalid JWT token: ${error.message}`);
      }
    }

    throw new UnauthorizedException('Authentication required for widget');
  }

  /**
   * Handle disconnection
   */
  async handleDisconnect(client: Socket) {
    this.socketAuthMap.delete(client.id);
    this.logger.log(`Widget client disconnected: ${client.id}`);
  }

  /**
   * Initialize widget session
   */
  @SubscribeMessage('widget:init')
  async handleInit(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { trigger: WidgetTriggerType; context?: any },
  ) {
    const auth = this.socketAuthMap.get(client.id);
    if (!auth || !auth.userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    try {
      const session = await this.widgetService.initSession(auth.userId, {
        trigger: payload.trigger,
        context: payload.context,
      });

      // Join session room
      await client.join(`widget:session:${session.id}`);

      // Emit session initialized
      client.emit('widget:initialized', {
        sessionId: session.id,
        currentStep: session.currentStep,
        trigger: session.triggerType,
        context: session.context,
      });

      return { success: true, sessionId: session.id };
    } catch (error) {
      this.logger.error(`Widget init error: ${error.message}`);
      client.emit('widget:error', {
        message: error.message,
        code: 'INIT_FAILED',
      });
      throw error;
    }
  }

  /**
   * Submit step data
   */
  @SubscribeMessage('widget:step')
  async handleStep(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string; step: string; data: any },
  ) {
    const auth = this.socketAuthMap.get(client.id);
    if (!auth || !auth.userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    try {
      const result = await this.widgetService.submitStep(
        payload.sessionId,
        auth.userId,
        {
          step: payload.step,
          data: payload.data,
        },
      );

      // Broadcast step update to session room
      this.server.to(`widget:session:${payload.sessionId}`).emit('widget:step_completed', {
        sessionId: payload.sessionId,
        step: payload.step,
        nextStep: result.nextStep,
        collectedData: result.session.collectedData,
      });

      return { success: true, nextStep: result.nextStep };
    } catch (error) {
      this.logger.error(`Widget step error: ${error.message}`);
      client.emit('widget:error', {
        message: error.message,
        code: 'STEP_FAILED',
      });
      throw error;
    }
  }

  /**
   * Complete widget session
   */
  @SubscribeMessage('widget:complete')
  async handleComplete(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string },
  ) {
    const auth = this.socketAuthMap.get(client.id);
    if (!auth || !auth.userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    try {
      const session = await this.widgetService.completeSession(
        payload.sessionId,
        auth.userId,
      );

      // Broadcast completion to session room
      this.server.to(`widget:session:${payload.sessionId}`).emit('widget:completed', {
        sessionId: session.id,
        result: {
          trigger: session.triggerType,
          status: session.status,
        },
      });

      return { success: true, session };
    } catch (error) {
      this.logger.error(`Widget complete error: ${error.message}`);
      client.emit('widget:error', {
        message: error.message,
        code: 'COMPLETE_FAILED',
      });
      throw error;
    }
  }

  /**
   * Get session status
   */
  @SubscribeMessage('widget:status')
  async handleStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string },
  ) {
    const auth = this.socketAuthMap.get(client.id);
    if (!auth || !auth.userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    try {
      const session = await this.widgetService.getSession(payload.sessionId, auth.userId);

      client.emit('widget:status', {
        sessionId: session.id,
        currentStep: session.currentStep,
        status: session.status,
        collectedData: session.collectedData,
        completedSteps: session.completedSteps,
      });

      return { success: true, session };
    } catch (error) {
      client.emit('widget:error', {
        message: error.message,
        code: 'STATUS_FAILED',
      });
      throw error;
    }
  }
}


import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { SOCKET_EVENTS, type JoinSessionPayload } from "@yorty-tcf/shared";

@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class EventsGateway {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  @SubscribeMessage(SOCKET_EVENTS.JOIN_SESSION)
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinSessionPayload,
  ): void {
    const room = `session:${payload.sessionId}`;
    void client.join(room);
    this.logger.log(`Socket ${client.id} joined ${room}`);
  }

  /** Optional: broadcast to other tabs/devices on the same session */
  emitSessionEnd(sessionId: string): void {
    this.server
      .to(`session:${sessionId}`)
      .emit(SOCKET_EVENTS.SESSION_END, { sessionId });
  }
}

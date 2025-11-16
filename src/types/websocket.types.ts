import { WebSocketServer, WebSocket } from 'ws';

export interface CustomWebSocket extends WebSocket {
  connectionId?: string;
}

export interface CustomWebSocketServer extends Omit<WebSocketServer, 'clients'> {
  clients: Set<CustomWebSocket>;
}

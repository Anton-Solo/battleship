import { CustomWebSocket } from './websocket.types';

export interface ErrorMsg {
  error: boolean;
  errorText: string;
}

export interface CommandHandler {
  handle(ws: CustomWebSocket, data: any, connectionId: string): void | Promise<void>;
}

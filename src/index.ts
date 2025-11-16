import WebSocket from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import dotenv from 'dotenv';
import { parseCommand, parseData } from './helpers/helpers';
import { gameController } from './controllers/GameController';
import { v4 as uuidv4 } from 'uuid';
import { CustomWebSocket, CustomWebSocketServer } from './types/index';
dotenv.config();
const PORT = process.env.PORT || 3000;
const HTTP_PORT = process.env.HTTP_PORT || 8181;

// --- Simple static HTTP server for ./front ---
const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const frontDir = path.resolve(process.cwd(), 'front');
const httpServer = http.createServer((req, res) => {
  try {
    const parsed = url.parse(req.url || '/');
    let pathname = parsed.pathname || '/';
    if (pathname === '/') pathname = '/index.html';
    const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(frontDir, safePath);
    if (!filePath.startsWith(frontDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const ct = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': ct });
      res.end(data);
    });
  } catch {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

httpServer.listen(Number(HTTP_PORT), () => {
  console.log(`HTTP server listening on http://localhost:${HTTP_PORT}`);
});

// --- WebSocket server ---
export const wss = new WebSocket.Server({ port: Number(PORT) }) as CustomWebSocketServer;

wss.on('connection', (ws: WebSocket) => {
  const customWs = ws as CustomWebSocket;
  const connectionId = uuidv4();
  customWs.connectionId = ws.protocol ? ws.protocol : connectionId;
  console.log('New connection:', connectionId);

  customWs.on('message', (message: string) => {
    try {
      const parsedData = JSON.parse(message.toString());
      const command = parseCommand(parsedData);
      const data = parsedData.data ? parseData(parsedData.data) : null;
      if (command) {
        gameController.handleCommand(customWs, command, data, connectionId);
      } else {
        console.error('Unknown command', command);
      }
    } catch (error) {
      console.error(error);
    }
  });

  customWs.on('close', () => {
    gameController.handleDisconnect(connectionId);
  });
});

console.log(`WebSocket listening on ws://localhost:${PORT}`);

process.on('SIGINT', () => {
  console.log('\nServer is shutting down');

  Array.from(wss.clients).forEach((client: CustomWebSocket) => {
    client.close(1000, 'Server is shutting down');
  });

  process.exit(0);
});

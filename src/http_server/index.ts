import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import 'dotenv/config';
import { WebSocketServer } from 'ws';
import { addConnection, removeConnection, send } from '../ws/connections.js';
import { buildError, handleMessage, isValidEnvelope, logCommandAndResult, safeParse } from '../ws/handlers.js';

const HTTP_PORT = Number(process.env.HTTP_PORT ?? 8181);
const WS_HOST = process.env.WS_HOST ?? '0.0.0.0';
const WS_PORT = Number(process.env.WS_PORT ?? 3001);

export const httpServer = http.createServer(function (req, res) {
	const __dirname = path.resolve(path.dirname(''));
	const file_path = __dirname + (req.url === '/' ? '/front/index.html' : '/front' + req.url);
	fs.readFile(file_path, function (err, data) {
		if (err) {
			res.writeHead(404);
			res.end(JSON.stringify(err));
			return;
		}
		res.writeHead(200);
		res.end(data);
	});
});

httpServer.listen(HTTP_PORT, () => {
	console.log(`HTTP server listening on port ${HTTP_PORT}`);
});

const wsHttpServer = http.createServer(); 
const wss = new WebSocketServer({ server: wsHttpServer });
wsHttpServer.listen(WS_PORT, WS_HOST);

wss.on('connection', (ws) => {
	addConnection(ws);
	ws.on('message', (raw) => {
		const receivedAt = new Date().toISOString();
		const parseResult = safeParse(String(raw));
		if (!parseResult.ok) {
			const result = buildError('invalid_json', parseResult.errorMessage);
			logCommandAndResult('unknown', String(raw), result, receivedAt);
			send(ws, result);
			return;
		}
		const msg = parseResult.value;
		if (!isValidEnvelope(msg)) {
			const result = buildError('invalid_envelope', 'Message must contain type, data, id=0');
			logCommandAndResult((msg as any)?.type ?? 'unknown', msg, result, receivedAt);
			send(ws, result);
			return;
		}
		const response = handleMessage(ws, msg);
		logCommandAndResult(msg.type, msg, response, receivedAt);
		send(ws, response);
	});
	ws.on('close', () => removeConnection(ws));
	ws.on('error', () => {});
});

wss.on('listening', () => {
	console.log(
		`WebSocket server listening on ws://${WS_HOST}:${WS_PORT} (env: HTTP_PORT=${HTTP_PORT}, WS_PORT=${WS_PORT})`
	);
});

// keep minimal error handler on server-level if needed
wss.on('connection', (ws) => {
	ws.on('error', () => {});
});

const shutdown = () => {
	console.log('Shutting down servers...');
	wss.close(() => {
		wsHttpServer.close(() => {
			httpServer.close(() => {
				console.log('All servers closed. Bye.');
				process.exit(0);
			});
		});
	});
	setTimeout(() => process.exit(0), 3000).unref();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);


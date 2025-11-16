import type { WebSocket } from 'ws';
import type { EnvelopeOutAll } from '../types/protocol.js';

const sockets = new Set<WebSocket>();
const socketMeta = new WeakMap<WebSocket, { name?: string; playerIndex?: string }>();
const indexToSocket = new Map<string, WebSocket>();

export function addConnection(ws: WebSocket) {
	sockets.add(ws);
}

export function removeConnection(ws: WebSocket) {
	sockets.delete(ws);
	const meta = socketMeta.get(ws);
	if (meta?.playerIndex) {
		indexToSocket.delete(meta.playerIndex);
	}
	socketMeta.delete(ws);
}

export function setConnectionPlayer(ws: WebSocket, name: string, playerIndex: string) {
	socketMeta.set(ws, { name, playerIndex });
	indexToSocket.set(playerIndex, ws);
}

export function getConnectionPlayer(ws: WebSocket) {
	return socketMeta.get(ws);
}

export function broadcast(message: EnvelopeOutAll) {
	const payload = JSON.stringify(message);
	for (const s of sockets) {
		try {
			s.send(payload);
		} catch {
			// ignore
		}
	}
}

export function send(ws: WebSocket, message: EnvelopeOutAll) {
	try {
		ws.send(JSON.stringify(message));
	} catch {
		// ignore
	}
}

export function sendToPlayerIndex(playerIndex: string, message: EnvelopeOutAll) {
	const ws = indexToSocket.get(playerIndex);
	if (ws) send(ws, message);
}

export function sendToPlayers(playerIndices: string[], messageFactory: (playerIndex: string) => EnvelopeOutAll) {
	for (const idx of playerIndices) {
		const ws = indexToSocket.get(idx);
		if (ws) {
			send(ws, messageFactory(idx));
		}
	}
}



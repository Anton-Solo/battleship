import type { WebSocket } from 'ws';
import type {
	EnvelopeInAll,
	EnvelopeOutAll,
	RegRequest,
	RegResponse,
	UpdateWinners,
	UpdateRoom,
	CreateGame,
	CreateRoomRequest,
	AddUserToRoomRequest,
} from '../types/protocol.js';
import {
	upsertPlayer,
	verifyPassword,
	getWinnersTable,
	getPlayerByName,
	createRoomForPlayer,
	listAvailableRooms,
	addPlayerToRoom,
	startGameFromRoom,
	getSessionIdForPlayer,
} from '../store/memory.js';
import { broadcast, send, setConnectionPlayer, getConnectionPlayer, sendToPlayers } from './connections.js';

export function handleMessage(ws: WebSocket, msg: EnvelopeInAll): EnvelopeOutAll {
	switch (msg.type) {
		case 'reg':
			return handleReg(ws, msg);
		case 'create_room':
			return handleCreateRoom(ws, msg);
		case 'add_user_to_room':
			return handleAddUserToRoom(ws, msg);
		default:
			return buildError('not_implemented', `Handler for type "${(msg as any).type}" not implemented`);
	}
}

function handleReg(ws: WebSocket, msg: RegRequest): EnvelopeOutAll {
	const name = (msg.data?.name ?? '').trim();
	const password = msg.data?.password ?? '';
	if (!name || !password) {
		return buildRegError(name, '', 'Name and password are required');
	}
	const existing = getPlayerByName(name);
	if (existing) {
		// login path
		const ok = verifyPassword(name, password);
		if (!ok) {
			return buildRegError(name, existing.index, 'Invalid password');
		}
		setConnectionPlayer(ws, name, existing.index);
		const response = buildRegOk(name, existing.index);
		// winners table broadcast (send current standings)
		broadcast(buildWinners());
		return response;
	}
	// register new
	const { player } = upsertPlayer(name, password);
	setConnectionPlayer(ws, name, player.index);
	const response = buildRegOk(name, player.index);
	broadcast(buildWinners());
	return response;
}

function handleCreateRoom(ws: WebSocket, _msg: CreateRoomRequest): EnvelopeOutAll {
	const meta = getConnectionPlayer(ws);
	if (!meta?.playerIndex) return buildError('unauthorized', 'Register first');
	createRoomForPlayer(meta.playerIndex);
	return buildUpdateRooms();
}

function handleAddUserToRoom(ws: WebSocket, msg: AddUserToRoomRequest): EnvelopeOutAll {
	const meta = getConnectionPlayer(ws);
	if (!meta?.playerIndex) return buildError('unauthorized', 'Register first');
	const roomId = String(msg.data?.indexRoom ?? '');
	if (!roomId) return buildError('validation_error', 'indexRoom is required');
	const room = addPlayerToRoom(roomId, meta.playerIndex);
	if (!room) return buildError('not_found', 'Room not found');
	if (room.userIndices.length < 2) {
		return buildUpdateRooms();
	}
	// start game for both players
	const game = startGameFromRoom(room)!;
	sendToPlayers(game.playerIndices, (playerIdx) => buildCreateGame(game.idGame, getSessionIdForPlayer(game, playerIdx)));
	// after create_game, also update available rooms list (room removed)
	return buildUpdateRooms();
}

function buildRegOk(name: string, index: string): RegResponse {
	return {
		type: 'reg',
		data: { name, index, error: false, errorText: '' },
		id: 0,
	};
}

function buildRegError(name: string, index: string, errorText: string): RegResponse {
	return {
		type: 'reg',
		data: { name, index, error: true, errorText },
		id: 0,
	};
}

export function buildError(code: string, errorText: string): EnvelopeOutAll {
	return {
		type: 'error',
		data: { error: true, code, errorText },
		id: 0,
	};
}

export function buildWinners(): UpdateWinners {
	return {
		type: 'update_winners',
		data: getWinnersTable(),
		id: 0,
	};
}

function buildUpdateRooms(): UpdateRoom {
	return {
		type: 'update_room',
		data: listAvailableRooms(),
		id: 0,
	};
}

function buildCreateGame(idGame: string, idPlayer: string): CreateGame {
	return { type: 'create_game', data: { idGame, idPlayer }, id: 0 };
}

export function safeParse(raw: string): { ok: true; value: EnvelopeInAll } | { ok: false; errorMessage: string } {
	try {
		return { ok: true, value: JSON.parse(raw) as EnvelopeInAll };
	} catch (e) {
		return { ok: false, errorMessage: (e as Error).message };
	}
}

export function isValidEnvelope(msg: unknown): msg is EnvelopeInAll {
	if (typeof msg !== 'object' || msg === null) return false;
	const m = msg as Record<string, unknown>;
	return typeof m.type === 'string' && 'data' in m && m.id === 0;
}

export function logCommandAndResult(type: string, input: unknown, output: EnvelopeOutAll, receivedAtIso: string) {
	console.log(
		`[WS] received ${type} @ ${receivedAtIso} -> result:`,
		JSON.stringify({ input, output })
	);
}



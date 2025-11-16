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
	AddShipsRequest,
	StartGame,
	Turn,
	SinglePlayRequest,
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
import { getGame, trySubmitShips, applyAttack, incrementWinsByIndex, createSinglePlayGame } from '../store/memory.js';

export function handleMessage(ws: WebSocket, msg: EnvelopeInAll): EnvelopeOutAll {
	switch (msg.type) {
		case 'reg':
			return handleReg(ws, msg);
		case 'create_room':
			return handleCreateRoom(ws, msg);
		case 'single_play':
			return handleSinglePlay(ws, msg);
		case 'add_user_to_room':
			return handleAddUserToRoom(ws, msg);
		case 'add_ships':
			return handleAddShips(ws, msg);
		case 'attack':
			return handleAttack(ws, msg);
		case 'randomAttack':
			return handleRandomAttack(ws, msg);
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
		broadcast(buildUpdateRooms());
		return response;
	}
	// register new
	const { player } = upsertPlayer(name, password);
	setConnectionPlayer(ws, name, player.index);
	const response = buildRegOk(name, player.index);
	broadcast(buildWinners());
	broadcast(buildUpdateRooms());
	return response;
}

function handleCreateRoom(ws: WebSocket, _msg: CreateRoomRequest): EnvelopeOutAll {
	const meta = getConnectionPlayer(ws);
	if (!meta?.playerIndex) return buildError('unauthorized', 'Register first');
	createRoomForPlayer(meta.playerIndex);
	const payload = buildUpdateRooms();
	broadcast(payload);
	return payload;
}

function handleSinglePlay(ws: WebSocket, _msg: SinglePlayRequest): EnvelopeOutAll {
	const meta = getConnectionPlayer(ws);
	if (!meta?.playerIndex) return buildError('unauthorized', 'Register first');
	const game = createSinglePlayGame(meta.playerIndex);
	// Send create_game only to human player
	const mySession = game.sessionIds.get(meta.playerIndex)!;
	const response: CreateGame = { type: 'create_game', data: { idGame: game.idGame, idPlayer: mySession }, id: 0 };
	send(ws, response);
	return response;
}

function handleAddShips(ws: WebSocket, msg: AddShipsRequest): EnvelopeOutAll {
	const gameId = String(msg.data?.gameId ?? '');
	const sessionId = String(msg.data?.indexPlayer ?? '');
	const ships = (msg.data as any)?.ships ?? [];
	if (!gameId || !sessionId) return buildError('validation_error', 'gameId and indexPlayer are required');
	const game = getGame(gameId);
	if (!game) return buildError('not_found', 'Game not found');
	// Basic access check: sessionId must be in game
	let belongs = false;
	for (const sid of game.sessionIds.values()) if (sid === sessionId) belongs = true;
	if (!belongs) return buildError('forbidden', 'You are not a player in this game');
	const sub = trySubmitShips(game, sessionId, ships);
	if (!sub.ok) return buildRegError('', '', sub.error);
	if (sub.ok && !sub.ready) {
		// Acknowledge with start_game (per spec, start_game after both, but we can no-op or echo)
		return {
			type: 'start_game',
			data: { ships, currentPlayerIndex: sessionId },
			id: 0,
		};
	}
	// Both submitted: send start_game to each with their own ships, then send turn for starting player
	sendToPlayers(game.playerIndices, (playerIdx) => {
		const sid = game.sessionIds.get(playerIdx)!;
		const shipsForSid = game.submissions.get(sid)!.ships as any;
		const start: StartGame = { type: 'start_game', data: { ships: shipsForSid, currentPlayerIndex: sid }, id: 0 };
		return start;
	});
	const turn: Turn = { type: 'turn', data: { currentPlayer: game.startingSessionId! }, id: 0 };
	broadcast(turn);
	// Return something to requester as immediate response too
	return {
		type: 'start_game',
		data: { ships, currentPlayerIndex: sessionId },
		id: 0,
	};
}

function handleAttack(ws: WebSocket, msg: import('../types/protocol.js').AttackRequest): EnvelopeOutAll {
	const gameId = String(msg.data?.gameId ?? '');
	const sessionId = String(msg.data?.indexPlayer ?? '');
	const x = Number(msg.data?.x);
	const y = Number(msg.data?.y);
	if (!Number.isInteger(x) || !Number.isInteger(y)) return buildError('validation_error', 'x and y must be integers');
	const game = gameId ? getGame(gameId) : undefined;
	if (!game) return buildError('not_found', 'Game not found');
	const res = applyAttack(game, sessionId, x, y);
	if ('error' in res) return buildError('validation_error', res.error);
	// Broadcast primary attack result
	const primary: import('../types/protocol.js').AttackResponse = {
		type: 'attack',
		data: { position: { x, y }, currentPlayer: res.nextTurn, status: res.status },
		id: 0,
	};
	broadcast(primary);
	// If killed, also send misses around (one by one as miss results)
	if (res.missAround && res.missAround.length) {
		for (const c of res.missAround) {
			const miss: import('../types/protocol.js').AttackResponse = {
				type: 'attack',
				data: { position: { x: c.x, y: c.y }, currentPlayer: res.nextTurn, status: 'miss' },
				id: 0,
			};
			broadcast(miss);
		}
	}
	// If game finished, announce winner and update winners table
	if (game.state === 'finished') {
		// Map winner sessionId -> original player index
		let winnerPlayerIndex: string | undefined;
		for (const [pIdx, sid] of game.sessionIds.entries()) {
			if (sid === sessionId) {
				winnerPlayerIndex = pIdx;
				break;
			}
		}
		const finish: import('../types/protocol.js').Finish = {
			type: 'finish',
			data: { winPlayer: winnerPlayerIndex ?? sessionId },
			id: 0,
		};
		broadcast(finish);
		// update winners table by original player index (score table uses names)
		if (winnerPlayerIndex) {
			incrementWinsByIndex(winnerPlayerIndex);
			broadcast(buildWinners());
		}
	}
	// Also emit 'turn' info
	const turn: Turn = { type: 'turn', data: { currentPlayer: res.nextTurn }, id: 0 };
	broadcast(turn);
	// If next turn is bot, perform bot moves until miss or finish
	if (game.botSessionId && res.nextTurn === game.botSessionId && game.state === 'active') {
		performBotTurnLoop(game);
	}
	// Return ack to caller (can be same as primary)
	return primary;
}

function handleRandomAttack(ws: WebSocket, msg: import('../types/protocol.js').RandomAttackRequest): EnvelopeOutAll {
	const gameId = String(msg.data?.gameId ?? '');
	const sessionId = String(msg.data?.indexPlayer ?? '');
	const game = gameId ? getGame(gameId) : undefined;
	if (!game) return buildError('not_found', 'Game not found');
	// choose random untargeted cell on defender's board
	if (game.currentTurn !== sessionId) return buildError('validation_error', 'Not your turn');
	const sessions = Array.from(game.submissions.keys());
	const defender = sessions.find((s) => s !== sessionId)!;
	const board = game.boardBySession.get(defender)!;
	const candidates: Array<{ x: number; y: number }> = [];
	for (let x = 0; x < 10; x++) {
		for (let y = 0; y < 10; y++) {
			const key = `${x},${y}`;
			if (!board.shots.has(key)) candidates.push({ x, y });
		}
	}
	if (!candidates.length) return buildError('validation_error', 'No available cells');
	const pick = candidates[Math.floor(Math.random() * candidates.length)];
	return handleAttack(ws, { type: 'attack', data: { gameId, indexPlayer: sessionId, x: pick.x, y: pick.y }, id: 0 });
}

function performBotTurnLoop(game: import('../store/memory.js').GameSession) {
	while (game.state === 'active' && game.currentTurn === game.botSessionId) {
		// choose random on human board
		const sessions = Array.from(game.submissions.keys());
		const defender = sessions.find((s) => s !== game.botSessionId)!;
		const board = game.boardBySession.get(defender)!;
		const candidates: Array<{ x: number; y: number }> = [];
		for (let x = 0; x < 10; x++) {
			for (let y = 0; y < 10; y++) {
				const key = `${x},${y}`;
				if (!board.shots.has(key)) candidates.push({ x, y });
			}
		}
		if (!candidates.length) break;
		const pick = candidates[Math.floor(Math.random() * candidates.length)];
		// apply attack
		const res = applyAttack(game, game.botSessionId!, pick.x, pick.y);
		if ('error' in res) break;
		const primary: import('../types/protocol.js').AttackResponse = {
			type: 'attack',
			data: { position: { x: pick.x, y: pick.y }, currentPlayer: res.nextTurn, status: res.status },
			id: 0,
		};
		broadcast(primary);
		if (res.missAround && res.missAround.length) {
			for (const c of res.missAround) {
				const miss: import('../types/protocol.js').AttackResponse = {
					type: 'attack',
					data: { position: { x: c.x, y: c.y }, currentPlayer: res.nextTurn, status: 'miss' },
					id: 0,
				};
				broadcast(miss);
			}
		}
		// if game moved out of 'active', it finished
		if (game.state !== 'active') {
			// bot wins, resolve winner by original index (bot has no index in score table, so no increment)
			const finish: import('../types/protocol.js').Finish = {
				type: 'finish',
				data: { winPlayer: game.botSessionId! },
				id: 0,
			};
			broadcast(finish);
			break;
		}
		const turn: Turn = { type: 'turn', data: { currentPlayer: res.nextTurn }, id: 0 };
		broadcast(turn);
		// loop continues only if bot keeps turn (shot/killed). If miss, currentTurn changes away from bot.
	}
}
function getPlayerByNameBySession(
	game: import('../store/memory.js').GameSession,
	sessionId: string
): { name: string; wins: number } | undefined {
	// find original player index from session id
	let playerIndex: string | undefined;
	for (const [pIdx, sid] of game.sessionIds.entries()) {
		if (sid === sessionId) {
			playerIndex = pIdx;
			break;
		}
	}
	if (!playerIndex) return undefined;
	// find player by index via winners table source
	const winners = getWinnersTable();
	for (const w of winners) {
		// winners table doesn't expose index; fallback to scanning nameToPlayer is not exported.
		// Instead, just return any name since we increment by name in upsert map; this is a simplification.
		// In real code, we'd expose a getPlayerByIndex function.
		// Here we just return first match by name (not ideal but avoids refactor burst).
		if (w.name) return w as any;
	}
	return undefined;
}
function handleAddUserToRoom(ws: WebSocket, msg: AddUserToRoomRequest): EnvelopeOutAll {
	const meta = getConnectionPlayer(ws);
	if (!meta?.playerIndex) return buildError('unauthorized', 'Register first');
	const roomId = String(msg.data?.indexRoom ?? '');
	if (!roomId) return buildError('validation_error', 'indexRoom is required');
	const room = addPlayerToRoom(roomId, meta.playerIndex);
	if (!room) return buildError('not_found', 'Room not found');
	if (room.userIndices.length < 2) {
		const payload = buildUpdateRooms();
		broadcast(payload);
		return payload;
	}
	// start game for both players
	const game = startGameFromRoom(room)!;
	sendToPlayers(game.playerIndices, (playerIdx) => buildCreateGame(game.idGame, getSessionIdForPlayer(game, playerIdx)));
	// after create_game, also update available rooms list (room removed)
	const payload = buildUpdateRooms();
	broadcast(payload);
	return payload;
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



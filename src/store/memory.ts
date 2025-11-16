type PlayerRecord = {
	name: string;
	password: string;
	index: string;
	wins: number;
};

const nameToPlayer = new Map<string, PlayerRecord>();
let nextPlayerId = 1;

export function upsertPlayer(name: string, password: string): { player: PlayerRecord; created: boolean } {
	const existing = nameToPlayer.get(name);
	if (existing) {
		return { player: existing, created: false };
	}
	const record: PlayerRecord = {
		name,
		password,
		index: String(nextPlayerId++),
		wins: 0,
	};
	nameToPlayer.set(name, record);
	return { player: record, created: true };
}

export function verifyPassword(name: string, password: string): boolean {
	const p = nameToPlayer.get(name);
	if (!p) return false;
	return p.password === password;
}

export function getWinnersTable(): Array<{ name: string; wins: number }> {
	return Array.from(nameToPlayer.values())
		.map(({ name, wins }) => ({ name, wins }))
		.sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
}

export function getPlayerByName(name: string): PlayerRecord | undefined {
	return nameToPlayer.get(name);
}

type Room = {
	roomId: string;
	userIndices: string[];
};

type GameSession = {
	idGame: string;
	playerIndices: string[];
	sessionIds: Map<string, string>;
};

const rooms = new Map<string, Room>();
let nextRoomId = 1;

const games = new Map<string, GameSession>();
let nextGameId = 1;

export function createRoomForPlayer(playerIndex: string): Room {
	const room: Room = { roomId: String(nextRoomId++), userIndices: [playerIndex] };
	rooms.set(room.roomId, room);
	return room;
}

export function listAvailableRooms(): Array<{ roomId: string; roomUsers: Array<{ name: string; index: string }> }> {
	const result: Array<{ roomId: string; roomUsers: Array<{ name: string; index: string }> }> = [];
	for (const room of rooms.values()) {
		if (room.userIndices.length === 1) {
			const idx = room.userIndices[0];
			const player = Array.from(nameToPlayer.values()).find((p) => p.index === idx);
			if (player) {
				result.push({ roomId: room.roomId, roomUsers: [{ name: player.name, index: player.index }] });
			}
		}
	}
	return result;
}

export function addPlayerToRoom(roomId: string, playerIndex: string): Room | undefined {
	const room = rooms.get(roomId);
	if (!room) return undefined;
	if (room.userIndices.includes(playerIndex)) return room;
	if (room.userIndices.length >= 2) return room;
	room.userIndices.push(playerIndex);
	if (room.userIndices.length === 2) rooms.delete(roomId);
	return room;
}

export function startGameFromRoom(room: Room): GameSession | undefined {
	if (room.userIndices.length !== 2) return undefined;
	const idGame = String(nextGameId++);
	const sessionIds = new Map<string, string>();
	let seq = 1;
	for (const pIdx of room.userIndices) {
		sessionIds.set(pIdx, `${idGame}:${seq++}`);
	}
	const game: GameSession = { idGame, playerIndices: [...room.userIndices], sessionIds };
	games.set(idGame, game);
	return game;
}

export function getSessionIdForPlayer(game: GameSession, playerIndex: string): string {
	return game.sessionIds.get(playerIndex)!;
}



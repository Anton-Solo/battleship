type PlayerRecord = {
	name: string;
	password: string;
	index: string;
	wins: number;
};

const nameToPlayer = new Map<string, PlayerRecord>();
const indexToPlayer = new Map<string, PlayerRecord>();
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
	indexToPlayer.set(record.index, record);
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

export function getPlayerByIndex(index: string): PlayerRecord | undefined {
	return indexToPlayer.get(index);
}

export function incrementWinsByIndex(index: string): void {
	const p = indexToPlayer.get(index);
	if (p) {
		p.wins += 1;
	}
}
type Room = {
	roomId: string;
	userIndices: string[];
};

export type GameSession = {
	idGame: string;
	playerIndices: string[];
	sessionIds: Map<string, string>;
	submissions: Map<string, { ships: ShipSpec[] }>;
	state: 'waiting_ships' | 'active' | 'finished';
	startingSessionId?: string;
	currentTurn?: string; // session id whose turn it is
	botSessionId?: string; // present for single play
	boardBySession: Map<
		string,
		{
			occupied: Set<string>;
			shipCells: Map<string, string>; // cell -> shipId
			shipCellsLeft: Map<string, number>; // shipId -> remaining cells
			shots: Set<string>; // cells already shot at this board
		}
	>;
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
	const game: GameSession = {
		idGame,
		playerIndices: [...room.userIndices],
		sessionIds,
		submissions: new Map(),
		state: 'waiting_ships',
		boardBySession: new Map(),
	};
	games.set(idGame, game);
	return game;
}

export function getSessionIdForPlayer(game: GameSession, playerIndex: string): string {
	return game.sessionIds.get(playerIndex)!;
}

export type ShipSpec = {
	position: { x: number; y: number };
	direction: boolean;
	length: number;
	type: 'small' | 'medium' | 'large' | 'huge';
};

export function getGame(idGame: string): GameSession | undefined {
	return games.get(idGame);
}

export function trySubmitShips(
	game: GameSession,
	sessionId: string,
	ships: ShipSpec[]
): { ok: true; ready: boolean } | { ok: false; error: string } {
	if (game.state !== 'waiting_ships') return { ok: false, error: 'Game is not accepting ships' };
	if (!Array.isArray(ships) || ships.length === 0) return { ok: false, error: 'Ships are required' };
	const val = validateShips(ships);
	if (!val.ok) return { ok: false, error: val.error };
	game.submissions.set(sessionId, { ships });
	// build board snapshot for this session
	if (!game.boardBySession) game.boardBySession = new Map();
	const board = buildBoard(ships);
	game.boardBySession.set(sessionId, board);
	const ready = game.submissions.size === 2;
	if (ready) {
		game.state = 'active';
		const [a, b] = Array.from(game.submissions.keys()).sort();
		game.startingSessionId = a;
		game.currentTurn = a;
	}
	return { ok: true, ready };
}

function validateShips(ships: ShipSpec[]): { ok: true } | { ok: false; error: string } {
	// fleet composition: huge(4)=1, large(3)=2, medium(2)=3, small(1)=4
	const expected: Record<ShipSpec['type'], { length: number; count: number }> = {
		huge: { length: 4, count: 1 },
		large: { length: 3, count: 2 },
		medium: { length: 2, count: 3 },
		small: { length: 1, count: 4 },
	};
	const seen: Record<ShipSpec['type'], number> = { huge: 0, large: 0, medium: 0, small: 0 };

	const occupied = new Set<string>();
	const neighbor = new Set<string>();
	for (const s of ships) {
		if (!(s.type in expected)) return { ok: false, error: 'Unknown ship type' };
		const exp = expected[s.type];
		if (!Number.isInteger(s.length) || s.length <= 0) return { ok: false, error: 'Invalid ship length' };
		if (s.length !== exp.length) return { ok: false, error: `Invalid length for ${s.type}` };
		seen[s.type] += 1;
		const dx = s.direction ? 1 : 0;
		const dy = s.direction ? 0 : 1;
		const cells: Array<[number, number]> = [];
		for (let i = 0; i < s.length; i++) {
			const x = s.position.x + dx * i;
			const y = s.position.y + dy * i;
			if (x < 0 || x > 9 || y < 0 || y > 9) return { ok: false, error: 'Ship out of board' };
			cells.push([x, y]);
		}
		for (const [x, y] of cells) {
			const key = `${x},${y}`;
			if (occupied.has(key) || neighbor.has(key)) return { ok: false, error: 'Ships overlap or touch' };
		}
		for (const [x, y] of cells) {
			const key = `${x},${y}`;
			occupied.add(key);
			for (let nx = x - 1; nx <= x + 1; nx++) {
				for (let ny = y - 1; ny <= y + 1; ny++) {
					if (nx < 0 || nx > 9 || ny < 0 || ny > 9) continue;
					const nk = `${nx},${ny}`;
					if (!occupied.has(nk)) neighbor.add(nk);
				}
			}
		}
	}
	// verify counts
	for (const t of Object.keys(expected) as Array<ShipSpec['type']>) {
		if (seen[t] !== expected[t].count) {
			return { ok: false, error: `Invalid number of ${t} ships` };
		}
	}
	return { ok: true };
}

function buildBoard(ships: ShipSpec[]) {
	const occupied = new Set<string>();
	const shipCells = new Map<string, string>();
	const shipCellsLeft = new Map<string, number>();
	let sid = 1;
	for (const s of ships) {
		const id = String(sid++);
		const dx = s.direction ? 1 : 0;
		const dy = s.direction ? 0 : 1;
		for (let i = 0; i < s.length; i++) {
			const x = s.position.x + dx * i;
			const y = s.position.y + dy * i;
			const key = `${x},${y}`;
			occupied.add(key);
			shipCells.set(key, id);
		}
		shipCellsLeft.set(id, s.length);
	}
	return { occupied, shipCells, shipCellsLeft, shots: new Set<string>() };
}

export function createSinglePlayGame(humanPlayerIndex: string): GameSession {
	const idGame = String(nextGameId++);
	const sessionIds = new Map<string, string>();
	// one human and one pseudo player index 'BOT'
	const botPlayerIndex = `BOT:${idGame}`;
	sessionIds.set(humanPlayerIndex, `${idGame}:1`);
	sessionIds.set(botPlayerIndex, `${idGame}:2`);
	const game: GameSession = {
		idGame,
		playerIndices: [humanPlayerIndex, botPlayerIndex],
		sessionIds,
		submissions: new Map(),
		state: 'waiting_ships',
		boardBySession: new Map(),
		botSessionId: `${idGame}:2`,
	};
	// generate bot fleet and submit immediately
	const botFleet = generateFleet();
	const botBoard = buildBoard(botFleet);
	const botSid = game.botSessionId!;
	game.boardBySession.set(botSid, botBoard);
	game.submissions.set(botSid, { ships: botFleet });
	games.set(idGame, game);
	return game;
}

export function generateFleet(): ShipSpec[] {
	// Try random placements until a valid fleet is built; simple backtracking
	const expected: Array<{ type: ShipSpec['type']; length: number; count: number }> = [
		{ type: 'huge', length: 4, count: 1 },
		{ type: 'large', length: 3, count: 2 },
		{ type: 'medium', length: 2, count: 3 },
		{ type: 'small', length: 1, count: 4 },
	];
	while (true) {
		const ships: ShipSpec[] = [];
		let ok = true;
		for (const spec of expected) {
			for (let n = 0; n < spec.count; n++) {
				let placed = false;
				for (let tries = 0; tries < 200 && !placed; tries++) {
					const direction = Math.random() < 0.5; // true: horizontal
					const maxX = direction ? 10 - spec.length : 9;
					const maxY = direction ? 9 : 10 - spec.length;
					const x = Math.floor(Math.random() * (maxX + 1));
					const y = Math.floor(Math.random() * (maxY + 1));
					const candidate: ShipSpec = { type: spec.type, length: spec.length, direction, position: { x, y } };
					if (validateShips([...ships, candidate]).ok) {
						ships.push(candidate);
						placed = true;
					}
				}
				if (!placed) {
					ok = false;
					break;
				}
			}
			if (!ok) break;
		}
		if (ok && validateShips(ships).ok) return ships;
	}
}
export function applyAttack(
	game: GameSession,
	attackerSession: string,
	targetX: number,
	targetY: number
): { status: 'miss' | 'shot' | 'killed'; nextTurn: string; killedCells?: Array<{ x: number; y: number }>; missAround?: Array<{ x: number; y: number }> } | { error: string } {
	if (game.state !== 'active') return { error: 'Game is not active' };
	if (game.currentTurn !== attackerSession) return { error: 'Not your turn' };
	// defender is the other session
	const sessions = Array.from(game.submissions.keys());
	const defenderSession = sessions.find((s) => s !== attackerSession)!;
	const board = game.boardBySession.get(defenderSession)!;
	const key = `${targetX},${targetY}`;
	if (board.shots.has(key)) return { error: 'Cell already shot' };
	board.shots.add(key);
	if (!board.occupied.has(key)) {
		// miss, change turn
		const nextTurn = defenderSession;
		game.currentTurn = nextTurn;
		return { status: 'miss', nextTurn };
	}
	// hit
	const shipId = board.shipCells.get(key)!;
	const left = (board.shipCellsLeft.get(shipId)! - 1);
	board.shipCellsLeft.set(shipId, left);
	if (left > 0) {
		// shot, keep turn
		return { status: 'shot', nextTurn: attackerSession };
	}
	// killed: compute cells of this ship and mark perimeter misses
	const killedCells: Array<{ x: number; y: number }> = [];
	for (const [cell, sid] of board.shipCells.entries()) {
		if (sid === shipId) {
			const [xStr, yStr] = cell.split(',');
			killedCells.push({ x: Number(xStr), y: Number(yStr) });
		}
	}
	const missAround: Array<{ x: number; y: number }> = [];
	for (const { x, y } of killedCells) {
		for (let nx = x - 1; nx <= x + 1; nx++) {
			for (let ny = y - 1; ny <= y + 1; ny++) {
				if (nx < 0 || nx > 9 || ny < 0 || ny > 9) continue;
				const nk = `${nx},${ny}`;
				if (!board.occupied.has(nk) && !board.shots.has(nk)) {
					board.shots.add(nk);
					missAround.push({ x: nx, y: ny });
				}
			}
		}
	}
	// check win (all ships killed)
	let anyLeft = false;
	for (const v of board.shipCellsLeft.values()) {
		if (v > 0) {
			anyLeft = true;
			break;
		}
	}
	if (!anyLeft) {
		game.state = 'finished';
		// attacker wins; turn remains attacker
		return { status: 'killed', nextTurn: attackerSession, killedCells, missAround };
	}
	// killed but game continues; attacker keeps turn
	return { status: 'killed', nextTurn: attackerSession, killedCells, missAround };
}



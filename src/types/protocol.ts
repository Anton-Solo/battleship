export type RegRequest = {
	type: 'reg';
	data: {
		name: string;
		password: string;
	};
	id: 0;
};

export type RegResponse = {
	type: 'reg';
	data: {
		name: string;
		index: string | number;
		error: boolean;
		errorText: string;
	};
	id: 0;
};

export type UpdateWinners = {
	type: 'update_winners';
	data: Array<{ name: string; wins: number }>;
	id: 0;
};

export type EnvelopeIn = RegRequest; 
export type EnvelopeOut = RegResponse | UpdateWinners | ErrorResponse;

export type ErrorResponse = {
	type: 'error';
	data: { error: true; code: string; errorText: string };
	id: 0;
};

export type CreateRoomRequest = {
	type: 'create_room';
	data: '';
	id: 0;
};

export type AddUserToRoomRequest = {
	type: 'add_user_to_room';
	data: { indexRoom: string | number };
	id: 0;
};

export type UpdateRoom = {
	type: 'update_room';
	data: Array<{
		roomId: string | number;
		roomUsers: Array<{ name: string; index: string | number }>;
	}>;
	id: 0;
};

export type CreateGame = {
	type: 'create_game';
	data: { idGame: string | number; idPlayer: string | number };
	id: 0;
};

export type EnvelopeInRooms = CreateRoomRequest | AddUserToRoomRequest;
export type EnvelopeOutRooms = UpdateRoom | CreateGame;

// Ships / Game start
export type Ship = {
	position: { x: number; y: number };
	direction: boolean; // false: vertical, true: horizontal
	length: number;
	type: 'small' | 'medium' | 'large' | 'huge';
};

export type AddShipsRequest = {
	type: 'add_ships';
	data: {
		gameId: string | number;
		ships: Ship[];
		indexPlayer: string | number; // session id in current game
	};
	id: 0;
};

export type StartGame = {
	type: 'start_game';
	data: {
		ships: Ship[]; // player's own ships
		currentPlayerIndex: string | number; // the sender's session id (per spec)
	};
	id: 0;
};

export type Turn = {
	type: 'turn';
	data: { currentPlayer: string | number };
	id: 0;
};

export type EnvelopeInShips = AddShipsRequest;
export type EnvelopeOutShips = StartGame | Turn;

// unified envelopes are declared at the end to include all extensions

// Combat
export type AttackRequest = {
	type: 'attack';
	data: {
		gameId: string | number;
		x: number;
		y: number;
		indexPlayer: string | number; // session id (attacker)
	};
	id: 0;
};

export type RandomAttackRequest = {
	type: 'randomAttack';
	data: {
		gameId: string | number;
		indexPlayer: string | number; // session id (attacker)
	};
	id: 0;
};

export type AttackResponse = {
	type: 'attack';
	data: {
		position: { x: number; y: number };
		currentPlayer: string | number; // session id who should shoot now
		status: 'miss' | 'killed' | 'shot';
	};
	id: 0;
};

export type Finish = {
	type: 'finish';
	data: { winPlayer: string | number };
	id: 0;
};

export type EnvelopeInCombat = AttackRequest | RandomAttackRequest;
export type EnvelopeOutCombat = AttackResponse | Finish;

export type EnvelopeOutAll = EnvelopeOut | EnvelopeOutRooms | EnvelopeOutShips | EnvelopeOutCombat;

// Single play (optional)
export type SinglePlayRequest = {
	type: 'single_play';
	data: '';
	id: 0;
};

export type EnvelopeInSingle = SinglePlayRequest;
export type EnvelopeInAll = EnvelopeIn | EnvelopeInRooms | EnvelopeInShips | EnvelopeInCombat | EnvelopeInSingle;


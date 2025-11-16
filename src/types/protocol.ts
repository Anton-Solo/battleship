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

export type EnvelopeInAll = EnvelopeIn | EnvelopeInRooms;
export type EnvelopeOutAll = EnvelopeOut | EnvelopeOutRooms;



import { Ship, Position, AttackStatus } from './game.types';

export enum CommandType {
  REG = 'reg',
  UPDATE_WINNERS = 'update_winners',
  CREATE_ROOM = 'create_room',
  ADD_USER_TO_ROOM = 'add_user_to_room',
  CREATE_GAME = 'create_game',
  UPDATE_ROOM = 'update_room',
  ADD_SHIPS = 'add_ships',
  START_GAME = 'start_game',
  SINGLE_PLAY = 'single_play',
  ATTACK = 'attack',
  RANDOM_ATTACK = 'randomAttack',
  TURN = 'turn',
  FINISH = 'finish',
}

export interface BaseCommand<TData = any> {
  type: CommandType;
  id: number;
  data: TData;
}

export interface RegRequestData {
  name: string;
  password: string;
}
export interface RegRequest extends BaseCommand<RegRequestData> {
  type: CommandType.REG;
}

export interface RegResponseData {
  name?: string;
  index?: number | string;
  error: boolean;
  errorText: string;
}

export interface RegResponse extends BaseCommand<RegResponseData> {
  type: CommandType.REG;
}

export interface WinnerInfo {
  name: string;
  wins: number;
}

export type UpdateWinnersData = WinnerInfo[];

export interface UpdateWinnersResponse extends BaseCommand<UpdateWinnersData> {
  type: CommandType.UPDATE_WINNERS;
}

export interface CreateRoomRequest extends BaseCommand<string> {
  type: CommandType.CREATE_ROOM;
}

export interface AddUserToRoomRequestData {
  indexRoom: number | string;
}
export interface AddUserToRoomRequest extends BaseCommand<AddUserToRoomRequestData> {
  type: CommandType.ADD_USER_TO_ROOM;
}

export interface CreateGameResponseData {
  idGame: number | string;
  idPlayer: number | string;
}
export interface CreateGameResponse extends BaseCommand<CreateGameResponseData> {
  type: CommandType.CREATE_GAME;
}

export interface RoomUserInfo {
  name: string;
  index: number | string;
}

export interface RoomInfo {
  roomId: number | string;
  roomUsers: RoomUserInfo[];
}

export type UpdateRoomData = RoomInfo[];

export interface UpdateRoomResponse extends BaseCommand<UpdateRoomData> {
  type: CommandType.UPDATE_ROOM;
}

export interface AddShipsRequestData {
  gameId: number | string;
  ships: Ship[];
  indexPlayer: number | string;
}
export interface AddShipsRequest extends BaseCommand<AddShipsRequestData> {
  type: CommandType.ADD_SHIPS;
}

export interface StartGameData {
  ships: Ship[];
  currentPlayerIndex: number | string;
}
export interface StartGameResponse extends BaseCommand<StartGameData> {
  type: CommandType.START_GAME;
}

export interface AttackRequestData {
  gameId: number | string;
  x: number;
  y: number;
  indexPlayer: number | string;
}
export interface AttackRequest extends BaseCommand<AttackRequestData> {
  type: CommandType.ATTACK;
}

export interface AttackResponseData {
  position: Position;
  currentPlayer: number | string;
  status: AttackStatus;
}
export interface AttackResponse extends BaseCommand<AttackResponseData> {
  type: CommandType.ATTACK;
}

export interface RandomAttackRequestData {
  gameId: number | string;
  indexPlayer: number | string;
}
export interface RandomAttackRequest extends BaseCommand<RandomAttackRequestData> {
  type: CommandType.RANDOM_ATTACK;
}

export interface TurnResponseData {
  currentPlayer: number | string;
}
export interface TurnResponse extends BaseCommand<TurnResponseData> {
  type: CommandType.TURN;
}

export interface FinishResponseData {
  winPlayer: number | string;
}
export interface FinishResponse extends BaseCommand<FinishResponseData> {
  type: CommandType.FINISH;
}

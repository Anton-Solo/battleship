import { CommandType, User, CustomWebSocket, CommandHandler } from '../types/index';
import { UsersStore } from '../models/UsersStore';
import { RoomStore } from '../models/RoomStore';
import { GameStore } from '../models/GameStore';
import { RegistrationHandler } from './handlers/RegistrationHandler';
import { CreateRoomHandler } from './handlers/CreateRoomHandler';
import { AddUserToRoomHandler } from './handlers/AddUserToRoomHandler';
import { AddShipsHandler } from './handlers/AddShipsHandler';
import { AttackHandler } from './handlers/AttackHandler';
import { RandomAttackHandler } from './handlers/RandomAttackHandler';
import { wss } from '..';
import { sendResponse } from '../helpers/helpers';
import { Room } from '../models/Room';
import { SinglePlayHandler } from './handlers/SinglePlayHandler';

class GameController {
  private static instance: GameController;
  private readonly usersStore = UsersStore.getInstance();
  private readonly roomStore = RoomStore.getInstance();
  private readonly gameStore = GameStore.getInstance();
  private readonly handlers: Partial<Record<CommandType, CommandHandler>> = {};
  private constructor() {
    this.handlers[CommandType.REG] = new RegistrationHandler(this.usersStore, this.roomStore);
    this.handlers[CommandType.CREATE_ROOM] = new CreateRoomHandler(this.usersStore, this.roomStore);
    this.handlers[CommandType.ADD_USER_TO_ROOM] = new AddUserToRoomHandler(
      this.usersStore,
      this.roomStore,
      this.gameStore
    );
    this.handlers[CommandType.ADD_SHIPS] = new AddShipsHandler(this.gameStore);
    this.handlers[CommandType.ATTACK] = new AttackHandler(this.gameStore, this.usersStore);
    this.handlers[CommandType.RANDOM_ATTACK] = new RandomAttackHandler(
      this.gameStore,
      this.usersStore
    );
    this.handlers[CommandType.SINGLE_PLAY] = new SinglePlayHandler(
      this.usersStore,
      this.roomStore,
      this.gameStore
    );
  }

  public static getInstance(): GameController {
    if (!GameController.instance) {
      GameController.instance = new GameController();
    }
    return GameController.instance;
  }
  public handleCommand(
    ws: CustomWebSocket,
    command: CommandType,
    data: any,
    connectionId: string
  ): void {
    const handler = this.handlers[command];
    if (handler) {
      try {
        const result = handler.handle(ws, data, connectionId);
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error(
              `Error while processing command ${command} for connection ${connectionId}:`,
              error
            );
          });
        }
      } catch (error) {
        console.error(
          `Error when processing command ${command} for connection ${connectionId}:`,
          error
        );
      }
    } else {
      console.log(`No handler for command ${command}`);
    }
  }
  public handleDisconnect(connectionId: string): void {
    const user = this.usersStore.getUserById(connectionId);
    if (!user) return;

    this.usersStore.updateUser(connectionId, { ...user, isLogin: false });
    console.log(`User ${user.name} (${connectionId}) disconnected`);

    const room = this.roomStore.getRoomByUserId(connectionId);
    if (room) {
      const updatedRoom = new Room(
        room.id,
        room.players.filter((player) => player.index !== connectionId)
      );

      this.roomStore.updateRoom(room.id, updatedRoom);

      const availableRooms = this.roomStore
        .getAvailableRooms()
        .map((room) => room.toRoomResponse());
      Array.from(wss.clients).forEach((client) => {
        sendResponse(client, {
          type: CommandType.UPDATE_ROOM,
          data: availableRooms,
          id: 0,
        });
      });
    }

    const game = this.gameStore.getGameByPlayerId(connectionId);
    if (game) {
      const winner = game.players.find((playerId) => playerId !== connectionId);
      if (winner) {
        this.usersStore.updateWins(winner);

        game.players.forEach((playerId) => {
          const playerConnection = Array.from(wss.clients).find(
            (client) => client.connectionId === playerId
          );
          if (playerConnection) {
            sendResponse(playerConnection, {
              type: CommandType.FINISH,
              data: { winPlayer: winner },
              id: 0,
            });
          }
        });

        const winners = this.usersStore
          .getAllUsers()
          .sort((a, b) => b.wins - a.wins)
          .map((user) => ({
            name: user.name,
            wins: user.wins,
          }));

        Array.from(wss.clients).forEach((client) => {
          sendResponse(client, {
            type: CommandType.UPDATE_WINNERS,
            data: winners,
            id: 0,
          });
        });

        this.gameStore.removeGame(game.id);
        console.log(`Game ${game.id} finished. Winner: ${winner} (by disconnect)`);
      }
    }
  }
}

export const gameController = GameController.getInstance();

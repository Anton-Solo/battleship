import {
  CommandHandler,
  CommandType,
  CreateGameResponse,
  CustomWebSocket,
  UpdateRoomResponse,
} from '../../types/index';
import { UsersStore } from '../../models/UsersStore';
import { RoomStore } from '../../models/RoomStore';
import { GameStore } from '../../models/GameStore';
import { sendResponse } from '../../helpers/helpers';
import { wss } from '../../index';
import { v4 as uuidv4 } from 'uuid';
export class AddUserToRoomHandler implements CommandHandler {
  constructor(
    private readonly usersStore: UsersStore,
    private readonly roomStore: RoomStore,
    private readonly gameStore: GameStore
  ) {}

  public handle(ws: CustomWebSocket, data: any, connectionId: string): void {
    const { indexRoom } = data;
    const user = this.usersStore.getUserById(connectionId);

    if (!user) {
      console.log(
        `User not found ${JSON.stringify(connectionId)} in store: ${JSON.stringify(this.usersStore.getAllUsers())}`
      );
      return;
    }

    const room = this.roomStore.getRoom(indexRoom);
    if (
      room &&
      room.players &&
      room.players.findIndex((player) => player.index === connectionId) !== -1
    ) {
      console.log(`User ${user.name} try to join in his room: ${indexRoom}`);
      return;
    }

    const allRooms = this.roomStore.getAvailableRooms();

    console.log('all rooms: ', allRooms);
    let isNeedUpdate = false;
    allRooms.forEach((room) => {
      console.log('room: ', room);
      if (room.id.toString() !== indexRoom.toString()) {
        const isUserHere = room.players.findIndex((player) => player.index === connectionId);
        console.log('isUserHere: ', isUserHere);
        if (isUserHere !== -1) {
          room.players.splice(isUserHere, 1);
          console.log('room after delete: ', room);
          isNeedUpdate = true;
        }
      }
    });

    const updatedRoom = this.roomStore.addUserToRoom(indexRoom, user);
    if (updatedRoom) {
      if (updatedRoom.players.length === 2) {
        const gameId = uuidv4();
        this.gameStore.createGame(
          gameId,
          updatedRoom.players.map((player) => player.index)
        );
        updatedRoom.players.forEach((player) => {
          const playerConnection = Array.from(wss.clients).find(
            (client) => client.connectionId === player.index
          );
          if (playerConnection) {
            const response: CreateGameResponse = {
              type: CommandType.CREATE_GAME,
              data: {
                idGame: gameId,
                idPlayer: player.index,
              },
              id: 0,
            };
            sendResponse(playerConnection, response);
          }
        });

        this.roomStore.removeRoom(indexRoom);
      }
      this.broadcastRoomUpdate();
    } else {
      console.log(`Failed to add user ${user.name} to room ${indexRoom}`);
    }
  }
  private broadcastRoomUpdate(): void {
    const availableRooms = this.roomStore.getAvailableRooms().map((room) => room.toRoomResponse());
    const response: UpdateRoomResponse = {
      type: CommandType.UPDATE_ROOM,
      data: availableRooms,
      id: 0,
    };
    wss.clients.forEach((client) => {
      sendResponse(client, response);
    });
  }
}

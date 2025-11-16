import {
  CommandHandler,
  CommandType,
  CustomWebSocket,
  UpdateRoomResponse,
} from '../../types/index';
import { UsersStore } from '../../models/UsersStore';
import { RoomStore } from '../../models/RoomStore';
import { sendResponse } from '../../helpers/helpers';
import { wss } from '../../index';

export class CreateRoomHandler implements CommandHandler {
  constructor(
    private readonly usersStore: UsersStore,
    private readonly roomStore: RoomStore
  ) {}

  public handle(ws: CustomWebSocket, data: any, connectionId: string): void {
    const user = this.usersStore.getUserById(connectionId);
    if (!user) {
      console.log('User not found');
      return;
    }

    this.roomStore.createRoom();
    this.broadcastRoomUpdate();
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

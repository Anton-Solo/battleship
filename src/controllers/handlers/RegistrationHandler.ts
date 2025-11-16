import {
  CommandHandler,
  CommandType,
  CustomWebSocket,
  ErrorMsg,
  RegResponse,
} from '../../types/index';
import { UsersStore } from '../../models/UsersStore';
import { checkPassword } from '../../helpers/passwords';
import { sendResponse } from '../../helpers/helpers';
import { RoomStore } from '../../models/RoomStore';
import { wss } from '../..';

export class RegistrationHandler implements CommandHandler {
  constructor(
    private readonly usersStore: UsersStore,
    private readonly roomStore: RoomStore
  ) {}

  public async handle(ws: CustomWebSocket, data: any, connectionId: string): Promise<void> {
    const { name, password } = data;
    const errorMsg: ErrorMsg = {
      error: false,
      errorText: '',
    };
    const user = this.usersStore.getUserByName(name);
    if (!user) {
      const newUser = await this.usersStore.addUser(name, password, connectionId);
      console.log(`New user registered: ${newUser}`);
      const response: RegResponse = {
        type: CommandType.REG,
        data: {
          ...newUser,
          ...errorMsg,
        },
        id: 0,
      };
      sendResponse(ws, response);
      this.broadcastRoomUpdate(ws);
      this.sendWinners(ws);
      return;
    }

    const isPasswordCorrect = await checkPassword(password, user.hash);
    if (isPasswordCorrect && !user.isLogin) {
      const updatedUser = this.usersStore.updateUser(user.index, {
        ...user,
        index: connectionId,
        isLogin: true,
      });
      const response: RegResponse = {
        type: CommandType.REG,
        data: {
          ...updatedUser,
          ...errorMsg,
        },
        id: 0,
      };
      sendResponse(ws, response);
      this.broadcastRoomUpdate(ws);
      this.sendWinners(ws);
      return;
    }

    errorMsg.error = true;
    if (isPasswordCorrect && this.usersStore.isAlreadyLogin(user.name)) {
      errorMsg.errorText = 'User already exists';
    }
    if (!isPasswordCorrect) {
      errorMsg.errorText = 'Incorrect password';
    }
    const response: RegResponse = {
      type: CommandType.REG,
      data: {
        ...errorMsg,
      },
      id: 0,
    };
    sendResponse(ws, response);
  }

  private broadcastRoomUpdate(ws: CustomWebSocket): void {
    const availableRooms = this.roomStore.getAvailableRooms().map((room) => room.toRoomResponse());
    sendResponse(ws, {
      type: CommandType.UPDATE_ROOM,
      data: availableRooms,
      id: 0,
    });
  }

  private sendWinners(ws: CustomWebSocket): void {
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
  }
}

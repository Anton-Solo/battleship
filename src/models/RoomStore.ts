import { v4 as uuidv4 } from 'uuid';
import { Room } from './Room';
import { User } from '../types/index';
export class RoomStore {
  private static instance: RoomStore;
  private rooms: Room[] = [];
  private constructor() {}
  public static getInstance(): RoomStore {
    if (!RoomStore.instance) {
      RoomStore.instance = new RoomStore();
    }
    return RoomStore.instance;
  }

  public createRoom(): Room {
    const roomId = uuidv4();
    const room = new Room(roomId);
    this.rooms.push(room);
    return room;
  }
  public addUserToRoom(roomId: string, user: User): Room | null {
    const room = this.rooms.find((room) => room.id === roomId);
    if (!room) return null;
    if (room.addPlayer(user)) {
      return room;
    }
    return null;
  }
  public removeRoom(roomId: string): void {
    this.rooms = this.rooms.filter((room) => room.id !== roomId);
  }
  public getRoom(roomId: string): Room | null {
    return this.rooms.find((room) => room.id === roomId) || null;
  }
  public getAvailableRooms(): Room[] {
    return this.rooms.filter((room) => !room.isFull());
  }

  public getRoomByUserId(connectionId: string): Room | null {
    return (
      this.rooms.find((room) => room.players.some((player) => player.index === connectionId)) ||
      null
    );
  }

  public updateRoom(roomId: string, updatedRoom: Room): void {
    const roomIndex = this.rooms.findIndex((room) => room.id === roomId);
    if (roomIndex !== -1) {
      this.rooms[roomIndex] = updatedRoom;
    }
  }
}

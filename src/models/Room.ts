import { User } from '../types/index';

export class Room {
  constructor(
    public id: string,
    public players: User[] = []
  ) {}
  public addPlayer(player: User): boolean {
    if (this.players.length >= 2) {
      return false;
    }
    this.players.push(player);
    return true;
  }
  public isFull(): boolean {
    return this.players.length === 2;
  }
  public toRoomResponse() {
    return {
      roomId: this.id,
      roomUsers: this.players.map((player) => ({
        name: player.name,
        index: player.index,
      })),
    };
  }
}

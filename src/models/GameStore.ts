import { Game } from './Game';

export class GameStore {
  private static instance: GameStore;
  private games: Game[] = [];

  private constructor() {}

  public static getInstance(): GameStore {
    if (!GameStore.instance) {
      GameStore.instance = new GameStore();
    }
    return GameStore.instance;
  }

  public createGame(gameId: string, players: string[]): Game {
    const game = new Game(gameId, players);
    this.games.push(game);
    return game;
  }

  public getGame(gameId: string): Game | null {
    return this.games.find((game) => game.id === gameId) || null;
  }

  public removeGame(gameId: string): void {
    this.games = this.games.filter((game) => game.id !== gameId);
  }

  public getGameByPlayerId(connectionId: string): Game | null {
    return (
      this.games.find((game) => game.players.some((player) => player === connectionId)) || null
    );
  }
}

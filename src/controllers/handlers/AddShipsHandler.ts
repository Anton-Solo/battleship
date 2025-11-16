import { CommandHandler, CommandType, CustomWebSocket, StartGameResponse } from '../../types/index';
import { GameStore } from '../../models/GameStore';
import { sendResponse } from '../../helpers/helpers';
import { wss } from '../../index';
export class AddShipsHandler implements CommandHandler {
  constructor(private readonly gameStore: GameStore) {}

  public handle(ws: CustomWebSocket, data: any, connectionId: string): void {
    const { gameId, ships, indexPlayer } = data;

    const game = this.gameStore.getGame(gameId);
    if (!game) {
      console.log(`Game ${gameId} not found when adding ships.`);
      return;
    }
    if (!game.players.includes(indexPlayer)) {
      console.log(`Player ${indexPlayer} is not a member of game ${gameId}.`);
      return;
    }

    game.addShips(indexPlayer, ships);

    if (game.isReady()) {
      const firstPlayerId = game.players[0];

      game.players.forEach((playerId) => {
        const playerConnection = Array.from(wss.clients).find(
          (client) => client.connectionId === playerId
        );
        if (playerConnection) {
          const gameStartResponse: StartGameResponse = {
            type: CommandType.START_GAME,
            data: {
              ships: game.getPlayerShips(playerId),
              currentPlayerIndex: firstPlayerId,
            },
            id: 0,
          };
          sendResponse(playerConnection, gameStartResponse);
        }
      });
      console.log(`Game ${gameId} is ready to start. The first move is for ${firstPlayerId}.`);
    }
  }
}

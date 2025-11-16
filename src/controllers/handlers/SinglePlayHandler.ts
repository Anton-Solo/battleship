import { v4 as uuidv4 } from 'uuid';
import {
  AttackStatus,
  CommandHandler,
  CommandType,
  CustomWebSocket,
  Ship,
} from '../../types/index';
import { UsersStore } from '../../models/UsersStore';
import { RoomStore } from '../../models/RoomStore';
import { GameStore } from '../../models/GameStore';
import { sendResponse } from '../../helpers/helpers';
import { getPredefinedField } from '../../data/mock';
import { RandomAttackHandler } from './RandomAttackHandler';

export class SinglePlayHandler implements CommandHandler {
  private readonly randomAttackHandler: RandomAttackHandler;

  constructor(
    private readonly usersStore: UsersStore,
    private readonly roomStore: RoomStore,
    private readonly gameStore: GameStore
  ) {
    this.randomAttackHandler = new RandomAttackHandler(this.gameStore, this.usersStore);
  }

  public handle(ws: CustomWebSocket, data: any, userId: string): void {
    const botId = uuidv4();
    this.usersStore.addBot(botId);

    const gameId = uuidv4();
    this.gameStore.createGame(gameId, [userId, botId]);

    sendResponse(ws, {
      type: CommandType.CREATE_GAME,
      data: {
        idGame: gameId,
        idPlayer: userId,
      },
      id: 0,
    });

    const botShips = getPredefinedField();
    const game = this.gameStore.getGame(gameId);
    if (!game) return;

    game.addShips(botId, botShips);

    game.onTurnChange = (currentPlayerId) => {
      if (currentPlayerId === botId) {
        this.handleBotTurn(ws, gameId, botId);
      }
    };
  }

  private handleBotTurn(ws: CustomWebSocket, gameId: string, botId: string): void {
    setTimeout(() => {
      const game = this.gameStore.getGame(gameId);
      if (!game) return;

      this.randomAttackHandler.handle(ws, { gameId, indexPlayer: botId }, botId);

      const currentGame = this.gameStore.getGame(gameId);
      if (currentGame && currentGame.currentPlayerId === botId) {
        setTimeout(() => {
          this.handleBotTurn(ws, gameId, botId);
        }, 1000);
      }
    }, 1000);
  }
}

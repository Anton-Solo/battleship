import {
  CommandHandler,
  CommandType,
  CustomWebSocket,
  RandomAttackRequestData,
  AttackResponse,
  AttackResponseData,
  TurnResponse,
  TurnResponseData,
  FinishResponse,
  FinishResponseData,
  AttackStatus,
  AttackResult,
  Position,
} from '../../types/index';
import { GameStore } from '../../models/GameStore';
import { UsersStore } from '../../models/UsersStore';
import { sendResponse } from '../../helpers/helpers';
import { wss } from '../../index';
import { Game } from '../../models/Game';

export class RandomAttackHandler implements CommandHandler {
  constructor(
    private readonly gameStore: GameStore,
    private readonly usersStore: UsersStore
  ) {}

  private generateRandomPosition(game: Game, indexPlayer: string): Position {
    const attackerHits = game.hitsByPlayer.get(indexPlayer)!;
    const attackerKilled = game.killedByPlayer.get(indexPlayer)!;
    const attackerMisses = game.missesByPlayer.get(indexPlayer)!;

    let position: Position;
    let isValidPosition = false;

    while (!isValidPosition) {
      position = {
        x: Math.floor(Math.random() * 10),
        y: Math.floor(Math.random() * 10),
      };

      const isAlreadyHit = attackerHits.some((p) => p.x === position.x && p.y === position.y);
      const isAlreadyKilled = attackerKilled.some((p) => p.x === position.x && p.y === position.y);
      const isAlreadyMissed = attackerMisses.some((p) => p.x === position.x && p.y === position.y);

      if (!isAlreadyHit && !isAlreadyKilled && !isAlreadyMissed) {
        isValidPosition = true;
        return position;
      }
    }
    return {
      x: Math.floor(Math.random() * 10),
      y: Math.floor(Math.random() * 10),
    };
  }
  public handle(ws: CustomWebSocket, data: RandomAttackRequestData, connectionId: string): void {
    const { gameId, indexPlayer } = data;
    const game = this.gameStore.getGame(gameId.toString());
    if (!game) {
      console.error(`RandomAttackHandler: Game ${gameId} not found.`);
      return;
    }
    if (game.currentPlayerId !== indexPlayer) {
      console.error(`RandomAttackHandler: Not player ${indexPlayer}'s turn in game ${gameId}.`);
      return;
    }

    const position = this.generateRandomPosition(game, indexPlayer);
    const attackResult: AttackResult = game.performAttack(indexPlayer, position);

    game.players.forEach((playerId) => {
      const playerConnection = Array.from(wss.clients).find(
        (client) => client.connectionId === playerId
      );
      if (playerConnection) {
        const attackResponseData: AttackResponseData = {
          position: position,
          currentPlayer: indexPlayer,
          status: attackResult.status,
        };
        const response: AttackResponse = {
          type: CommandType.ATTACK,
          id: 0,
          data: attackResponseData,
        };
        sendResponse(playerConnection, response);
      }
    });
    if (attackResult.isGameOver && attackResult.winnerId) {
      const winnerId = attackResult.winnerId;
      this.usersStore.updateWins(winnerId);
      game.players.forEach((playerId) => {
        const playerConnection = Array.from(wss.clients).find(
          (client) => client.connectionId === playerId
        );
        if (playerConnection) {
          const finishResponseData: FinishResponseData = {
            winPlayer: winnerId,
          };
          const finishResponse: FinishResponse = {
            type: CommandType.FINISH,
            id: 0,
            data: finishResponseData,
          };
          sendResponse(playerConnection, finishResponse);
        }
      });
      this.gameStore.removeGame(gameId.toString());
      console.log(`Game ${gameId} finished. Winner: ${winnerId}`);

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
      return;
    }

    let nextPlayerId: string;
    if (attackResult.status === AttackStatus.MISS || attackResult.isSwitchPlayer) {
      game.switchPlayer();
      nextPlayerId = game.currentPlayerId;
      console.log(`Game ${game.id}: Turn switched to player ${nextPlayerId} after a miss.`);
    } else {
      nextPlayerId = indexPlayer;
      console.log(
        `Game ${game.id}: Player ${nextPlayerId} continues turn after a ${attackResult.status}.`
      );
    }
    game.players.forEach((playerId) => {
      const playerConnection = Array.from(wss.clients).find(
        (client) => client.connectionId === playerId
      );
      if (playerConnection) {
        const turnResponseData: TurnResponseData = {
          currentPlayer: nextPlayerId,
        };
        const turnResponse: TurnResponse = {
          type: CommandType.TURN,
          id: 0,
          data: turnResponseData,
        };
        sendResponse(playerConnection, turnResponse);
      }
    });
    console.log(`Game ${gameId}: Turn switched to player ${nextPlayerId}`);
  }
}
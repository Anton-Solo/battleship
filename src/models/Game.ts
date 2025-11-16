import { Ship, Position, AttackStatus, AttackResult } from '../types/index';
export class Game {
  public ships: Map<string, Ship[]> = new Map();
  public currentPlayerId: string;
  public hitsByPlayer: Map<string, Position[]> = new Map();
  public missesByPlayer: Map<string, Position[]> = new Map();
  public killedByPlayer: Map<string, Position[]> = new Map();
  public onTurnChange?: (currentPlayerId: string) => void;

  constructor(
    public id: string,
    public players: string[]
  ) {
    this.currentPlayerId = this.players[0];
    this.players.forEach((playerId) => {
      this.hitsByPlayer.set(playerId, []);
      this.missesByPlayer.set(playerId, []);
      this.killedByPlayer.set(playerId, []);
    });
  }
  public addShips(playerId: string, ships: Ship[]): void {
    this.ships.set(playerId, ships);
  }
  public isReady(): boolean {
    return this.players.every((playerId) => this.ships.has(playerId));
  }
  public getPlayerShips(playerId: string): Ship[] {
    return this.ships.get(playerId) || [];
  }
  private getShipCells(ship: Ship): Position[] {
    const cells: Position[] = [];
    for (let i = 0; i < ship.length; i++) {
      if (ship.direction) {
        cells.push({ x: ship.position.x, y: ship.position.y + i });
      } else {
        cells.push({ x: ship.position.x + i, y: ship.position.y });
      }
    }
    return cells;
  }
  public performAttack(attackerId: string, coords: Position): AttackResult {
    const defenderId = this.players.find((p) => p !== attackerId);
    if (!defenderId) {
      console.error(`Game ${this.id}: Defender not found for attacker ${attackerId}.`);
      return { status: AttackStatus.MISS, isGameOver: false };
    }
    const defenderShips = this.ships.get(defenderId);
    if (!defenderShips || defenderShips.length === 0) {
      console.error(`Game ${this.id}: Ships for defender ${defenderId} not found or empty.`);
      return { status: AttackStatus.MISS, isGameOver: false };
    }

    const attackerHits = this.hitsByPlayer.get(attackerId)!;
    const attackerKilled = this.killedByPlayer.get(attackerId)!;
    const attackerMisses = this.missesByPlayer.get(attackerId)!;

    const alreadyKilled = attackerKilled.some((p) => p.x === coords.x && p.y === coords.y);
    if (alreadyKilled) {
      return { status: AttackStatus.KILLED, isGameOver: false, isSwitchPlayer: true };
    }

    const alreadyHit = attackerHits.some((p) => p.x === coords.x && p.y === coords.y);
    if (alreadyHit) {
      return { status: AttackStatus.SHOT, isGameOver: false, isSwitchPlayer: true };
    }

    const alreadyMissed = attackerMisses.some((p) => p.x === coords.x && p.y === coords.y);
    if (alreadyMissed) {
      return { status: AttackStatus.MISS, isGameOver: false, isSwitchPlayer: true };
    }

    for (const ship of defenderShips) {
      const shipCells = this.getShipCells(ship);
      const isHitOnThisShip = shipCells.some((cell) => cell.x === coords.x && cell.y === coords.y);

      if (isHitOnThisShip) {
        attackerHits.push(coords);

        const isSunk = shipCells.every((cell) =>
          attackerHits.some((hit) => hit.x === cell.x && hit.y === cell.y)
        );

        if (isSunk) {
          shipCells.forEach((cell) => {
            attackerHits.splice(
              attackerHits.findIndex((hit) => hit.x === cell.x && hit.y === cell.y),
              1
            );
            if (!attackerKilled.some((killed) => killed.x === cell.x && killed.y === cell.y)) {
              attackerKilled.push(cell);
            }
          });

          const allDefenderShipsSunk = defenderShips.every((s) =>
            this.getShipCells(s).every((cell) =>
              attackerKilled.some((killed) => killed.x === cell.x && killed.y === cell.y)
            )
          );

          if (allDefenderShipsSunk) {
            return {
              status: AttackStatus.KILLED,
              isGameOver: true,
              winnerId: attackerId,
            };
          }
          return { status: AttackStatus.KILLED, isGameOver: false, isSwitchPlayer: false };
        }
        return { status: AttackStatus.SHOT, isGameOver: false, isSwitchPlayer: false };
      }
    }

    attackerMisses.push(coords);
    return { status: AttackStatus.MISS, isGameOver: false, isSwitchPlayer: true };
  }

  public switchPlayer(): void {
    const currentPlayerIndex = this.players.indexOf(this.currentPlayerId);
    const nextPlayerIndex = (currentPlayerIndex + 1) % this.players.length;
    this.currentPlayerId = this.players[nextPlayerIndex];
    if (this.onTurnChange) {
      this.onTurnChange(this.currentPlayerId);
    }
  }
}

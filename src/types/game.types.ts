export type ShipType = 'small' | 'medium' | 'large' | 'huge';

export interface Position {
  x: number;
  y: number;
}

export interface Ship {
  position: Position;
  direction: boolean;
  length: number;
  type: ShipType;
}

export enum AttackStatus {
  MISS = 'miss',
  SHOT = 'shot',
  KILLED = 'killed',
}

export type AttackResult = {
  status: AttackStatus;
  isGameOver: boolean;
  winnerId?: string;
  isSwitchPlayer?: boolean;
};

/**
 * Action History Tracker
 * 
 * Tracks game actions for undo functionality.
 * Records what action was taken and provides context for undo.
 * 
 * @file action-history.ts
 */

import { GameState } from './state-manager';

/**
 * Types of actions that can be undone
 */
export enum ActionType {
  MOVE = 'move',
  ATTACK = 'attack',
  ABILITY = 'ability',
  SUMMON = 'summon',
  UPGRADE = 'upgrade',
  END_TURN = 'end_turn',
  UNKNOWN = 'unknown'
}

/**
 * Action record for history tracking
 */
export interface ActionRecord {
  /** Unique action ID */
  id: string;
  
  /** Type of action performed */
  type: ActionType;
  
  /** Player who performed the action */
  playerId: string;
  
  /** Unit/creature that performed the action */
  actorId?: string;
  
  /** Target of the action (if any) */
  targetId?: string;
  
  /** Position where action occurred */
  position?: {
    x: number;
    y: number;
  };
  
  /** Action details/parameters */
  details?: any;
  
  /** Timestamp when action was performed */
  timestamp: number;
  
  /** Game state snapshot before action */
  previousState?: GameState;
  
  /** Description of action for UI */
  description: string;
}

/**
 * Action History Class
 * 
 * Maintains history of game actions for undo functionality.
 */
export class ActionHistory {
  private history: ActionRecord[];
  private maxHistorySize: number;
  private currentRound: number;

  constructor(maxHistorySize: number = 10) {
    this.history = [];
    this.maxHistorySize = maxHistorySize;
    this.currentRound = 1;
  }

  /**
   * Record a new action
   * Called before executing any action
   */
  public recordAction(
    type: ActionType,
    playerId: string,
    actorId?: string,
    targetId?: string,
    position?: { x: number; y: number },
    details?: any,
    description?: string
  ): ActionRecord {
    const action: ActionRecord = {
      id: this.generateActionId(),
      type,
      playerId,
      actorId,
      targetId,
      position,
      details,
      timestamp: Date.now(),
      description: description || this.generateDescription(type, actorId, targetId, position)
    };
    
    console.log('[ActionHistory] Recording action:', action.type, action.description);
    
    // Add to history
    this.history.push(action);
    
    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift(); // Remove oldest
    }
    
    return action;
  }

  /**
   * Get the last action (for undo)
   */
  public getLastAction(): ActionRecord | null {
    if (this.history.length === 0) {
      return null;
    }
    return this.history[this.history.length - 1];
  }

  /**
   * Get action by ID
   */
  public getAction(actionId: string): ActionRecord | null {
    return this.history.find(a => a.id === actionId) || null;
  }

  /**
   * Get all actions in current round
   */
  public getCurrentRoundActions(): ActionRecord[] {
    // Return all actions since last round start
    return [...this.history];
  }

  /**
   * Clear history for new round
   * Called when round ends
   */
  public clearForNewRound(): void {
    console.log('[ActionHistory] Clearing history for new round');
    this.history = [];
    this.currentRound++;
  }

  /**
   * Clear all history
   * Called when game ends
   */
  public clearAll(): void {
    console.log('[ActionHistory] Clearing all history');
    this.history = [];
    this.currentRound = 1;
  }

  /**
   * Check if undo is available
   */
  public canUndo(): boolean {
    return this.history.length > 0;
  }

  /**
   * Get history size
   */
  public getSize(): number {
    return this.history.length;
  }

  /**
   * Get current round number
   */
  public getCurrentRound(): number {
    return this.currentRound;
  }

  /**
   * Get full history (for debugging)
   */
  public getHistory(): ActionRecord[] {
    return [...this.history];
  }

  /**
   * Generate unique action ID
   */
  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate human-readable action description
   */
  private generateDescription(
    type: ActionType,
    actorId?: string,
    targetId?: string,
    position?: { x: number; y: number }
  ): string {
    const actorName = actorId ? `Unit ${actorId.substr(0, 8)}` : 'Unknown';
    
    switch (type) {
      case ActionType.MOVE:
        return position 
          ? `${actorName} moved to (${position.x}, ${position.y})`
          : `${actorName} moved`;
      
      case ActionType.ATTACK:
        return targetId
          ? `${actorName} attacked ${targetId.substr(0, 8)}`
          : `${actorName} attacked`;
      
      case ActionType.ABILITY:
        return targetId
          ? `${actorName} used ability on ${targetId.substr(0, 8)}`
          : `${actorName} used ability`;
      
      case ActionType.SUMMON:
        return position
          ? `${actorName} summoned unit at (${position.x}, ${position.y})`
          : `${actorName} summoned unit`;
      
      case ActionType.UPGRADE:
        return `${actorName} upgraded`;
      
      case ActionType.END_TURN:
        return `${actorName} ended turn`;
      
      default:
        return `${actorName} performed action`;
    }
  }

  /**
   * Serialize action for P2P sync
   */
  public serializeAction(action: ActionRecord): string {
    return JSON.stringify(action);
  }

  /**
   * Deserialize action from P2P sync
   */
  public deserializeAction(data: string): ActionRecord | null {
    try {
      const action: ActionRecord = JSON.parse(data);
      return action;
    } catch (error) {
      console.error('[ActionHistory] Failed to deserialize action:', error);
      return null;
    }
  }
}

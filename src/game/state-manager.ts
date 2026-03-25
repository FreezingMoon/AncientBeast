/**
 * Game State Manager
 * 
 * Handles saving and restoring game state for undo functionality.
 * Creates deep clones of game state to enable time reversal.
 * 
 * @file state-manager.ts
 */

import Game from '../game';
import { Creature } from '../creature';
import { Player } from '../player';

/**
 * Complete game state snapshot
 */
export interface GameState {
  // Game metadata
  turn: number;
  round: number;
  gamePhase: 'setup' | 'playing' | 'finished';
  currentPlayerId: string;
  
  // Player states
  players: PlayerState[];
  
  // Unit states
  units: UnitState[];
  
  // Board state
  hexes: HexState[];
  
  // Additional game data
  gameData: any;
  
  // Timestamp for debugging
  timestamp: number;
}

/**
 * Player state snapshot
 */
export interface PlayerState {
  id: string;
  name: string;
  team: number;
  flipped: boolean;
  
  // Resources
  resources: {
    plasma: number;
    energy: number;
    [key: string]: number;
  };
  
  // Units owned by this player
  unitIds: string[];
  
  // Player stats
  stats: {
    health: number;
    endurance: number;
    energy: number;
    [key: string]: number;
  };
}

/**
 * Unit/Creature state snapshot
 */
export interface UnitState {
  id: string;
  type: string;
  name: string;
  player: string;
  
  // Position
  x: number;
  y: number;
  
  // Stats
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  endurance: number;
  maxEndurance: number;
  
  // Status
  isDead: boolean;
  isReady: boolean;
  hasActed: boolean;
  remainingMove: number;
  
  // Abilities
  abilities: AbilityState[];
  
  // Effects/buffs/debuffs
  effects: EffectState[];
}

/**
 * Ability state snapshot
 */
export interface AbilityState {
  title: string;
  isUpgraded: boolean;
  cooldown: number;
  charges: number;
}

/**
 * Effect state snapshot
 */
export interface EffectState {
  title: string;
  turnLifetime: number;
  alterations: any;
}

/**
 * Hex state snapshot
 */
export interface HexState {
  x: number;
  y: number;
  terrainType: string;
  creatureId?: string;
  trapId?: string;
}

/**
 * State Manager Class
 * 
 * Manages game state snapshots for undo functionality.
 */
export class StateManager {
  private game: Game;
  private previousState?: GameState;
  private stateHistory: GameState[];
  private maxHistorySize: number;

  constructor(game: Game, maxHistorySize: number = 1) {
    this.game = game;
    this.previousState = undefined;
    this.stateHistory = [];
    this.maxHistorySize = maxHistorySize; // Only keep last state for undo (memory efficient)
  }

  /**
   * Save current game state
   * Called before executing any action
   */
  public saveState(): void {
    console.log('[StateManager] Saving game state...');
    
    try {
      // Create deep clone of current game state
      const currentState = this.captureGameState();
      
      // Store as previous state
      this.previousState = currentState;
      
      // Add to history (for potential multi-undo in future)
      this.stateHistory.push(currentState);
      
      // Limit history size to prevent memory issues
      if (this.stateHistory.length > this.maxHistorySize) {
        this.stateHistory.shift(); // Remove oldest
      }
      
      console.log('[StateManager] State saved successfully');
      console.log('[StateManager] Turn:', currentState.turn, 'Round:', currentState.round);
    } catch (error) {
      console.error('[StateManager] Failed to save state:', error);
      throw error;
    }
  }

  /**
   * Restore previous game state
   * Called when player triggers undo
   * @returns Restored game state or null if no state to restore
   */
  public restoreState(): GameState | null {
    console.log('[StateManager] Restoring game state...');
    
    if (!this.previousState) {
      console.warn('[StateManager] No previous state to restore');
      return null;
    }
    
    try {
      // Deep clone the previous state to avoid reference issues
      const stateToRestore = JSON.parse(JSON.stringify(this.previousState));
      
      // Apply restored state to game
      this.applyGameState(stateToRestore);
      
      console.log('[StateManager] State restored successfully');
      console.log('[StateManager] Turn:', stateToRestore.turn, 'Round:', stateToRestore.round);
      
      // Clear previous state after restore (can only undo once per round)
      this.clearPreviousState();
      
      return stateToRestore;
    } catch (error) {
      console.error('[StateManager] Failed to restore state:', error);
      throw error;
    }
  }

  /**
   * Check if state can be restored
   */
  public canRestore(): boolean {
    return this.previousState !== undefined;
  }

  /**
   * Clear previous state
   * Called after successful restore or when round ends
   */
  public clearPreviousState(): void {
    this.previousState = undefined;
    console.log('[StateManager] Previous state cleared');
  }

  /**
   * Clear all state history
   * Called when game ends or new match starts
   */
  public clearAll(): void {
    this.previousState = undefined;
    this.stateHistory = [];
    console.log('[StateManager] All state history cleared');
  }

  /**
   * Capture current game state into serializable format
   */
  private captureGameState(): GameState {
    const state: GameState = {
      turn: this.game.turn,
      round: this.game.round,
      gamePhase: this.game.gamePhase || 'playing',
      currentPlayerId: this.game.currentPlayerId || '',
      players: this.capturePlayers(),
      units: this.captureUnits(),
      hexes: this.captureHexes(),
      gameData: this.captureGameData(),
      timestamp: Date.now()
    };
    
    return state;
  }

  /**
   * Capture all player states
   */
  private capturePlayers(): PlayerState[] {
    const players: PlayerState[] = [];
    
    // Capture all players in game
    if (this.game.players) {
      for (const player of this.game.players) {
        players.push({
          id: player.id,
          name: player.name,
          team: player.team,
          flipped: player.flipped,
          resources: {
            plasma: player.plasma || 0,
            energy: player.energy || 0
          },
          unitIds: player.units ? player.units.map(u => u.id) : [],
          stats: {
            health: player.health || 0,
            endurance: player.endurance || 0,
            energy: player.energy || 0
          }
        });
      }
    }
    
    return players;
  }

  /**
   * Capture all unit/creature states
   */
  private captureUnits(): UnitState[] {
    const units: UnitState[] = [];
    
    // Capture all creatures in game
    if (this.game.creatures) {
      for (const creature of this.game.creatures) {
        units.push({
          id: creature.id,
          type: creature.type,
          name: creature.name,
          player: creature.player,
          x: creature.x,
          y: creature.y,
          health: creature.health,
          maxHealth: creature.maxHealth,
          energy: creature.energy,
          maxEnergy: creature.maxEnergy,
          endurance: creature.endurance,
          maxEndurance: creature.maxEndurance,
          isDead: creature.isDead,
          isReady: creature.isReady,
          hasActed: creature.hasActed,
          remainingMove: creature.remainingMove,
          abilities: this.captureAbilities(creature),
          effects: this.captureEffects(creature)
        });
      }
    }
    
    return units;
  }

  /**
   * Capture creature abilities
   */
  private captureAbilities(creature: Creature): AbilityState[] {
    const abilities: AbilityState[] = [];
    
    if (creature.abilities) {
      for (const ability of creature.abilities) {
        if (ability) {
          abilities.push({
            title: ability.title || '',
            isUpgraded: ability.isUpgraded || false,
            cooldown: ability.cooldown || 0,
            charges: ability.charges || 0
          });
        }
      }
    }
    
    return abilities;
  }

  /**
   * Capture creature effects
   */
  private captureEffects(creature: Creature): EffectState[] {
    const effects: EffectState[] = [];
    
    if (creature.effects) {
      for (const effect of creature.effects) {
        effects.push({
          title: effect.title || '',
          turnLifetime: effect.turnLifetime || 0,
          alterations: effect.alterations || {}
        });
      }
    }
    
    return effects;
  }

  /**
   * Capture hex/board states
   */
  private captureHexes(): HexState[] {
    const hexes: HexState[] = [];
    
    // Capture grid state if available
    if (this.game.grid) {
      // Iterate through grid hexes
      // This is simplified - actual implementation depends on grid structure
      const grid = this.game.grid;
      if (grid.hexes) {
        for (const hex of grid.hexes) {
          hexes.push({
            x: hex.x,
            y: hex.y,
            terrainType: hex.terrainType || 'normal',
            creatureId: hex.creature?.id,
            trapId: hex.trap?.id
          });
        }
      }
    }
    
    return hexes;
  }

  /**
   * Capture additional game data
   */
  private captureGameData(): any {
    // Capture any additional game-specific data
    // This can be extended based on game requirements
    return {
      // Add any additional game state here
      lastAction: this.game.lastAction,
      actionLog: this.game.actionLog
    };
  }

  /**
   * Apply restored state to game
   */
  private applyGameState(state: GameState): void {
    console.log('[StateManager] Applying restored state...');
    
    // Restore game metadata
    this.game.turn = state.turn;
    this.game.round = state.round;
    if (state.gamePhase) {
      this.game.gamePhase = state.gamePhase;
    }
    if (state.currentPlayerId) {
      this.game.currentPlayerId = state.currentPlayerId;
    }
    
    // Restore players
    this.restorePlayers(state.players);
    
    // Restore units
    this.restoreUnits(state.units);
    
    // Restore hexes/board
    this.restoreHexes(state.hexes);
    
    // Restore additional game data
    this.restoreGameData(state.gameData);
    
    console.log('[StateManager] Game state applied successfully');
  }

  /**
   * Restore player states
   */
  private restorePlayers(players: PlayerState[]): void {
    if (this.game.players) {
      for (const playerState of players) {
        const player = this.game.players.find(p => p.id === playerState.id);
        if (player) {
          player.plasma = playerState.resources.plasma;
          player.energy = playerState.resources.energy;
          player.health = playerState.stats.health;
          player.endurance = playerState.stats.endurance;
        }
      }
    }
  }

  /**
   * Restore unit/creature states
   */
  private restoreUnits(units: UnitState[]): void {
    if (this.game.creatures) {
      for (const unitState of units) {
        const creature = this.game.creatures.find(c => c.id === unitState.id);
        if (creature) {
          // Restore position
          creature.x = unitState.x;
          creature.y = unitState.y;
          
          // Restore stats
          creature.health = unitState.health;
          creature.maxHealth = unitState.maxHealth;
          creature.energy = unitState.energy;
          creature.maxEnergy = unitState.maxEnergy;
          creature.endurance = unitState.endurance;
          creature.maxEndurance = unitState.maxEndurance;
          
          // Restore status
          creature.isDead = unitState.isDead;
          creature.isReady = unitState.isReady;
          creature.hasActed = unitState.hasActed;
          creature.remainingMove = unitState.remainingMove;
          
          // Restore abilities and effects
          this.restoreAbilities(creature, unitState.abilities);
          this.restoreEffects(creature, unitState.effects);
        }
      }
    }
  }

  /**
   * Restore creature abilities
   */
  private restoreAbilities(creature: Creature, abilities: AbilityState[]): void {
    if (creature.abilities && abilities) {
      for (let i = 0; i < creature.abilities.length && i < abilities.length; i++) {
        const ability = creature.abilities[i];
        const abilityState = abilities[i];
        
        if (ability && abilityState) {
          ability.cooldown = abilityState.cooldown;
          ability.charges = abilityState.charges;
        }
      }
    }
  }

  /**
   * Restore creature effects
   */
  private restoreEffects(creature: Creature, effects: EffectState[]): void {
    // Clear current effects and restore from state
    if (creature.effects) {
      creature.effects = [];
      
      for (const effectState of effects) {
        // Recreate effects from state
        // This is simplified - actual implementation depends on effect system
        const effect = {
          title: effectState.title,
          turnLifetime: effectState.turnLifetime,
          alterations: effectState.alterations
        };
        creature.effects.push(effect);
      }
    }
  }

  /**
   * Restore hex/board states
   */
  private restoreHexes(hexes: HexState[]): void {
    if (this.game.grid && this.game.grid.hexes) {
      for (const hexState of hexes) {
        const hex = this.game.grid.hexes.find(h => h.x === hexState.x && h.y === hexState.y);
        if (hex) {
          // Restore hex state
          // This is simplified - actual implementation depends on grid structure
        }
      }
    }
  }

  /**
   * Restore additional game data
   */
  private restoreGameData(gameData: any): void {
    // Restore any additional game-specific data
    if (gameData) {
      if (gameData.lastAction !== undefined) {
        this.game.lastAction = gameData.lastAction;
      }
      if (gameData.actionLog !== undefined) {
        this.game.actionLog = gameData.actionLog;
      }
    }
  }

  /**
   * Get previous state (for debugging)
   */
  public getPreviousState(): GameState | undefined {
    return this.previousState;
  }

  /**
   * Get state history (for debugging)
   */
  public getStateHistory(): GameState[] {
    return [...this.stateHistory];
  }
}

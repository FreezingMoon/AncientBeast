/**
 * DemoMode.ts
 *
 * WHY: Issue #2976 requires a self-playing demo when the game is idle in kiosk mode.
 * This module implements:
 *   1. Idle detection with configurable timeout
 *   2. A cycling demo sequence manager
 *   3. Instant cancellation on user interaction
 *   4. Kiosk-mode guard so it never runs during normal play
 */

import Game from '../game';

/** Duration of inactivity (ms) before demo starts in kiosk mode */
const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

/** How long each demo slide / step is shown (ms) */
const DEMO_STEP_DURATION_MS = 8 * 1000; // 8 seconds per step

/**
 * A single step in the "How to Play" tutorial demo.
 * Each step carries a headline, body copy, and an optional highlight
 * selector so the UI layer can pulse the relevant element.
 */
export interface DemoStep {
  title: string;
  description: string;
  /** CSS selector of the element to highlight, if any */
  highlightSelector?: string;
}

/**
 * The built-in "How to Play" tutorial sequence.
 * Extend this array to add more steps without touching the engine.
 *
 * WHY separate data from logic: makes it easy for non-engineers to
 * add/edit tutorial content, and keeps DemoMode testable in isolation.
 */
export const HOW_TO_PLAY_STEPS: DemoStep[] = [
  {
    title: 'Welcome to Ancient Beast!',
    description:
      'Ancient Beast is a turn-based strategy game. Two players battle with fantastical creatures on a hex grid.',
    highlightSelector: '#background',
  },
  {
    title: 'Deploy Your Plasma',
    description:
      'At the start of your turn you spend plasma points to summon creatures. Choose wisely — each creature costs different amounts.',
    highlightSelector: '#plasma-display',
  },
  {
    title: 'Move & Position',
    description:
      'Click a creature to select it, then click a highlighted hex to move. Positioning is key to winning battles.',
    highlightSelector: '#grid',
  },
  {
    title: 'Use Abilities',
    description:
      'Each creature has unique abilities. Select a creature and click an ability button, then pick a valid target.',
    highlightSelector: '#abilities',
  },
  {
    title: 'End Your Turn',
    description:
      'Once you\'ve moved and used abilities, click "End Turn" to let your opponent play. First to eliminate all enemy creatures wins!',
    highlightSelector: '#endturn',
  },
];

/**
 * Enum of every demo sequence type the manager can cycle through.
 * Phase 1 ships only TUTORIAL. AI_BATTLE and HISTORIC_REPLAY are
 * stubbed and will be activated once the state-machine lands (Phase 2/3).
 */
export const enum DemoSequenceType {
  TUTORIAL = 'TUTORIAL',
  AI_BATTLE = 'AI_BATTLE',       // Phase 2 – requires state machine
  HISTORIC_REPLAY = 'HISTORIC_REPLAY', // Phase 3 – requires state machine
}

/** Internal states of the DemoMode FSM */
const enum DemoState {
  IDLE = 'IDLE',           // waiting for idle timeout
  RUNNING = 'RUNNING',     // demo is actively playing
  CANCELLED = 'CANCELLED', // user interrupted; returning to menu
}

/**
 * DemoMode
 *
 * Singleton-friendly class (one instance per Game) that:
 *  - Watches for user inactivity via a debounced timer
 *  - Starts the configured demo sequence when the timer expires
 *  - Listens for any pointer/keyboard event to cancel immediately
 *  - Notifies the game to return to the main menu on cancel
 *
 * Usage:
 *   const demo = new DemoMode(game);
 *   demo.enable();   // call when entering kiosk mode
 *   demo.disable();  // call when leaving kiosk mode / game starts
 */
export class DemoMode {
  private game: Game;
  private state: DemoState = DemoState.IDLE;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private stepTimer: ReturnType<typeof setTimeout> | null = null;
  private currentStepIndex = 0;
  private currentSequence: DemoSequenceType = DemoSequenceType.TUTORIAL;
  private enabled = false;

  /** Bound references kept so addEventListener / removeEventListener match */
  private _onUserActivity: () => void;
  private _onCancelInteraction: () => void;

  constructor(game: Game) {
    this.game = game;

    // WHY bind once: we need the same function reference for removal
    this._onUserActivity = this._handleUserActivity.bind(this);
    this._onCancelInteraction = this._handleCancelInteraction.bind(this);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Activate demo mode.  Call when the game enters kiosk / attract state.
   * Safe to call multiple times – will reset the idle timer if already active.
   */
  enable(): void {
    if (this.enabled) {
      // Already enabled; just reset the idle countdown
      this._resetIdleTimer();
      return;
    }
    this.enabled = true;
    this.state = DemoState.IDLE;

    // WHY these specific events:
    //   - pointermove / pointerdown cover mouse AND touch in modern browsers
    //   - keydown covers keyboard players
    //   - We attach to `document` so any interaction anywhere is captured
    document.addEventListener('pointermove', this._onUserActivity, { passive: true });
    document.addEventListener('pointerdown', this._onUserActivity, { passive: true });
    document.addEventListener('keydown', this._onUserActivity, { passive: true });

    this._resetIdleTimer();
  }

  /**
   * Deactivate demo mode.  Call when a real game session starts or the
   * player explicitly leaves kiosk mode.
   */
  disable(): void {
    this.enabled = false;
    this._clearAllTimers();
    this._removeInteractionListeners();
    this.state = DemoState.IDLE;
  }

  /**
   * Notify DemoMode that meaningful player activity happened on the game board
   * (e.g. a creature moved, an ability was used).  Camera pans alone should NOT
   * call this – only real game actions – to satisfy the edge-case requirement
   * that idle detection resets on meaningful actions only.
   */
  notifyMeaningfulActivity(): void {
    if (!this.enabled) return;
    // Only reset the idle timer; do NOT cancel a running demo via this path
    if (this.state === DemoState.IDLE) {
      this._resetIdleTimer();
    }
  }

  /** True while a demo sequence is actively playing */
  get isRunning(): boolean {
    return this.state === DemoState.RUNNING;
  }

  // ---------------------------------------------------------------------------
  // Idle timer
  // ---------------------------------------------------------------------------

  private _resetIdleTimer(): void {
    this._clearIdleTimer();
    this.idleTimer = setTimeout(() => this._startDemo(), IDLE_TIMEOUT_MS);
  }

  private _clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private _clearStepTimer(): void {
    if (this.stepTimer !== null) {
      clearTimeout(this.stepTimer);
      this.stepTimer = null;
    }
  }

  private _clearAllTimers(): void {
    this._clearIdleTimer();
    this._clearStepTimer();
  }

  // ---------------------------------------------------------------------------
  // User-activity handlers
  // ---------------------------------------------------------------------------

  /**
   * Called on any pointer/keyboard event WHILE in IDLE state.
   * Resets the idle countdown so the demo doesn't start.
   */
  private _handleUserActivity(): void {
    if (!this.enabled) return;
    if (this.state === DemoState.IDLE) {
      // WHY: only reset when idle – if demo is RUNNING we want the
      // separate cancel listener (below) to handle it instead
      this._resetIdleTimer();
    }
  }

  /**
   * Called on pointer/keyboard event WHILE demo is RUNNING.
   * Immediately stops the demo and returns to the main menu.
   *
   * WHY separate handler: we attach this only when the demo starts so
   * normal game interactions don't accidentally trigger a menu return.
   */
  private _handleCancelInteraction(): void {
    if (this.state !== DemoState.RUNNING) return;
    this._cancelDemo();
  }

  // ---------------------------------------------------------------------------
  // Demo lifecycle
  // ---------------------------------------------------------------------------

  private _startDemo(): void {
    if (!this.enabled) return;
    this.state = DemoState.RUNNING;
    this.currentStepIndex = 0;
    this.currentSequence = this._pickNextSequence();

    // Swap activity listener for cancel listener
    document.removeEventListener('pointermove', this._onUserActivity);
    document.removeEventListener('pointerdown', this._onUserActivity);
    document.removeEventListener('keydown', this._onUserActivity);

    // WHY capture phase (true) for cancel: ensures the event is caught
    // before any game UI handlers consume it, guaranteeing instant cancel.
    document.addEventListener('pointerdown', this._onCancelInteraction, true);
    document.addEventListener('keydown', this._onCancelInteraction, true);

    // Notify game layer so it can render the demo overlay / hide the main UI
    this.game.onDemoStart(this.currentSequence);

    this._runStep();
  }

  private _runStep(): void {
    if (this.state !== DemoState.RUNNING) return;

    const steps = this._getStepsForSequence(this.currentSequence);

    if (this.currentStepIndex >= steps.length) {
      // Sequence finished – loop back
      this.currentStepIndex = 0;
    }

    const step = steps[this.currentStepIndex];

    // Notify game layer to display this step
    this.game.onDemoStep(step, this.currentStepIndex, steps.length);

    this.currentStepIndex++;

    // Schedule the next step
    this.stepTimer = setTimeout(() => this._runStep(), DEMO_STEP_DURATION_MS);
  }

  private _cancelDemo(): void {
    this.state = DemoState.CANCELLED;
    this._clearAllTimers();
    this._removeInteractionListeners();

    // WHY: notify game BEFORE re-enabling demo so the menu transition
    // completes cleanly before we arm the idle timer again
    this.game.onDemoCancel();

    // Re-arm for the next idle period
    this.state = DemoState.IDLE;
    document.addEventListener('pointermove', this._onUserActivity, { passive: true });
    document.addEventListener('pointerdown', this._onUserActivity, { passive: true });
    document.addEventListener('keydown', this._onUserActivity, { passive: true });
    this._resetIdleTimer();
  }

  private _removeInteractionListeners(): void {
    document.removeEventListener('pointermove', this._onUserActivity);
    document.removeEventListener('pointerdown', this._onUserActivity);
    document.removeEventListener('keydown', this._onUserActivity);
    document.removeEventListener('pointerdown', this._onCancelInteraction, true);
    document.removeEventListener('keydown', this._onCancelInteraction, true);
  }

  // ---------------------------------------------------------------------------
  // Sequence helpers
  // ---------------------------------------------------------------------------

  /**
   * Pick the next demo sequence to cycle through.
   * Phase 1: only TUTORIAL is available.
   * Phase 2+: AI_BATTLE and HISTORIC_REPLAY will be added here once the
   * state machine is merged.
   */
  private _pickNextSequence(): DemoSequenceType {
    // For now always tutorial; extend with a round-robin when Phase 2 ships
    return DemoSequenceType.TUTORIAL;
  }

  private _getStepsForSequence(seq: DemoSequenceType): DemoStep[] {
    switch (seq) {
      case DemoSequenceType.TUTORIAL:
        return HOW_TO_PLAY_STEPS;
      // Phase 2/3 – stubs; return empty so nothing breaks
      case DemoSequenceType.AI_BATTLE:
      case DemoSequenceType.HISTORIC_REPLAY:
        return [];
      default:
        return HOW_TO_PLAY_STEPS;
    }
  }
}

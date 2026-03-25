/**
 * Undo Move CSS Styles
 * 
 * Styles for undo button, feedback, and tooltips.
 */

export const undoStyles = `
/* Undo Move Button */
.undo-move-btn {
  background-color: #f39c12 !important;
  border-color: #e67e22 !important;
  color: white !important;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  font-weight: bold;
  transition: all 0.2s ease;
}

.undo-move-btn:hover:not(:disabled) {
  background-color: #e67e22 !important;
  border-color: #d35400 !important;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(243, 156, 18, 0.4);
}

.undo-move-btn:disabled {
  background-color: #95a5a6 !important;
  border-color: #7f8c8d !important;
  cursor: not-allowed;
  opacity: 0.6;
}

.undo-move-btn .btn-icon {
  width: 20px;
  height: 20px;
  filter: brightness(0) invert(1);
}

/* Delay Turn Button */
.delay-turn-btn {
  background-color: #3498db !important;
  border-color: #2980b9 !important;
  color: white !important;
}

.delay-turn-btn:hover:not(:disabled) {
  background-color: #2980b9 !important;
  border-color: #1a5276 !important;
}

/* Undo Feedback */
.undo-feedback {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 6px;
  font-weight: bold;
  z-index: 10000;
  animation: feedbackSlideIn 0.3s ease-out;
  transition: opacity 0.3s ease;
}

.undo-feedback.success {
  background-color: rgba(46, 204, 113, 0.95);
  color: white;
}

.undo-feedback.warning {
  background-color: rgba(241, 196, 15, 0.95);
  color: #2c3e50;
}

.undo-feedback.error {
  background-color: rgba(231, 76, 60, 0.95);
  color: white;
}

.undo-feedback.info {
  background-color: rgba(52, 152, 219, 0.95);
  color: white;
}

/* Tooltip */
.tooltip {
  animation: tooltipFadeIn 0.3s ease-out;
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes feedbackSlideIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

@keyframes feedbackFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Game Controls Container */
.game-controls {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  gap: 10px;
  z-index: 1000;
}

/* Responsive */
@media (max-width: 768px) {
  .game-controls {
    bottom: 10px;
    right: 10px;
  }
  
  .undo-move-btn,
  .delay-turn-btn {
    padding: 8px 16px;
    font-size: 14px;
  }
  
  .undo-feedback {
    bottom: 80px;
    padding: 10px 16px;
    font-size: 14px;
  }
}
`;

/**
 * Inject undo styles into document
 */
export function injectUndoStyles(): void {
  // Check if styles already injected
  if (document.getElementById('undo-styles')) {
    console.log('[UndoStyles] Already injected');
    return;
  }
  
  // Create style element
  const styleElement = document.createElement('style');
  styleElement.id = 'undo-styles';
  styleElement.textContent = undoStyles;
  
  // Inject into document head
  document.head.appendChild(styleElement);
  
  console.log('[UndoStyles] Injected');
}

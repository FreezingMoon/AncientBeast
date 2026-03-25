To address the issue, we need to modify the code to conditionally apply the red/green color to the unit stats and masteries based on the unit's state and whether the stats/masteries have been buffed or debuffed. We also need to add a tooltip to display the changes when hovering over a stat or mastery.

Here's the exact code fix:

```javascript
// Get the unit stats and masteries elements
const unitStats = document.querySelectorAll('.unit-stats');
const unitMasteries = document.querySelectorAll('.unit-masteries');

// Function to check if a unit is materialized/alive
function isUnitAlive(unit) {
  // Assuming the unit's alive state is stored in a property called 'isAlive'
  return unit.isAlive;
}

// Function to check if a stat/mastery has been buffed or debuffed
function hasChanged(stat, unit) {
  // Assuming the unit's buffs and debuffs are stored in properties called 'buffs' and 'debuffs'
  return unit.buffs.includes(stat) || unit.debuffs.includes(stat);
}

// Function to get the tooltip text for a stat/mastery
function getTooltipText(stat, unit) {
  const changes = [];
  if (unit.buffs.includes(stat)) {
    changes.push(`Buffed by ${unit.buffs[stat]}`);
  }
  if (unit.debuffs.includes(stat)) {
    changes.push(`Debuffed by ${unit.debuffs[stat]}`);
  }
  return changes.join('<br>');
}

// Loop through each unit stats and masteries element
unitStats.forEach((stat) => {
  const unit = stat.closest('.unit').dataset.unit;
  if (isUnitAlive(unit)) {
    stat.querySelectorAll('.stat-value').forEach((value) => {
      const statName = value.dataset.stat;
      if (hasChanged(statName, unit)) {
        if (unit.buffs.includes(statName)) {
          value.style.color = 'green';
        } else if (unit.debuffs.includes(statName)) {
          value.style.color = 'red';
        }
      } else {
        value.style.color = '';
      }
    });
  } else {
    stat.querySelectorAll('.stat-value').forEach((value) => {
      value.style.color = '';
    });
  }
});

unitMasteries.forEach((mastery) => {
  const unit = mastery.closest('.unit').dataset.unit;
  if (isUnitAlive(unit)) {
    mastery.querySelectorAll('.mastery-value').forEach((value) => {
      const masteryName = value.dataset.mastery;
      if (hasChanged(masteryName, unit)) {
        if (unit.buffs.includes(masteryName)) {
          value.style.color = 'green';
        } else if (unit.debuffs.includes(masteryName)) {
          value.style.color = 'red';
        }
      } else {
        value.style.color = '';
      }
    });
  } else {
    mastery.querySelectorAll('.mastery-value').forEach((value) => {
      value.style.color = '';
    });
  }
});

// Add event listeners for hover and tooltip display
unitStats.forEach((stat) => {
  stat.querySelectorAll('.stat-value').forEach((value) => {
    value.addEventListener('mouseover', (e) => {
      const statName = value.dataset.stat;
      const unit = stat.closest('.unit').dataset.unit;
      const tooltipText = getTooltipText(statName, unit);
      const tooltip = document.createElement('div');
      tooltip.classList.add('tooltip');
      tooltip.innerHTML = tooltipText;
      tooltip.style.position = 'absolute';
      tooltip.style.top = `${e.clientY}px`;
      tooltip.style.left = `${e.clientX}px`;
      tooltip.style.background = 'rgba(0, 0, 0, 0.5)';
      tooltip.style.padding = '10px';
      tooltip.style.borderRadius = '10px';
      document.body.appendChild(tooltip);
    });
    value.addEventListener('mouseout', () => {
      const tooltip = document.querySelector('.tooltip');
      if (tooltip) {
        tooltip.remove();
      }
    });
  });
});

unitMasteries.forEach((mastery) => {
  mastery.querySelectorAll('.mastery-value').forEach((value) => {
    value.addEventListener('mouseover', (e) => {
      const masteryName = value.dataset.mastery;
      const unit = mastery.closest('.unit').dataset.unit;
      const tooltipText = getTooltipText(masteryName, unit);
      const tooltip = document.createElement('div');
      tooltip.classList.add('tooltip');
      tooltip.innerHTML = tooltipText;
      tooltip.style.position = 'absolute';
      tooltip.style.top = `${e.clientY}px`;
      tooltip.style.left = `${e.clientX}px`;
      tooltip.style.background = 'rgba(0, 0, 0, 0.5)';
      tooltip.style.padding = '10px';
      tooltip.style.borderRadius = '10px';
      document.body.appendChild(tooltip);
    });
    value.addEventListener('mouseout', () => {
      const tooltip = document.querySelector('.tooltip');
      if (tooltip) {
        tooltip.remove();
      }
    });
  });
});
```

This code assumes that the unit's alive state and buffs/debuffs are stored in properties called `isAlive`, `buffs`, and `debuffs`. It also assumes that the stat and mastery values have a `data-stat` and `data-mastery` attribute, respectively, that corresponds to the stat or mastery name.

The code first checks if the unit is alive and if the stat or mastery has been buffed or debuffed. If so, it applies the corresponding color to the stat or mastery value. If not, it removes any color.

The code then adds event listeners for hover and tooltip display. When a stat or mastery value is hovered over, it creates a tooltip with the changes that affected the stat or mastery. The tooltip is displayed with a dark transparent background and is removed when the mouse is moved out of the stat or mastery value.

Note that this code is just a starting point and may need to be modified to fit the specific requirements of your game.
To implement the Goey Body upgrade revamp, we need to modify the `Gumble` unit's behavior to allow it to leap over units during the moving phase. Here's the exact code fix:

**Modified Code:**
```python
# In Gumble.js
class Gumble extends Unit {
  // ...

  move(options) {
    // ...
    if (this.hasUpgrade('Goey Body') && options.distance >= 2) {
      this.leapOverUnits(options);
    }
    // ...
  }

  leapOverUnits(options) {
    const unitsInPath = this.getUnitsInPath(options);
    unitsInPath.forEach((unit) => {
      if (unit !== this && !unit.isAlly(this)) {
        // Leap over unit
        this.position = this.position.add(unit.position.subtract(this.position));
      }
    });
  }

  getUnitsInPath(options) {
    const path = this.getPath(options);
    const unitsInPath = [];
    path.forEach((hex) => {
      const unit = this.getUnitAtHex(hex);
      if (unit) {
        unitsInPath.push(unit);
      }
    });
    return unitsInPath;
  }

  // ...
}
```
**Explanation:**

1. We added a new method `leapOverUnits` to the `Gumble` class, which checks if the unit has the `Goey Body` upgrade and if the movement distance is at least 2 hexagons.
2. If the conditions are met, we call the `leapOverUnits` method, which gets the units in the path of the movement using the `getUnitsInPath` method.
3. We then iterate over the units in the path and check if they are not the same unit and not an ally. If so, we leap over the unit by updating the `Gumble` unit's position.

**Commit Message:**
```
Fix #2850: Implement Goey Body upgrade revamp

* Added leapOverUnits method to Gumble class
* Modified move method to call leapOverUnits when Goey Body upgrade is present
* Added getUnitsInPath method to get units in the path of movement
```
import * as $j from "jquery"

export class Locations {
  // All locations of the game (including future locations) here
  protected readonly locations: string[] = [
    "Dark Forest",
    "Frozen Wall",
    "Shadow Cave",
    "Dragon Bones",
  ];

  // Gets all the locations and puts them in the UI (src/index.ejs)
  renderLocations() {
  	for (let index = 0; index < this.locations.length; index += 1) {
  		$j('#combatLocation').append(
  			`<input type="radio" id="bgOpt${index + 1}" `  +
  			'name="combatLocation" ' +
  			`value="${this.locations[index]}">` +
  			`<label for="bgOpt${index + 1}" class="dragIt">` +
  			`${this.locations[index]}</label>`
  		);
  	}

    // When the locations are rendered, a random location is selected by default.
    this.selectRandomLocation();
  }

  // selects a random location and checks it as selected
  selectRandomLocation() {
    const options = $j("input[name='combatLocation']");
		const index = Math.floor(Math.random() * options.length);
		options.eq(index).prop('checked', true);
  }
}

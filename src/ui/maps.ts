import * as $j from "jquery"

export class Maps {
  // All locations of the game (including future locations) here
  protected readonly maps: string[] = [
    "Dark Forest",
    "Frozen Wall",
    "Shadow Cave",
    "Dragon Bones",
  ];

  // Gets all the maps and puts them in the UI (src/index.ejs)
  renderMaps() {
  	for (let index = 0; index < this.maps.length; index += 1) {
  		$j('#combatLocation').append(
  			`<input type="radio" id="bgOpt${index + 1}" `  +
  			'name="combatLocation" ' +
  			`value="${this.maps[index]}">` +
  			`<label for="bgOpt${index + 1}" class="dragIt">` +
  			`${this.maps[index]}</label>`
  		);
  	}

    // The background opt 1 will always be default so the
    // game won't crash when the player doesn't choose a map
    const radios = $j("input[name='combatLocation']");
		radios.eq(0).prop('checked', true).trigger('click');
  }
}

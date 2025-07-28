import * as $j from 'jquery';

export class Locations {
	// All locations of the game (including future locations) here
	protected readonly locations: string[] = [
		'Dark Forest',
		'Frozen Wall',
		'Shadow Cave',
		'Dragon Bones',
	];

	// Gets all the locations and puts them in the UI (src/index.ejs)
	renderLocations() {
		// Random location button (defined at render)
		$j('#combatLocation').append(
			`<input type="radio" id="bgOpt-1" ` +
				'name="combatLocation" ' +
				`value="${this.locations[Math.floor(Math.random() * this.locations.length)]}">` +
				`<label for="bgOpt${-1}" class="dragIt">` +
				`⚄</label>`,
		);
		// Sets random as default
		$j('#bgOpt-1').prop('checked', true);
		for (let index = 0; index < this.locations.length; index += 1) {
			$j('#combatLocation').append(
				`<input type="radio" id="bgOpt${index + 1}" ` +
					'name="combatLocation" ' +
					`value="${this.locations[index]}">` +
					`<label for="bgOpt${index + 1}" class="dragIt">` +
					`${this.locations[index]}</label>`,
			);
		}
	}
}

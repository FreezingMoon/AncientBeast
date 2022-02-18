import { FrontEndI } from "./frontend";
import Game from "../game";

export class NullFrontEnd implements FrontEndI {
	game: Game;

	constructor(game: Game) {
		this.game = game;
	}

	load(): void {
    console.log("NullFrontEnd: load");
	}

	unload(): void {
    console.log("NullFrontEnd: unload");
	}

	update(dt: Number): void {
    console.log("NullFrontEnd: update, dt=" + dt);
	}

	render(dt: Number): void {
    console.log("NullFrontEnd: update, dt=" + dt);
	}
}

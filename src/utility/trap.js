/*	Trap Class
 *
 *	Object containing hex informations, positions and DOM elements
 *
 */
var Trap = Class.create({

	/*	Constructor(x,y)
	 *
	 *	x : 			Integer : 	Hex coordinates
	 *	y : 			Integer : 	Hex coordinates
	 *
	 */
	initialize: function(x, y, type, effects, owner, opt) {
		this.hex = G.grid.hexes[y][x];
		this.type = type;
		this.effects = effects;
		this.owner = owner;

		this.creationTurn = G.turn;

		var o = {
			turnLifetime: 0,
			fullTurnLifetime: false,
			ownerCreature: undefined, // Needed for fullTurnLifetime
			destroyOnActivate: false,
			typeOver: undefined,
			destroyAnimation: undefined
		};

		$j.extend(this, o, opt);

		// Register
		G.grid.traps.push(this);
		this.id = trapID++;
		this.hex.trap = this;

		for (var i = this.effects.length - 1; i >= 0; i--) {
			this.effects[i].trap = this;
		};

		var spriteName = 'trap_' + type;
		var pos = this.hex.originalDisplayPos;
		this.display = G.grid.trapGroup.create(
			pos.x + this.hex.width / 2, pos.y + 60, spriteName);
		this.display.anchor.setTo(0.5);
		if (this.typeOver) {
			this.displayOver = G.grid.trapOverGroup.create(
				pos.x + this.hex.width / 2, pos.y + 60, spriteName);
			this.displayOver.anchor.setTo(0.5);
			this.displayOver.scale.x *= -1;
		}
	},

	destroy: function() {
		var tweenDuration = 500;
		var destroySprite = function(sprite, animation) {
			if (animation === 'shrinkDown') {
				sprite.anchor.y = 1;
				sprite.y += sprite.height / 2;
				var tween = G.Phaser.add.tween(sprite.scale)
					.to({
						y: 0
					}, tweenDuration, Phaser.Easing.Linear.None)
					.start();
				tween.onComplete.add(function() {
					this.destroy();
				}, sprite);
			} else {
				sprite.destroy();
			}
		};
		destroySprite(this.display, this.destroyAnimation);
		if (this.displayOver) {
			destroySprite(this.displayOver, this.destroyAnimation);
		}

		// Unregister
		var i = G.grid.traps.indexOf(this);
		G.grid.traps.splice(i, 1);
		this.hex.trap = undefined;
	},

	hide: function(duration, timer) {
		timer = timer - 0; // Avoid undefined
		duration = duration - 0; // Avoid undefined
		G.Phaser.add.tween(this.display).to({
			alpha: 0
		}, duration, Phaser.Easing.Linear.None)
	},

	show: function(duration) {
		duration = duration - 0; // Avoid undefined
		G.Phaser.add.tween(this.display).to({
			alpha: 1
		}, duration, Phaser.Easing.Linear.None)
	},

});
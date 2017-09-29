var Animations = Class.create({

	initialize: function() {},

	movements: {

		savedMvtPoints: 0,

		walk: function(crea, path, opts) {

			if (opts.customMovementPoint > 0) {

				path = path.slice(0, opts.customMovementPoint);
				// For compatibility
				this.savedMvtPoints = crea.remainingMove;
				crea.remainingMove = opts.customMovementPoint;
			}

			G.freezedInput = true;

			var anim_id = Math.random();
			G.animationQueue.push(anim_id);

			var hexId = 0;

			crea.healthHide();

			var anim = function() {

				var hex = path[hexId];

				if (hexId < path.length && (crea.remainingMove > 0 || opts.ignoreMovementPoint)) {
					G.animations.movements.leaveHex(crea, hex, opts);
				} else {
					G.animations.movements.movementComplete(
						crea, path[path.length - 1], anim_id, opts);
					return;
				}

				var nextPos = G.grid.hexes[hex.y][hex.x - crea.size + 1];
				var speed = !opts.overrideSpeed ? crea.animation.walk_speed : opts.overrideSpeed;

				var tween = G.Phaser.add.tween(crea.grp)
					.to(nextPos.displayPos, parseInt(speed), Phaser.Easing.Linear.None)
					.start();

				// Ignore traps for hover creatures, unless this is the last hex
				var enterHexOpts = $j.extend({
					ignoreTraps: crea.movementType() !== "normal" && hexId < path.length - 1
				}, opts);
				tween.onComplete.add(function() {

					if (crea.dead) {
						// Stop moving if creature has died while moving
						G.animations.movements.movementComplete(crea, hex, anim_id, opts);
						return;
					}

					// Sound Effect
					G.soundsys.playSound(G.soundLoaded[0], G.soundsys.effectsGainNode);

					if (!opts.ignoreMovementPoint) {
						crea.remainingMove--;
						if (opts.customMovementPoint === 0) crea.travelDist++;
					}

					G.animations.movements.enterHex(crea, hex, enterHexOpts);


					anim(); // Next tween
				});

				hexId++;
			};

			anim();
		},


		fly: function(crea, path, opts) {

			if (opts.customMovementPoint > 0) {

				path = path.slice(0, opts.customMovementPoint);
				// For compatibility
				this.savedMvtPoints = crea.remainingMove;
				crea.remainingMove = opts.customMovementPoint;
			}

			G.freezedInput = true;

			var anim_id = Math.random();
			G.animationQueue.push(anim_id);

			var hexId = 0;

			crea.healthHide();

			var hex = path[0];

			var start = G.grid.hexes[crea.y][crea.x - crea.size + 1];
			var currentHex = G.grid.hexes[hex.y][hex.x - crea.size + 1];

			G.animations.movements.leaveHex(crea, start, opts);

			var speed = !opts.overrideSpeed ? crea.animation.walk_speed : opts.overrideSpeed;

			var tween = G.Phaser.add.tween(crea.grp)
				.to(currentHex.displayPos, parseInt(speed), Phaser.Easing.Linear.None)
				.start();

			tween.onComplete.add(function() {
				// Sound Effect
				G.soundsys.playSound(G.soundLoaded[0], G.soundsys.effectsGainNode);

				if (!opts.ignoreMovementPoint) {
					// Determine distance
					var distance = 0;
					var k = 0;
					while (!distance && start != currentHex) {
						k++;

						if (arrayUtils.findPos(start.adjacentHex(k), currentHex)) {
							distance = k;
						}
					}

					crea.remainingMove -= distance;
					if (opts.customMovementPoint === 0) crea.travelDist += distance;
				}

				G.animations.movements.enterHex(crea, hex, opts);
				G.animations.movements.movementComplete(crea, hex, anim_id, opts);
				return;
			});
		},


		teleport: function(crea, path, opts) {

			var hex = path[0];

			var currentHex = G.grid.hexes[hex.y][hex.x - crea.size + 1];

			G.animations.movements.leaveHex(crea, currentHex, opts);

			var anim_id = Math.random();
			G.animationQueue.push(anim_id);

			// FadeOut
			var tween = G.Phaser.add.tween(crea.grp)
				.to({
					alpha: 0
				}, 500, Phaser.Easing.Linear.None)
				.start();

			tween.onComplete.add(function() {
				// Sound Effect
				G.soundsys.playSound(G.soundLoaded[0], G.soundsys.effectsGainNode);

				// position
				crea.grp.x = currentHex.displayPos.x;
				crea.grp.y = currentHex.displayPos.y;

				// FadeIn
				var tween = G.Phaser.add.tween(crea.grp)
					.to({
						alpha: 1
					}, 500, Phaser.Easing.Linear.None)
					.start();

				G.animations.movements.enterHex(crea, hex, opts);
				G.animations.movements.movementComplete(crea, hex, anim_id, opts);
				return;
			});
		},

		push: function(crea, path, opts) {
			opts.pushed = true;
			this.walk(crea, path, opts);
		},

		//--------Special Functions---------//

		enterHex: function(crea, hex, opts) {
			crea.cleanHex();
			crea.x = hex.x - 0;
			crea.y = hex.y - 0;
			crea.pos = hex.pos;
			crea.updateHex();

			G.triggersFn.onStepIn(crea, hex, opts);

			crea.pickupDrop();

			opts.callbackStepIn(hex);

			G.grid.orderCreatureZ();
		},

		leaveHex: function(crea, hex, opts) {
			if (!opts.pushed) crea.faceHex(hex, crea.hexagons[0]); // Determine facing
			G.triggersFn.onStepOut(crea, crea.hexagons[0]); // Trigger

			G.grid.orderCreatureZ();
		},

		movementComplete: function(crea, hex, anim_id, opts) {

			if (opts.customMovementPoint > 0) {
				crea.remainingMove = this.savedMvtPoints;
			}

			G.grid.updateDisplay();

			//TODO turn around animation
			if (opts.turnAroundOnComplete) {
				crea.facePlayerDefault();
			}

			//TODO reveal healh indicator
			crea.healthShow();

			G.triggersFn.onCreatureMove(crea, hex); // Trigger

			crea.hexagons.forEach(function(hex) {
				hex.pickupDrop(crea);
			});

			G.grid.orderCreatureZ();

			var queue = G.animationQueue.filter(function(item) {
				return (item != anim_id);
			});

			if (queue.length === 0) {
				G.freezedInput = false;
			}

			G.animationQueue = queue;
		}
	},
	projectile:function(this_2,target,sprite_id,path,args,start_x,start_y){
		
		
		 var dist = arrayUtils.filterCreature(path.slice(0), false, false).length;

		var emissionPoint = {
					x: this_2.creature.grp.x + start_x,
					y: this_2.creature.grp.y + start_y
				};
				
		var targetPoint = {
					x: target.grp.x + 52,
					y: target.grp.y - 20
				};
		var sprite = G.grid.creatureGroup.create(
					emissionPoint.x, emissionPoint.y, sprite_id); // Sprite id here
				sprite.anchor.setTo(0.5);
				sprite.rotation = -Math.PI / 3 + args.direction * Math.PI / 3;
				var duration = dist * 75;
				var tween = G.Phaser.add.tween(sprite)
					.to({
						x: targetPoint.x,
						y: targetPoint.y
					}, duration, Phaser.Easing.Linear.None)
					.start();
		return [tween,sprite,dist];
	}, // End projectile
});

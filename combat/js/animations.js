var Animations = Class.create({
	
	initialize: function(){},

	movements : {

		walk : function(crea,path,opts){

			if( opts.customMovementPoint > 0 ){ 
	
				path = path.slice(0,opts.customMovementPoint); 
				//For compatibility
				var savedMvtPoints = creature.remainingMove;
				creature.remainingMove = opts.customMovementPoint;
			}

			G.freezedInput = true;

			var anim_id = Math.random();
			G.animationQueue.push(anim_id);
				
			var hexId = 0;

			crea.healthHide();

			var anim = function(){
				
				var hex = path[hexId];

				if( hexId < path.length && crea.remainingMove > 0 ){
					G.animations.movements.leaveHex(crea,hex,opts);
				}else{
					G.animations.movements.movementComplete(crea,hex,anim_id,opts); return;
				}
		
				var nextPos = G.grid.hexs[hex.y][hex.x-crea.size+1];
				var speed = !opts.overrideSpeed ? crea.animation.walk_speed : opts.overrideSpeed;

				var tween = G.Phaser.add.tween(crea.grp)
				.to(nextPos.displayPos, parseInt(speed), Phaser.Easing.Linear.None)
				.start();

				tween.onCompleteCallback(function(){
					//Sound Effect
					G.soundsys.playSound(G.soundLoaded[0],G.soundsys.effectsGainNode);

					if(!opts.ignoreMovementPoint){
						crea.remainingMove--;
						if(opts.customMovementPoint == 0) crea.travelDist++;
					}

					G.animations.movements.enterHex(crea,hex,opts);


					anim(); //Next tween
				});

				hexId++;
			};

			anim();
		},


		fly : function(crea,path,opts){

			if( opts.customMovementPoint > 0 ){ 
	
				path = path.slice(0,opts.customMovementPoint); 
				//For compatibility
				var savedMvtPoints = creature.remainingMove;
				creature.remainingMove = opts.customMovementPoint;
			}

			G.freezedInput = true;

			var anim_id = Math.random();
			G.animationQueue.push(anim_id);
				
			var hexId = 0;

			crea.healthHide();

			var currentHex = G.grid.hexs[hex.y][hex.x-creature.size+1];

			var speed = !opts.overrideSpeed ? creature.animation.walk_speed : opts.overrideSpeed;

			var tween = G.Phaser.add.tween(crea.grp)
			.to(nextPos.displayPos, parseInt(speed), Phaser.Easing.Linear.None)
			.start();

			tween.onCompleteCallback(function(){
				//Sound Effect
				G.soundsys.playSound(G.soundLoaded[0],G.soundsys.effectsGainNode);

				if(!opts.ignoreMovementPoint){
					//Determine distance
					var distance = 0;
					var k = 0;
					while(!distance && start != currentHex){
						k++;
						if( start.adjacentHex(k).findPos(currentHex) ) distance = k;
					}
					
					creature.remainingMove -= distance;
					if(opts.customMovementPoint == 0) creature.travelDist += distance;
				}

				G.animations.movements.enterHex(crea,hex,opts);
				G.animations.movements.movementComplete(crea,hex,anim_id,opts); return;
			});
		},


		teleport : function(crea,path,opts){

			if( opts.customMovementPoint > 0 ){ 
	
				path = path.slice(0,opts.customMovementPoint); 
				//For compatibility
				var savedMvtPoints = creature.remainingMove;
				creature.remainingMove = opts.customMovementPoint;
			}

			G.freezedInput = true;

			var anim_id = Math.random();
			G.animationQueue.push(anim_id);
				
			var hexId = 0;

			crea.healthHide();
			
			var anim = function(){
				
				var hex = path[hexId];

				if( hexId < path.length && crea.remainingMove > 0 ){
					G.animations.movements.leaveHex(crea,hex,opts);
				}else{
					G.animations.movements.movementComplete(crea,hex,anim_id,opts); return;
				}
		
				var nextPos = G.grid.hexs[hex.y][hex.x-crea.size+1];
				var speed = !opts.overrideSpeed ? crea.animation.walk_speed : opts.overrideSpeed;

				var tween = G.Phaser.add.tween(crea.grp)
				.to(nextPos.displayPos, parseInt(speed), Phaser.Easing.Linear.None)
				.start();

				tween.onCompleteCallback(function(){
					//Sound Effect
					G.soundsys.playSound(G.soundLoaded[0],G.soundsys.effectsGainNode);

					G.animations.movements.enterHex(crea,hex,opts);

					anim(); //Next tween
				});

				hexId++;
			};

			anim();
		},

		//--------Special Functions---------//

		enterHex : function(crea,hex,opts){
			crea.cleanHex();
			crea.x 	= hex.x - 0;
			crea.y 	= hex.y - 0;
			crea.pos 	= hex.pos;
			crea.updateHex();

			if(!opts.ignoreMovementPoint){
				//Trigger
				G.triggersFn.onStepIn(crea,hex);
				crea.pickupDrop();
			}

			opts.callbackStepIn(hex);

			// Sort order : NOT WORKING ATM
			//G.grid.creatureGroup.order();
		},

		leaveHex : function(crea,hex,opts){
			crea.faceHex(hex,crea.hexagons[0]); //Determine facing
			G.triggersFn.onStepOut(crea,crea.hexagons[0]); //Trigger
		},

		movementComplete : function(crea,hex,anim_id,opts){

			if(opts.customMovementPoint > 0){
				crea.remainingMove = savedMvtPoints;
			}

			G.grid.updateDisplay();

			//TODO turn around animation
			crea.facePlayerDefault();

			//TODO reveal healh indicator
			crea.healthShow();

			G.triggersFn.onCreatureMove(crea,hex);//Trigger

			crea.hexagons.each(function(){this.pickupDrop(crea);});

			G.animationQueue.filter(function(){ return (this!=anim_id); });
			if( G.animationQueue.length == 0 ) G.freezedInput = false;
		}
	}
});
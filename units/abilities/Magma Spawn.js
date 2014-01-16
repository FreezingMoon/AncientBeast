/*
*
*	Magma Spawn abilities
*
*/
abilities[4] =[

// 	First Ability: Scorched Ground
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onStartPhase",

	// 	require() :
	require : function(){return this.testRequirements();},

	//	activate() : 
	activate : function() {
		var ability = this;

		var effectFn = function(effect,crea){ 
			crea.takeDamage(new Damage( effect.attacker, "effect", ability.damages , 1,[] )); 
			this.trap.destroy();
		};

		var requireFn = function(){ 
			if(this.trap.hex.creature==0) return false;
			return this.trap.hex.creature.type != "L2"; 
		};

		this.creature.hexagons[1].createTrap("scorched-ground",[
			new Effect(
				"Scorched Ground",this.creature,this.creature.hexagons[1],"onStepIn",
				{ requireFn: requireFn, effectFn: effectFn,	attacker: this.creature }
			),
		],this.creature.player, { turnLifetime : 1, ownerCreature : this.creature, fullTurnLifetime : true } );

		var hex;
		if( this.creature.player.flipped )
			hex = this.creature.hexagons[0];
		else
			hex = this.creature.hexagons[2];


		hex.createTrap("scorched-ground",[
			new Effect(
				"Scorched Ground",this.creature,hex,"onStepIn",
				{ requireFn: requireFn, effectFn: effectFn,	attacker: this.creature }
			),
		],this.creature.player, { turnLifetime : 1, ownerCreature : this.creature, fullTurnLifetime : true } );
	},
},



// 	Second Ability: Pulverizing Punch
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.getHexMap(frontnback3hex),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var magmaSpawn = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : magmaSpawn.id,
			flipped : magmaSpawn.flipped,
			hexs : this.creature.getHexMap(frontnback3hex),
		});
	},


	//	activate() : 
	activate : function(target,args) {
		var ability = this;
		ability.end();

		ability.creature.burnBoost = (ability.creature.burnBoost+1) ? ability.creature.burnBoost : 3;

		var d = {burn:ability.creature.burnBoost, crush:ability.damages.crush};
		
		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			d, //Damage Type
			1, //Area
			[]	//Effects
		);

		target.takeDamage(damage);

		ability.creature.burnBoost++;
	},
},



// 	Thirt Ability: Fissure Vent
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	map : [  [0,0,1,0],
			[0,0,1,1],
			 [0,1,1,0],//origin line
			[0,0,1,1],
			 [0,0,1,0]],

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		this.map.origin = [0,2];
		
		// Require Ennemy
		var magmaSpawn = this.creature;
		var hexs = magmaSpawn.getHexMap(this.map).concat( magmaSpawn.getHexMap(this.map,true) );
		if( !this.atLeastOneTarget( hexs,"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var magmaSpawn = this.creature;

		this.map.origin = [0,2];

		G.grid.queryChoice({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 3, 
			requireCreature : 0,
			id : magmaSpawn.id,
			flipped : magmaSpawn.flipped,
			choices : [
				magmaSpawn.getHexMap(this.map),
				magmaSpawn.getHexMap(this.map,true)
			],
		})

	},


	//	activate() : 
	activate : function(hexs,args) {
		var ability = this;
		ability.end();

		//Basic Attack all nearby creatures
		ability.areaDamage(
			ability.creature, //Attacker
			"zone", //Attack Type
			ability.damages1, //Damage Type
			[],	//Effects
			ability.getTargets(hexs) //Targets
		);
	},

	animation_datas : { 
		visual : function(hexs,args){

			setTimeout(function(){
				hexs.each(function(){
					var sprite = G.grid.trapGroup.create(this.originalDisplayPos.x, this.originalDisplayPos.y, "effects_fissure-vent");
					var tween = G.Phaser.add.tween(sprite)
					.to({alpha:1},500,Phaser.Easing.Linear.None)
					.to({alpha:0},500,Phaser.Easing.Linear.None)
					.start();
					tween._lastChild.onComplete.add(function(){ sprite.destroy() },this);
				});
			},this.animation_datas.delay);

		},
		duration : 500,
		delay : 350,
	},

},



// 	Fourth Ability: Molten Hurl
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	directions : [0,1,0,0,1,0],

	require : function(){
		if( !this.testRequirements() ) return false;

		var magmaSpawn = this.creature;
		var x = (magmaSpawn.player.flipped) ? magmaSpawn.x-magmaSpawn.size+1 : magmaSpawn.x ;

		var test = this.testDirection({
			team : "ennemy",
			x : x,
			directions : this.directions,
		});

		if( !test ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var magmaSpawn = this.creature;

		var x = (magmaSpawn.player.flipped) ? magmaSpawn.x-magmaSpawn.size+1 : magmaSpawn.x ;

		G.grid.queryDirection({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //enemies
			id : magmaSpawn.id,
			requireCreature : true,
			x : x,
			y : magmaSpawn.y,
			directions : this.directions,
		});
	},


	//	activate() : 
	activate : function(path,args) {
		var ability = this;
		var magmaSpawn = this.creature;


		var path = path;
		var target = path.last().creature;
		ability.end(false,true);

		//Damage
		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);


		//Movement
		var magmaHex = (args.direction==4) ? magmaSpawn.hexagons[magmaSpawn.size-1] : magmaSpawn.hexagons[0] ;
		path.filterCreature(false,false);
		path.unshift(magmaHex); //prevent error on empty path
		var destination = path.last();
		var x = (args.direction==4) ? destination.x+magmaSpawn.size-1 : destination.x ;
		destination = G.grid.hexs[destination.y][x];

		magmaSpawn.moveTo(destination,{
			ignoreMovementPoint : true,
			ignorePath : true,
			callback : function(){
				path.each(function(){
					if( !this.trap ) return;
					if( this.trap.owner =! magmaSpawn.player ){
						this.destroyTrap();
					}
				});

				var ret = target.takeDamage(damage,true);
				
				if( ret.damageObj instanceof Damage && ret.kill == false )
					G.triggersFn.onDamage(target,ret.damageObj);

				var interval = setInterval(function(){
					if(!G.freezedInput){
						clearInterval(interval);
						G.UI.selectAbility(-1);
						G.activeCreature.queryMove();
					}
				},100)
				
			},
		});
	},
}

];

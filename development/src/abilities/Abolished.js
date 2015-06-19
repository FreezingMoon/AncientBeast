/*
*
*	Abolished abilities
*
*/
G.abilities[7] =[

// 	First Ability: Burning Heart
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onDamage",

	// 	require() :
	require : function(damage){
		if( this.used ) return false;
		if( !this.testRequirements() ) return false;
		if( damage == undefined ) damage = {type:"target"}; // For the test function to work
		return true;
	},

	//	activate() :
	activate : function(damage){
		if(this.triggeredThisChain) return damage;

		var targets = this.getTargets(this.creature.adjacentHexs(1));
		this.end();

		this.areaDamage(
			this.creature, // Attacker
			"area retaliation", // Attack Type
			this.damages, // Damage Type
			[],	// Effects
			targets
		);

		return damage;
	},
},


// 	Second Ability: Fiery Claw
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	distance : 2,

	// 	require() :
	require : function(){
		if(!this.testRequirements()) return false;
		var test = this.testDirection({
			team : "ennemy",
			distance : this.distance,
			sourceCreature : this.creature,
		});
		if(!test){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			flipped : crea.player.flipped,
			team : 0, // enemies
			id : this.creature.id,
			requireCreature : true,
			x : crea.x,
			y : crea.y,
			distance : this.distance,
			sourceCreature : crea,
		});
	},


	//	activate() :
	activate : function(path,args) {
		var ability = this;
		ability.end();

		var target = path.last().creature;

		var damage = new Damage(
			ability.creature, // Attacker
			"target", // Attack Type
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);
		target.takeDamage(damage);
	},
},



// 	Thirt Ability: Wild Fire
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		return this.testRequirements();
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		crea.queryMove({
			noPath : true,
			isAbility : true,
			range : G.grid.getFlyingRange(crea.x,crea.y,50,crea.size,crea.id),
			callback : function(){ delete arguments[1]; ability.animation.apply(ability,arguments); },
		});
	},


	//	activate() :
	activate : function(hex,args) {
		var ability = this;
		ability.end();


		var targets = ability.getTargets(ability.creature.adjacentHexs(1));

		targets.each(function(){

			if( !(this.target instanceof Creature) ) return;

			var trg = this.target;

		})

		ability.creature.moveTo(hex,{
			ignoreMovementPoint : true,
			ignorePath : true,
			animation : "teleport",
			callback : function(){
				G.activeCreature.queryMove()
			},
			callbackStepIn  : function(){
				var targets = ability.getTargets(ability.creature.adjacentHexs(1));

				targets.each(function(){
				if( !(this.target instanceof Creature) ) return;

					var trg = this.target;

					if(trg.team%2 != ability.creature.team%2){ // If Foe

						var optArg = { alterations : {burn : -5} };

						// Roasted effect
						var effect = new Effect(
							"Roasted", // Name
							ability.creature, // Caster
							trg, // Target
							"", // Trigger
							optArg // Optional arguments
						);
						trg.addEffect(effect,"%CreatureName"+trg.id+"% got roasted : -5 burn stat");
					}
				})
			},
		});

		// Leave a Firewall in old location
		var effectFn = function(effect,crea){
			crea.takeDamage(new Damage( effect.attacker, "effect", ability.damages , 1,[] ));
			this.trap.destroy();
		};

		var requireFn = function(){
			if(this.trap.hex.creature==0) return false;
			return this.trap.hex.creature.type != "P7";
		};

		this.creature.hexagons[1].createTrap("firewall",[
			new Effect(
				"Firewall",this.creature,this.creature.hexagons[1],"onStepIn",
				{ requireFn: requireFn, effectFn: effectFn,	attacker: this.creature }
			),
		],this.creature.player, { turnLifetime : 1, ownerCreature : this.creature, fullTurnLifetime : true } );

		var hex = this.creature.hexagons[2];

		hex.createTrap("firewall",[
			new Effect(
				"Firewall",this.creature,hex,"onStepIn",
				{ requireFn: requireFn, effectFn: effectFn,	attacker: this.creature }
			),
		],this.creature.player, { turnLifetime : 1, ownerCreature : this.creature, fullTurnLifetime : true } );
	},
},



// 	Fourth Ability: Greater Pyre
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		return this.testRequirements();
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		inRangeCreatures = crea.hexagons[1].adjacentHex(1);;

		var range = crea.hexagons[1].adjacentHex(1);

		var head = range.indexOf(crea.hexagons[0]);
		var tail = range.indexOf(crea.hexagons[2]);
		range.splice(head,1);
		range.splice(tail,1);

		G.grid.queryHexs({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			fnOnSelect : function(hex,args){
				hex.adjacentHex(1).each(function(){
					if( this.creature instanceof Creature ){
						if( this.creature == crea ){ // If it is Abolished
							crea.adjacentHexs(1).each(function(){
								if( this.creature instanceof Creature ){
									if( this.creature == crea ){ // If it is Abolished
										crea.adjacentHexs(1).overlayVisualState("creature selected weakDmg player"+this.creature.team);
										this.overlayVisualState("creature selected weakDmg player"+this.creature.team);
									}else{
										this.overlayVisualState("creature selected weakDmg player"+this.creature.team);
									}
								}else{
									this.overlayVisualState("creature selected weakDmg player"+G.activeCreature.team);
								}
							});
						}else{
							this.overlayVisualState("creature selected weakDmg player"+this.creature.team);
						}
					}else{
						this.overlayVisualState("creature selected weakDmg player"+G.activeCreature.team);
					}
				});

				hex.cleanOverlayVisualState();
				if( hex.creature instanceof Creature ){
					hex.overlayVisualState("creature selected player"+hex.creature.team);
				}else{
					hex.overlayVisualState("creature selected player"+G.activeCreature.team);
				}
			},
			id : this.creature.id,
			hexs : range,
			hideNonTarget : true,
		});
	},


	//	activate() :
	activate : function(hex,args) {
		var ability = this;
		ability.end();

		var aoe = hex.adjacentHex(1);

		var targets = ability.getTargets(aoe);

		if(hex.creature instanceof Creature){
			hex.creature.takeDamage(new Damage(
				ability.creature, // Attacker
				"area", // Attack Type
				ability.damages1, // Damage Type
				1, // Area
				[]	// Effects
			));
		}


		ability.areaDamage(
			ability.creature,
			"area",
			ability.damages2,
			[],	// Effects
			targets
		);

	},
}

];

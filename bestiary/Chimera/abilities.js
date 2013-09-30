/*
*
*	Chimera abilities
*
*/
abilities[45] =[

// 	First Ability: Cyclic Duality
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onStartPhase",

	//	require() :
	require : function(){
		return this.testRequirements();
	},

	//	activate() : 
	activate : function() {
		this.tokens = [false,false,false];
	},

	abilityTriggered : function(id){
		if(this.used) return;
		if(this.tokens[id]){
			this.end();
			for (var i = 0; i < this.tokens.length; i++) {
				this.creature.abilities[i+1].used  = this.tokens[i];
			};
			G.UI.checkAbilities();
		}else{
			this.tokens[id] = true;
			this.creature.abilities[id+1].setUsed(false);
		}
	},

	tokens : [false,false,false],
},



//	Second Ability: Tooth Fairy
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( G.grid.getHexMap(this.creature.x-3,this.creature.y-2,0,false,frontnback3hex),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}

		//Duality
		if( this.creature.abilities[0].used ){
			//this.message = "Duality has already been used";
			//return false;
		}else{
			this.setUsed(false);
		}

		return true;
	},

	//	query() :
	query : function(){
		var ability = this;
		var chimera = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : chimera.id,
			flipped : chimera.flipped,
			hexs : G.grid.getHexMap(chimera.x-3,chimera.y-2,0,false,frontnback3hex),
		});
	},


	//	activate() : 
	activate : function(target,args) {
		var ability = this;

		ability.creature.abilities[0].abilityTriggered(0);

		ability.end();

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);
	},
},



//	Thirt Ability: Power Note
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",
	
	directions : [0,1,0,0,1,0],

	//	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.testDirection({ team : "both", directions : this.directions }) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		//Duality
		if( this.creature.abilities[0].used ){
			//this.message = "Duality has already been used";
			//return false;
		}else{
			this.setUsed(false);
		}
		return true;
	},

	//	query() :
	query : function(){
		var ability = this;
		var chimera = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			flipped : chimera.player.flipped,
			team : 3, //everyone
			id : chimera.id,
			requireCreature : true,
			x : chimera.x,
			y : chimera.y,
			directions : this.directions,
		});
	},


	//	activate() : 
	activate : function(path,args) {
		var ability = this;

		ability.creature.abilities[0].abilityTriggered(1);
		ability.end();

		var invertFlipped = ( 
			( path[0].direction == 4 && !ability.creature.player.flipped )  || 
			( path[0].direction == 1 && ability.creature.player.flipped ) 
		);
		console.log(invertFlipped)

		var target = path.last().creature;

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		result = target.takeDamage(damage);
		
		while(result.kill){

			var hexs = ability.creature.getHexMap(straitrow,invertFlipped);
			var newTarget = false;
			for (var i = 0; i < hexs.length; i++) {
				if(hexs[i].creature instanceof Creature) {
					if(hexs[i].creature == ability.creature) continue;
					var target = hexs[i].creature;
					newTarget = true;
					break;
				}
			};

			if(!newTarget) break;

			var damage = new Damage(
				ability.creature, //Attacker
				"target", //Attack Type
				{sonic:result.damages.sonic}, //Damage Type
				1, //Area
				[]	//Effects
			);
			result = target.takeDamage(damage);

		}
	},
},



//	Fourth Ability: Chain Lightning
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	directions : [0,1,0,0,1,0],
	
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.testDirection({ team : "both", directions : this.directions }) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		//Duality
		if( this.creature.abilities[0].used ){
			//this.message = "Duality has already been used";
			//return false;
		}else{
			this.setUsed(false);
		}
		return true;
	},

	//	query() :
	query : function(){
		var ability = this;
		var chimera = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			flipped : chimera.player.flipped,
			team : 3, //everyone
			id : chimera.id,
			requireCreature : true,
			x : chimera.x,
			y : chimera.y,
			directions : this.directions,
		});
	},


	//	activate() : 
	activate : function(path,args) {
		var ability = this;

		ability.creature.abilities[0].abilityTriggered(2);

		ability.end();

		var targets = [];
		targets.push(path.last().creature); //Add First creature hit
		var nextdmg = $j.extend({},ability.damages); //Copy the object

		//For each Target
		for (var i = 0; i < targets.length; i++) {
			var trg = targets[i];

			var damage = new Damage(
				ability.creature, //Attacker
				"target", //Attack Type
				nextdmg, //Damage Type
				1, //Area
				[] //Effects
			);
			nextdmg = trg.takeDamage(damage);

			if(nextdmg.damages == undefined) break; //If attack is dodge
			if(nextdmg.kill) break; //If target is killed
			if(nextdmg.damages.total <= 0) break; //If damage is too weak
			if(nextdmg.damageObj.status != "") break;
			delete nextdmg.damages.total;
			nextdmg = nextdmg.damages;

			//Get next available targets
			nextTargets = ability.getTargets(trg.adjacentHexs(1,true));

			nextTargets.filter(function(){
				if ( this.hexsHit == undefined ) return false; // remove empty ids.
				return (targets.indexOf(this.target) == -1) ; //If this creature has already been hit
			})

			//If no target
			if(nextTargets.length == 0) break;

			//Best Target
			var bestTarget = { size: 0, stats:{ defense:-99999, shock:-99999 } };
			for (var j = 0; j < nextTargets.length; j++) { //For each creature
				if (typeof nextTargets[j] == "undefined") continue; // Skip empty ids.

				var t = nextTargets[j].target;
				//Compare to best target
				if(t.stats.shock > bestTarget.stats.shock){
					if( ( t == ability.creature && nextTargets.length == 1 ) || //If target is chimera and the only target
						t != ability.creature ) { //Or this is not chimera
						bestTarget = t;
					}
				} else {
					continue;
				}

			};

			if( bestTarget instanceof Creature ){
				targets.push(bestTarget);
			}else{
				break;
			}
		};

	},
}

];

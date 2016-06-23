/*
*
*	Cyber Hound abilities
*
*/
G.abilities[31] =[

// 	First Ability: Bad Doggie
{
	triggerFunc: function() {
		// When upgraded, trigger both at start and end of turn
		// Otherwise just trigger at start
		if (this.isUpgraded()) {
			return "onStartPhase onEndPhase";
		}
		return "onStartPhase";
	},

	require: function() {
		if (!this.testRequirements()) return false;

		// Check if there's an enemy creature in front
		var hexesInFront = this.creature.getHexMap(inlinefront2hex);
		if (hexesInFront.length < 1) return false;
		var target = hexesInFront[0].creature;
		if (!target) return false;
		if (this.creature.isAlly(target.team)) return false;
		return true;
	},

	activate: function() {
		var ability = this;
		ability.end();

		var target = this.creature.getHexMap(inlinefront2hex)[0].creature;

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



// 	Second Ability: Metal Hand
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.getHexMap(frontnback2hex), "enemy" ) ) {
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){

		var ability = this;
		var crea = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability, arguments); }, //fnOnConfirm
			team : 0, //Team, 0 = enemies
			id : crea.id,
			flipped : crea.player.flipped,
			hexs : crea.getHexMap(frontnback2hex)
		});
	},


	//	activate() :
	activate : function(target, args) {
		var ability = this;
		ability.end();

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);

		// If upgrade, also steal up to 8 energy
		if (this.isUpgraded()) {
			var energySteal = Math.min(8, target.energy);
			target.energy -= energySteal;
			this.creature.recharge(energySteal);
			G.log("%CreatureName" + this.creature.id + "% steals " + energySteal +
				" energy from %CreatureName" + target.id + "%");
		}
	},
},



// 	Third Ability: Rocket Launcher
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	require : function() {
		return this.testRequirements();
	},

	token : 0,

	// 	query() :
	query : function() {

		var ability = this;
		var crea = this.creature;

		var choices = [
			//Front
			G.grid.getHexMap(crea.x,crea.y-2,0,false,bellowrow).filterCreature(true, true, crea.id).concat(
			G.grid.getHexMap(crea.x,crea.y,0,false,straitrow).filterCreature(true, true, crea.id),
			G.grid.getHexMap(crea.x,crea.y,0,false,bellowrow).filterCreature(true, true, crea.id)),
			//Behind
			G.grid.getHexMap(crea.x-1,crea.y-2,0,true,bellowrow).filterCreature(true, true, crea.id).concat(
			G.grid.getHexMap(crea.x-1,crea.y,0,true,straitrow).filterCreature(true, true, crea.id),
			G.grid.getHexMap(crea.x-1,crea.y,0,true,bellowrow).filterCreature(true, true, crea.id))
		];

		choices[0].choiceId = 0;
		choices[1].choiceId = 1;

		G.grid.queryChoice({
			fnOnCancel : function(){ G.activeCreature.queryMove(); G.grid.clearHexViewAlterations(); },
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : "both",
			id : crea.id,
			requireCreature : false,
			choices : choices
		});
	},


	//	activate() :
	activate : function(choice,args) {
		var ability = this;
		ability.end();

		var crea = this.creature;

		if( choice.choiceId == 0 ){
			//Front
			var rows = [
				G.grid.getHexMap(crea.x,crea.y-2,0,false,bellowrow).filterCreature(true,true,crea.id),
				G.grid.getHexMap(crea.x,crea.y,0,false,straitrow).filterCreature(true,true,crea.id),
				G.grid.getHexMap(crea.x,crea.y,0,false,bellowrow).filterCreature(true,true,crea.id)
			];
		}else{
			//Back
			var rows = [
				G.grid.getHexMap(crea.x-1,crea.y-2,0,true,bellowrow).filterCreature(true,true,crea.id),
				G.grid.getHexMap(crea.x-1,crea.y,0,true,straitrow).filterCreature(true,true,crea.id),
				G.grid.getHexMap(crea.x-1,crea.y,0,true,bellowrow).filterCreature(true,true,crea.id)
			];
		}


		for (var i = 0; i < rows.length; i++) {
			if( rows[i].length == 0 || !(rows[i][ rows[i].length-1 ].creature instanceof Creature) ) {
				//Miss
				this.token += 1;
				continue;
			}

			var target = rows[i][ rows[i].length-1 ].creature;

			var damage = new Damage(
				ability.creature, //Attacker
				"target", //Attack Type
				ability.damages, //Damage Type
				1, //Area
				[]	//Effects
			);
			target.takeDamage(damage);
		};

		G.UI.checkAbilities();
	},
},



// 	Forth Ability: Targeting System
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if(this.creature.abilities[2].token == 0){
			this.message = "No rocket launched."
			return false;
		}

		return true;
	},

	// 	query() :
	query : function(){

		var ability = this;
		var crea = this.creature;

		var hexs = G.grid.allHexs.slice(0); //Copy array

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); }, //fnOnConfirm
			team : 0, //Team, 0 = enemies
			id : crea.id,
			flipped : crea.player.flipped,
			hexs : hexs
		});
	},


	//	activate() :
	activate : function(crea,args) {
		var ability = this;
		ability.end();

		var target = crea;

		this.creature.abilities[2].token -= 1;

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			this.creature.abilities[2].damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);
	},
}

];

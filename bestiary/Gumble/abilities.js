/*
*
*	Gumble abilities
*
*/
abilities[14] =[

// 	First Ability: Self Flatten
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onDamage",

	// 	require() :
	require : function(damage){
		if(damage == undefined) damage = {type:"target"}; //For the test function to work
		if(this.used) return false; //Prevent Multiple dodge
		if(damage.type != "target") return false; //Not targeted 
		return this.testRequirements();
	},

	//	activate() : 
	activate : function(damage) {
		damage.status = "Dodged";
		this.end();
		return damage;
	},
},


// 	Second Ability: Gummy Mallet
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		crush : 10
	},

	// 	require() :
	require : function(){
		if( !this.atLeastOneTarget( this.creature.adjacentHexs(1),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return this.testRequirements();	},

	// 	query() :
	query : function(){
		G.grid.queryCreature({
			fnOnConfirm : this.activate, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : this.creature.id,
			flipped : this.creature.player.flipped,
			hexs : this.creature.adjacentHexs(1),
			args : {creature:this.creature, ability: this}
		});
	},




	//	activate() : 
	activate : function(target,args) {
		var ability = args.ability;
		ability.end();

		var damage = new Damage(
			args.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);
	},
},



// 	Thirt Ability: Royal Seal
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
		var swine = this.creature;

		var hexs = G.grid.getFlyingRange(swine.x,swine.y,50,1,0);
		
		//TODO Filtering corpse hexs
		hexs.filter(function(){return true;});
		
		G.grid.hideCreatureHexs(this.creature);
		
		G.grid.queryHexs({
			fnOnCancel : function(){ G.activeCreature.queryMove(); G.grid.clearHexViewAlterations(); },
			fnOnConfirm : this.activate,
			args : {ability:this}, //OptionalArgs
			hexs : hexs,
		});
	},


	//	activate() : 
	activate : function(hex,args) {
		G.grid.clearHexViewAlterations();
		var ability = args.ability;
		ability.end();

		var effects = [
			new Effect(
				"Royal Seal",ability.creature,hex,"onStepIn",
				{ 
					requireFn: function(crea){ return crea !== this.owner; }, 
					effectFn: function(effect,crea){ 
						crea.remainingMove = 0;
						this.trap.destroy();
					},
				}
			),
		]

		var trap = hex.createTrap("royal-seal",effects,ability.creature.player);
		trap.hide();
	},
},



// 	Fourth Ability: Boom Box
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		sonic : 20,
	},

	directions : [0,1,0,0,1,0],

	// 	require() :
	require : function(){
		var test = this.testDirection({
			team : "ennemy",
			directions : this.directions,
		});
		if( !test ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return this.testRequirements();
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : ability.activate, //fnOnConfirm
			flipped : crea.player.flipped,
			team : 0, //enemies
			id : this.creature.id,
			requireCreature : true,
			x : crea.x,
			y : crea.y,
			directions : this.directions,
			args : {creature:crea, ability: ability}
		});
	},


	//	activate() : 
	activate : function(path,args) {
		var ability = args.ability;
		ability.end();		

		var target = G.creatures[path.last().creature];

		var damage = new Damage(
			args.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		)

		target.takeDamage(damage);

		var dir = [];
		switch( path[0].direction ){
			case 0: //Upright
				dir = G.grid.getHexMap(target.x,target.y-8,0,target.flipped,diagonalup).reverse();
				break;
			case 1: //StraitForward
				dir = G.grid.getHexMap(target.x,target.y,0,target.flipped,straitrow);
				break;
			case 2: //Downright
				dir = G.grid.getHexMap(target.x,target.y,0,target.flipped,diagonaldown);
				break;
			case 3: //Downleft
				dir = G.grid.getHexMap(target.x,target.y,-4,target.flipped,diagonalup);
				break;
			case 4: //StraitBackward
				dir = G.grid.getHexMap(target.x,target.y,0,!target.flipped,straitrow);
				break;
			case 5: //Upleft
				dir = G.grid.getHexMap(target.x,target.y-8,-4,target.flipped,diagonaldown).reverse();
				break;
			default:
				break;
		}

		if(dir.length <= 1) return;

		if(dir[1].isWalkable(target.size,target.id,true)){
			target.moveTo(dir[1],{
				ignoreMovementPoint : true,
				ignorePath : true,
				callback : function(){
					G.activeCreature.queryMove();
				},
			});
		}
	},
}

];

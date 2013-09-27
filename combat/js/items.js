var Drop = Class.create({

	initialize : function(name,icon,alterations,x,y){

		this.name 			= name;
		this.id 			= dropID++;
		this.icon 			= icon;
		this.x 				= x;
		this.y 				= y;
		this.pos 			= { x:x, y:y };
		this.alterations 	= alterations;
		this.hex 			= G.grid.hexs[this.y][this.x];

		this.hex.drop = this;

		this.$display = G.grid.$creatureW.append('<img id="drop'+this.id +'" class="drop" src="../drops/'+icon+'.png"/>').children("#drop"+this.id);
		this.$display.css(this.hex.displayPos).hide().fadeIn(500);
	},

	pickup : function(creature){

		G.log("%CreatureName"+creature.id+"% picks up "+this.name.replace("_"," "));
		creature.hint(this.name.replace("_"," "),"msg_effects");
		creature.dropCollection.push(this);

		creature.updateAlteration();
		console.log(creature.stats.health);

		this.hex.drop = undefined;

		$j.each( this.alterations, function(key,value){
			switch(key){
				case "health" : 
					creature.heal(value);
					break;
				case "endurance" : 
					creature.endurance += value;
					break;
				case "energy" : 
					creature.energy += value;
					break;
				case "movement" : 
					creature.remainingMove += value;
					break;
			}
			G.log("%CreatureName"+creature.id+"% gains "+value+" "+key);
		});

		creature.updateAlteration(); //Will cap the stats
		console.log(creature.stats.health);

		this.$display.fadeOut(500);
	}
});
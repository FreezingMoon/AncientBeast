var Drop = Class.create({

	initialize : function(name,health,energy,x,y){

		this.name 			= name;
		this.id 			= dropID++;
		this.x 				= x;
		this.y 				= y;
		this.pos 			= { x:x, y:y };
		this.health			= health;
		this.energy			= energy;
		this.hex 			= G.grid.hexs[this.y][this.x];

		this.hex.drop = this;

		this.display = G.grid.dropGroup.create(this.hex.displayPos.x+54, this.hex.displayPos.y+15, 'drop_'+this.name);
		this.display.alpha = 0;
		this.display.anchor.setTo(.5,.5);
		this.display.scale.setTo(1.5,1.5);
		G.Phaser.add.tween(this.display).to( {alpha:1}, 500, Phaser.Easing.Linear.None ).start();
	},

	pickup : function(creature) {

		G.log("%CreatureName"+creature.id+"% picks up "+this.name);
		creature.hint(this.name,"msg_effects");
		creature.dropCollection.push(this);

		creature.updateAlteration();

		this.hex.drop = undefined;

		if(this.health) {
			creature.heal(this.health);
			G.log("%CreatureName"+creature.id+"% gains "+this.health+" health");
		}
		if(this.energy) {
			creature.energy += this.energy;
			G.log("%CreatureName"+creature.id+"% gains "+this.energy+" energy");
		}

		creature.updateAlteration(); // Will cap the stats

		var drop = this;
		var tween = G.Phaser.add.tween(this.display).to( {alpha:0}, 500, Phaser.Easing.Linear.None ).start();
		tween.onComplete.add(function() { drop.display.destroy(); });
	}
});

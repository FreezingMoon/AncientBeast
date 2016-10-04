/*
* Effect Class
*/
var Effect = Class.create( {

	/* Constructor(name, owner, target, trigger, optArgs)
	*
	* @param {string} name: name of the effect
	*	owner :	Creature : Creature that casted the effect
	*	target :	Object : Creature or Hex : the object that possess the effect
	*	trigger :	String : Event that trigger the effect
	*	@param {object} optArgs: dictionary of optional arguments
	*/
	initialize: function(name, owner, target, trigger, optArgs) {
		this.id = effectId++;

		this.name = name;
		this.owner = owner;
		this.target = target;
		this.trigger = trigger;
		this.creationTurn = G.turn;

		var args = $j.extend( {
			// Default Arguments
			requireFn : function() { return true; },
			effectFn : function() {},
			alterations : {},
			turnLifetime : 0,
			deleteTrigger : "onStartOfRound",
			stackable : true,
			noLog : false,
			specialHint : undefined, // Special hint for log
			deleteOnOwnerDeath: false
		},optArgs);

		$j.extend(this,args);

		G.effects.push(this);
	},

	animation: function() {
		this.activate.apply(this, arguments);
	},

	activate: function(arg) {
		if( !this.requireFn(arg) ) return false;
		if( !this.noLog ) console.log("Effect " + this.name + " triggered");
		if (arg instanceof Creature) {
			arg.addEffect(this);
		}
		this.effectFn(this,arg);
	},

	deleteEffect: function() {
		var i = this.target.effects.indexOf(this);
		this.target.effects.splice(i, 1);
		i = G.effects.indexOf(this);
		G.effects.splice(i, 1);
		this.target.updateAlteration();
		console.log("Effect " + this.name + " deleted");
	},

});

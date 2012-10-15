/*	Class UI
*
*	Object containing UI DOM element, update functions and event managment on UI.
*
*/
var UI = Class.create({

	/*	Attributes
	*	
	*	NOTE : attributes and variables starting with $ are jquery element 
	*	and jquery function can be called dirrectly from them.
	*
	*	$display : 		UI container 
	*	$queue : 		Queue container
	*	$textbox : 		Chat and log container
	*	$activebox : 	Current active creature panel (left panel) container
	*
	*/


	/*	Constructor
	*	
	* 	Create attributes and default buttons
	*
	*/
	initialize: function(){
		this.$display = $j("#ui");
		this.$queue = $j("#queuewrapper");

		this.$button = this.$display.children("#toppanel").children("#rightpanel").append('<div class="button"></div>');
		this.$button.bind('click',function(e){G.endTurn()});
		
		this.$textbox = $j("#textbox > #textcontent");

		this.$activebox = $j("#activebox");
	},


	/*	button()
	*	
	* 	TODO
	*
	*/
	button: function(cssClass,callbackFunction){

	},

	nextCreature: function(){
		this.$queue.children('div.vignette').first().attr("queue","-1").hide(750,function(){ this.remove(); });
		this.updateQueueDisplay();
	},

	/*	updateQueueDisplay()
	*	
	* 	Delete and add element to the Queue container based on the game's queues
	*
	*/
	updateQueueDisplay: function(){ //Ugly as hell need rewrite

		var $vignettes = this.$queue.children('div.vignette');

		//QUEUE 0 (ACTIVE)
		if($vignettes.filter('[queue="0"]').size() == 0){
			$vignettes.each(function(){
				$j(this).attr("queue",$j(this).attr("queue")-1);
			});
		}

		//Prepend Current creature to queue after copying it
		var completeQueue = G.queue.slice(0);
		completeQueue.unshift(G.activeCreature);

		var u = 0;
		
		while( $j(this.$queue).children('div.vignette').size() < 10 || 
			u < $j(this.$queue).children('div.vignette').attr("queue") ){
			var queue = (u==0)? completeQueue : G.nextQueue ;

			$Q = $vignettes.filter('[queue="'+u+'"]');

			for (var i = 0; i < queue.length; i++) {
				if($Q[i] == undefined){
					this.$queue.append('<div queue="'+u+'" creatureid="'+queue[i].id+'" delay="'+queue[i].getDelay()+'" class="vignette p'+queue[i].team+'"></div>');
					$vignettes = this.$queue.children('div.vignette');
					$Q = $vignettes.filter('[queue="'+u+'"]');
					$Q.filter('[creatureid="'+queue[i].id+'"][queue="'+u+'"]').hide().show(750);
				}
				while( $j($Q[i]).attr("creatureid") != queue[i].id ){
					if( $j($Q[i]).attr("delay") > queue[i].getDelay() ) {
						$j($Q[i]).before('<div queue="'+u+'" creatureid="'+queue[i].id+'" delay="'+queue[i].getDelay()+'" class="vignette p'+queue[i].team+'"></div>');
						this.$queue.children('div.vignette').filter('[creatureid="'+queue[i].id+'"][queue="'+u+'"]').hide().show(750);
					}else{
						$j($Q[i]).attr("queue","-1").hide(750,function(){
							this.remove();	
						});
					}
					$vignettes = this.$queue.children('div.vignette');
					$Q = $vignettes.filter('[queue="'+u+'"]');
				}
			};
			u++;
		}
	},

});

var uiButton = Class.create({
	initialize: function(cssClass,callbackFunction){
		//TODO
	},
});
$j(document).ready(function(){
	G = new Game();

	$j(".typeradio").buttonset();
	$j("#startbutton").button();

	$j("form#gamesetup").submit(function(e){
		e.preventDefault(); //prevent submit
		gameconfig = {
			nbrPlayer : $j('input[name="nbrplayer"]:checked').val()-0,
			background_image : $j('input[name="location"]:checked').val(),
			plasma_amount : $j('input[name="plasma"]:checked').val()-0,
			timePool : $j('input[name="time_pool"]:checked').val()*60,
			turnTimePool : $j('input[name="time_turn"]:checked').val()-0,
			creaLimitNbr : $j('input[name="active_units"]:checked').val()-0, //DP counts as One
		};

		if( gameconfig.background_image == "random" ){
			var index = Math.floor(Math.random() * ($j('select[name="background"] option').length - 1) ) + 2;  // nth-child indices start at 1
			gameconfig.background_image = $j('select[name="background"] option:nth-child(' + index + ")").attr("value");
		}
		G.loadGame(gameconfig);
		return false; //prevent submit
	});
});

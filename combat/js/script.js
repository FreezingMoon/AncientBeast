$j(document).ready(function(){
	G = new Game();

	$j("form#gamesetup").submit(function(e){
		e.preventDefault(); //prevent submit
		gameconfig = {
			nbrPlayer: $j('select[name="nbrplayer"]').val()-0,
			background_image : $j('select[name="background"]').val(),
			plasma_amount : $j('select[name="plasma"]').val()-0,
			timePool : $j('select[name="time_pool"]').val()*60,
			turnTimePool : $j('select[name="time_turn"]').val()-0,
		};

		if( gameconfig.background_image == "random" ){
			var index = Math.floor(Math.random() * ($j('select[name="background"] option').length - 1) ) + 2;  // nth-child indices start at 1
			gameconfig.background_image = $j('select[name="background"] option:nth-child(' + index + ")").attr("value");
		}
		G.loadGame(gameconfig);
		return false; //prevent submit
	});
});
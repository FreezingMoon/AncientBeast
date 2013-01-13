$j(document).ready(function(){
	G = new Game();

	$j("form#gamesetup").submit(function(){
		gameconfig = {
			nbrPlayer: $j('select[name="nbrplayer"]').val()-0,
			background_image : $j('select[name="background"]').val(),
			plasma_amount : $j('select[name="plasma"]').val()-0,
			timePool : $j('select[name="time_pool"]').val()*60,
			turnTimePool : $j('select[name="time_turn"]').val()-0,
		};
		G.loadGame(gameconfig);
	});
});
$j(document).ready(function(){
	G = new Game();

	$j("form#gamesetup").submit(function(){
		gameconfig = {
			nbrplayer: $j('select[name="nbrplayer"]').val(),
		}
		G.loadGame(gameconfig);
		$j("#gamesetupcontainer").remove();
	});
});
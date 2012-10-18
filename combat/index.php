<html>
	<head>
		<link rel="stylesheet" type="text/css" href="./css/style.css">
		<script src="//ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"></script>
		<script type="text/javascript" src="./js/jquery.transit.min.js"></script>
		
		<script type="text/javascript">
			var $j = jQuery.noConflict();
		</script>
		<script src="//ajax.googleapis.com/ajax/libs/prototype/1.7.1.0/prototype.js"></script>
		<script type="text/javascript" src="./js/hex.js"></script>
		<script type="text/javascript" src="./js/abilities.js"></script>
		<script type="text/javascript" src="./js/creature.js"></script>
		<script type="text/javascript" src="./js/pathfinding.js"></script>
		<script type="text/javascript" src="./js/game.js"></script>
		<script type="text/javascript" src="./js/ui.js"></script>
		<script type="text/javascript" src="./js/script.js"></script>

		<script type="text/javascript" src="../bestiary/Magma Spawn/abilities.js"></script>		
		<script type="text/javascript" src="../bestiary/Dark Priest/abilities.js"></script>

		<!--google analytics-->	
		<script type="text/javascript">
		var _gaq = _gaq || [];
		_gaq.push(['_setAccount', 'UA-2840181-5']);
		_gaq.push(['_trackPageview']);

		(function() {
			var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
			ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
			var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
		})();
		</script>	
	</head>
	<body>
		<div id="ui">
			<div id="toppanel">
				<div id="queue">
					<div id="queuewrapper"></div>
				</div>
				<div id="rightpanel">
				</div>
				<div id="leftpanel">
					<div id="activebox">
						<div class="vignette"></div>
						<div id="abilities">
							<div ability="0" class="ability"><div class="desc"></div></div>
							<div ability="1" class="ability"><div class="desc"></div></div>
							<div ability="2" class="ability"><div class="desc"></div></div>
							<div ability="3" class="ability"><div class="desc"></div></div>
						</div>
					</div>
				</div>
			</div>
			<div id="bottompanel">
				<div id="textbox">
					<div id="textcontent">
					</div>
				</div>
			</div>
		</div>
		<div id="combatframe">
			<div id="grid">
				<div id="hexsdisplay">
					<?php for ($a=0; $a <= 8; $a++) { 
						if ($a % 2 == 0) {
							for ($i=0; $i <= 15; $i++) {
								echo '<div class="displayhex even_row row_'.$a.'" x="'.$i.'" y="'.$a.'"></div>';
							}
						}else{
							for ($i=0; $i <= 15; $i++) { 
								echo '<div class="displayhex odd_row row_'.$a.'" x="'.$i.'" y="'.$a.'"></div>';
							}
						}
					} ?>
				</div>
				<div id="hexsoverlay">
					<?php for ($a=0; $a <= 8; $a++) { 
						if ($a % 2 == 0) {
							for ($i=0; $i <= 15; $i++) {
								echo '<div class="displayhex even_row row_'.$a.'" x="'.$i.'" y="'.$a.'"></div>';
							}
						}else{
							for ($i=0; $i <= 15; $i++) { 
								echo '<div class="displayhex odd_row row_'.$a.'" x="'.$i.'" y="'.$a.'"></div>';
							}
						}
					} ?>
				</div>
				<div id="creatureWrapper">
				</div>
				<div id="hexsinput">
				<?php for ($a=0; $a <= 8; $a++) { 
					if ($a % 2 == 0) {
						//evenrow
						echo '<div class="even row" row="'.$a.'">';
						for ($i=0; $i <= 14; $i++) { 
							echo '<div class="hex" x="'.$i.'" y="'.$a.'"><div class="physical"></div></div>';
						}
						echo '</div>';
					}else{
						//oddrow
						echo '<div class="odd row" row="'.$a.'">';
						for ($i=0; $i <= 15; $i++) { 
							echo '<div class="hex" x="'.$i.'" y="'.$a.'"><div class="physical"></div></div>';
						}
						echo '</div>';
					}
				} ?>
				</div>
			</div>
		</div>
	</body>
</html>

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
						<div class="ability"></div>
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
						//evenrow
						//echo '<div class="even row" row="'.$a.'">';
						for ($i=0; $i <= 15; $i++) {
							echo '<div class="displayhex even_row row_'.$a.'" x="'.$i.'" y="'.$a.'"></div>';
						}
						//echo '</div>';
					}else{
						//oddrow
						//echo '<div class="odd row" row="'.$a.'">';
						for ($i=0; $i <= 15; $i++) { 
							echo '<div class="displayhex odd_row row_'.$a.'" x="'.$i.'" y="'.$a.'"></div>';
						}
						//echo '</div>';
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
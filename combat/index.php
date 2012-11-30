<?php
/* Ancient Beast - Free Open Source Online PvP TBS: card game meets chess, with creatures.
 * Copyright (C) 2007-2012  Valentin Anastase (a.k.a. Dread Knight)
 *
 * This file is part of Ancient Beast.
 *
 * Ancient Beast is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Ancient Beast is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * http://www.AncientBeast.com
 * https://github.com/FreezingMoon/AncientBeast
 * DreadKnight@FreezingMoon.org
 */

// Utility
if(!file_exists(dirname(__FILE__) . "/../config.php"))
	die("Warning: config.php not found, please edit config.php.in to point to a database and save it as config.php<br>Disclaimer: Since this project is web based, you can use the code and assets along with database.sql to host Ancient Beast yourself for testing and development purposes only! Also, your version should not be indexable by search engines because that can cause harm to the project!");
require_once("../config.php");
require_once('../bestiary/cards.php');

// Database
$db_connection = NULL;
function db_connect() {
	global $db_connection, $db_info;
	if(!is_null($db_connection))
		return false;
	$db_connection = mysql_connect($db_info["host"], $db_info["username"], $db_info["password"]);
	if($db_connection === false) {
		// TODO: redirect/display to static error page
		die("Server connection issues...");
		return false;
	}
	mysql_select_db($db_info["database"]);
	mysql_query("SET NAMES 'utf8'");
	return true;
}
function db_execute($query) {
	global $db_connection;
	if($db_connection === false)
		return false;
	if(is_null($db_connection))
		if(!db_connect())
			return false;

	$r = mysql_query($query);
	if($r === false) return false;
	return true;
}
function db_query($query) {
	global $db_connection;
	if($db_connection === false)
		return false;
	if(is_null($db_connection))
		if(!db_connect())
			return false;

	$r = mysql_query($query);
	if($r === false) return false;
	if(mysql_num_rows($r) > 0) {
		$o = array();
		$i = 0;
		while ($row = @mysql_fetch_assoc($r)) {
			$o[$i] = array();
			foreach($row as $k => $v)
				$o[$i][$k] = $v;
			$i++;
		}
		return $o;
	}
	return true;
}

?>
<html>
	<head>
		<link rel="stylesheet" type="text/css" href="./css/style.css">
		<link rel="stylesheet" type="text/css" href="./css/grid.css">
		<script src="//ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"></script>
		<script src="//ajax.googleapis.com/ajax/libs/jqueryui/1.9.0/jquery-ui.min.js"></script>
		<script type="text/javascript" src="./js/jquery.transit.min.js"></script>
		<script type="text/javascript" src="./js/jquery.kinetic.js"></script>
		<script type="text/javascript" src="./js/mousewheel.js"></script>

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
		<script type="text/javascript" src="../bestiary/Impaler/abilities.js"></script>
		<script type="text/javascript" src="../bestiary/Snow Bunny/abilities.js"></script>

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
		<div id="matchmaking">
			<div id="loader"><img src="../images/AB.gif">Loading</div>
			<div id="gamesetupcontainer">
				<form id="gamesetup" action="javascript:0;">
					Players : 
					<select name="nbrplayer">
						<option value="2">1vs1</option>
						<option value="4">2vs2</option>
					</select><br/>
					<input type="submit" value="Submit">
				</form>
			</div>
		</div>
		<div id="ui" style="display:none;">
			<div id="dash" class="selected0">
				<div id="return" class="toggledash button"></div>
				<div id="tooltip"></div>
				<div id="playertabswrapper">
					<div class="playertabs p0"  player="0">Player1<p class="plasma">Plasma 0</p>
					</div><div class="playertabs p2" player="2">Player3<p class="plasma">Plasma 0</p>
					</div><div class="playertabs p1" player="1">Player2<p class="plasma">Plasma 0</p>
					</div><div class="playertabs p3" player="3">Player4<p class="plasma">Plasma 0</p>
					</div>
				</div>
				<div id="cardwrapper">
					<div id="card"><?php cards("",0); ?></div>
				</div>
				<div id="creaturegridwrapper"><?php
						require_once('../bestiary/grid.php');
						creatureGrid(false);
						?></div>
			</div>
			<div id="toppanel">
				<div id="queue">
					<div id="queuewrapper"></div>
				</div>
				<div id="playerbutton" class="toggledash vignette active"><div></div></div>
				<div id="playerinfos">
					<p class="name"></p>
					<p class="points"><span></span> Points</p>
					<p class="plasma"><span></span> Plasma</p>
				</div>
				<div id="rightpanel">
					<div id="end" class="button"></div>
					<div id="delay" class="button"></div>
					<div id="surrender" class="button"></div>
				</div>
				<div id="leftpanel">
					<div id="activebox">
						<div id="abilities">
							<div ability="0" class="ability button"><div class="desc"><p></p></div></div>
							<div ability="1" class="ability button"><div class="desc"><p></p></div></div>
							<div ability="2" class="ability button"><div class="desc"><p></p></div></div>
							<div ability="3" class="ability button"><div class="desc"><p></p></div></div>
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
		<div id="combatwrapper">
			<div id="combatframe" style="display:none;">
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
		</div>
	</body>
</html>

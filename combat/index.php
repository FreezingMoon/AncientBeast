<title>Ancient Beast 0.1</title>
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
		<meta charset='utf-8'> 
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
<!-- 				<div id="players" style="float:left; margin-left:550px;">
					<div style="margin-left:auto;"><h2>Players</h2></div>
					<div value="2" style="border:2px solid red;">
						<div><img src="../bestiary/Dark Priest/avatar-red.jpg"></div>
						<div style="margin-left:auto; font-weight:strong; padding:5px; background: rgba(0,0,0,.8);">1 versus 1</div>
						<div><img src="../bestiary/Dark Priest/avatar-blue.jpg"></div>
					</div>
					<div style="height:50px;"></div>
					<div value="4" style=" border:2px solid grey;">
						<div id="teamA">
							<div><img src="../bestiary/Dark Priest/avatar-red.jpg"></div>
							<div><img src="../bestiary/Dark Priest/avatar-orange.jpg"></div>
						</div>
					
						<div style="margin-left:auto; font-weight:strong; padding:5px; background: rgba(0,0,0,.8);">2 versus 2</div>

						<div id="teamB">
							<div><img src="../bestiary/Dark Priest/avatar-blue.jpg"></div>
							<div><img src="../bestiary/Dark Priest/avatar-green.jpg"></div>
						</div>
					</div>
				</div>

				<div id="location" style="float:left; margin-left:50px;">
					<div style="margin-left:auto;"><h2>Location</h2></div>
					<div style="width:480px; border:2px solid red; margin-left:auto; background: rgba(0,0,0,.8);"><h3>Random</h3></div>
					<img style="width:480px; border:2px solid grey; background: rgba(0,0,0,.8);" src="../locations/Dark Forest/bg.jpg"><br>
					<img style="width:480px; border:2px solid grey; background: rgba(0,0,0,.8);" src="../locations/Frozen Skull/bg.jpg"><br>
					<img style="width:480px; border:2px solid grey; background: rgba(0,0,0,.8);" src="../locations/Shadow Cave/bg.jpg">
				</div>

				<div id="mode" style="float:left; margin-left:50px;">
					<div style="margin-left:auto;"><h2>Mode</h2></div>
					<div style="border:2px solid red; background: rgba(0,0,0,.8);">Full</div>
					<div style="border:2px solid grey; background: rgba(0,0,0,.8);">Casual</div>
					<div style="border:2px solid grey; background: rgba(0,0,0,.8);">Sinner</div>
					<div style="border:2px solid grey; background: rgba(0,0,0,.8);">Trivia</div>
					<div style="border:2px solid grey; background: rgba(0,0,0,.8);">Ranked</div>
					<div></div>
					<div><h2>Plasma</h2></div>
					<div style="border:2px solid red; background: rgba(0,0,0,.8);">50</div>
					<div style="border:2px solid grey; background: rgba(0,0,0,.8);">60</div>
					<div style="border:2px solid grey; background: rgba(0,0,0,.8);">70</div>
					<div style="border:2px solid grey; background: rgba(0,0,0,.8);">80</div>
					<div style="border:2px solid grey; background: rgba(0,0,0,.8);">90</div>
					<div><h2>Time</h2></div>
					<div style="border:2px solid red; background: rgba(0,0,0,.8);">5</div>
					<div style="border:2px solid grey; background: rgba(0,0,0,.8);">6</div>
					<div style="border:2px solid grey; background: rgba(0,0,0,.8);">7</div>
					<div style="border:2px solid grey; background: rgba(0,0,0,.8);">8</div>
					<div style="border:2px solid grey; background: rgba(0,0,0,.8);">∞</div>
					<div><h2>Turn</h2></div>
					<div style="border:2px solid red; background: rgba(0,0,0,.8);">20</div>
					<div style="border:2px solid grey; background: rgba(0,0,0,.8);">40</div>
					<div style="border:2px solid grey; background: rgba(0,0,0,.8);">60</div>
					<div style="border:2px solid grey; background: rgba(0,0,0,.8);">80</div>
					<div style="border:2px solid grey; background: rgba(0,0,0,.8);">∞</div>
					<div><h2>Match</h2></div>
					<div style="border:2px solid red; background: rgba(0,0,0,.8);">1</div>
					<div style="border:2px solid grey; background: rgba(0,0,0,.8);">3</div>
					<div style="border:2px solid grey; background: rgba(0,0,0,.8);">5</div>
					<div style="border:2px solid grey; background: rgba(0,0,0,.8);">7</div>
					<div style="border:2px solid grey; background: rgba(0,0,0,.8);">∞</div>
					<div><h2>FIGHT</h2></div>
				</div> -->


				<form id="gamesetup" action="javascript:0;">
					Players : 
					<select name="nbrplayer">
						<option value="2">1vs1</option>
						<option value="4">2vs2</option>
					</select><br/><br/>

					Location : 
					<select name="background">
						<option value="Dark Forest">Dark Forest</option>
						<option value="Frozen Skull">Frozen Skull</option>
						<option value="Shadow Cave">Shadow Cave</option>
					</select><br/><br/>

					Plasma : 
					<select name="plasma">
						<option value="40">40</option>
						<option value="50">50</option>
						<option value="60">60</option>
						<option value="70">70</option>
						<option value="80">80</option>
						<option value="90">90</option>
					</select><br/>

					Time pool (for each player) : 
					<select name="time_pool">
						<option value="-1">∞</option>
						<option value="1">1 min</option>
						<option value="2">2 min</option>
						<option value="3">3 min</option>
						<option value="5">5 min</option>
						<option value="6">6 min</option>
						<option value="7">7 min</option>
						<option value="8">8 min</option>
					</select><br/>

					Turn time : 
					<select name="time_turn">
						<option value="-1">∞</option>
						<option value="20">20 sec</option>
						<option value="40">40 sec</option>
						<option value="60">60 sec</option>
						<option value="80">80 sec</option>
					</select><br/>

					<input type="submit" value="Submit">
				</form>
			</div>
		</div>
		<div id="ui" style="display:none;">
			<div id="endscreen" style="display:none;">
				<div id="scoreboard">
					<h1>Match Over</h1>
					<table id="score">
						<tbody>
							<tr class="player_name">
								<td>Players</td>
								<td>Player 1</td>
								<td>Player 2</td>
								<td>Player 3</td>
								<td>Player 4</td>
							</tr>
							<tr class="firstKill">
								<td>First blood</td>
								<td>--</td>
								<td>--</td>
								<td>--</td>
								<td>--</td>
							</tr>
							<tr class="kill">
								<td>Kills</td>
								<td>--</td>
								<td>--</td>
								<td>--</td>
								<td>--</td>
							</tr>
							<tr class="deny">
								<td>Denies</td>
								<td>--</td>
								<td>--</td>
								<td>--</td>
								<td>--</td>
							</tr>
							<tr class="humiliation">
								<td>Humiliation</td>
								<td>--</td>
								<td>--</td>
								<td>--</td>
								<td>--</td>
							</tr>
							<tr class="total">
								<td>Total</td>
								<td>--</td>
								<td>--</td>
								<td>--</td>
								<td>--</td>
							</tr>
						</tbody>
					</table>
					<p></p>
				</div>
			</div>
			<div id="dash" class="selected0">
				<div id="return" class="toggledash button"></div>
				<div id="tooltip"></div>
				<div id="playertabswrapper">
					<div class="playertabs p0"  player="0">Player1<p class="score">0 Score</p><p class="plasma">0 Plasma</p><p class="timepool"> Time</p>
					</div><div class="playertabs p2" player="2">Player3<p class="score">0 Score</p><p class="plasma">0 Plasma</p><p class="timepool"> Time</p>
					</div><div class="playertabs p1" player="1">Player2<p class="score">0 Score</p><p class="plasma">0 Plasma</p><p class="timepool"> Time</p>
					</div><div class="playertabs p3" player="3">Player4<p class="score">0 Score</p><p class="plasma">0 Plasma</p><p class="timepool"> Time</p>
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
				<div id="playerinfos" style="cursor:default;">
					<p class="name"></p>
					<p class="points"><span></span> Points</p>
					<p class="plasma"><span></span> Plasma</p>
					<p class="time"><span>∞</span> Time</p>
				</div>
				<div id="rightpanel">
					<div id="end" class="button"></div>
					<div id="delay" class="button"></div>
					<div id="surrender" class="button"></div>
				</div>
				<div id="leftpanel">
					<div id="activebox">
						<div id="abilities">
							<div ability="0" class="ability button" style="cursor:default;"><div class="desc"><p></p></div></div>
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

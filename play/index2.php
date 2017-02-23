<?php
/* Ancient Beast - Free Open Source Online PvP TBS: card game meets chess, with creatures.
 * Copyright (C) 2007-2014  Valentin Anastase (a.k.a. Dread Knight)
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
 * https://www.AncientBeast.com
 * https://github.com/FreezingMoon/AncientBeast
 * DreadKnight@FreezingMoon.org
 */

$page_title = "Play";

$style = '
.strike { text-decoration: line-through; }
#bar {
	background: transparent;
	width: 100%;
	height: 25px;
	position: relative;
	margin-top: -35px;
}
#bar a {
	text-decoration: none;
	text-shadow: none;
	font-weight: bold !important;
	font-family: Verdana,Arial,sans-serif;
	font-size: .9em !important;
	padding: 2px 7px !important;
	cursor: pointer;
	border-radius: 4px;
	border: 1px solid #d3d3d3;
	color: #555555;
	background: rgb(255,255,255); /* Old browsers */
	background: linear-gradient(to bottom, rgba(255,255,255,1) 0%,rgba(241,241,241,1) 50%,rgba(225,225,225,1) 51%,rgba(246,246,246,1) 100%);
}
#bar a:hover { background: white; color: black; }
iframe.fullscreen { padding-top: 0; }

progress[value] {
	/* Reset the default appearance */
	-webkit-appearance: none;
	-moz-appearance: none;
	appearance: none;
  
	/* Get rid of default border in Firefox. */
	border: none;
  
	/* Dimensions */
	width: 250px;
	height: 20px;
}
progress[value]::-webkit-progress-bar {
	color: red;
	background-color: #eee;
	border-radius: 2px;
	box-shadow: 0 2px 5px rgba(0, 0, 0, 0.25) inset;
}
';

require_once('../header.php');
require_once('../global.php');
$mode = isset($_GET['mode']) ? $_GET['mode'] : 'default';

// User data
$data = mysqli_query($link, "SELECT * FROM `ab_users` WHERE `id`='" . $_SESSION['id'] . "'");
$userdata = mysqli_fetch_array($data);
$username = $userdata['username'];

// Gravatar
$email = $userdata['email'];
$default = $site_root . 'images/AB-symbol.png';
$grav_url = 'http://www.gravatar.com/avatar/' . md5(strtolower(trim($email))) . '?d=' . urlencode($default) . '&s=70&r=g';
?>

<!-- Hightlight active page -->
<script>document.getElementById("<?php echo $page_title; ?>").className += " active";</script>

<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js"></script>
<script src="launcher/jquery.fullscreen-min.js"></script>

<script type="text/javascript">
$(document).ready(function(){
	$(document).bind("fullscreenchange", function() {
		$('#game').toggleClass('fullscreen');
	});
});
</script>

<?php
switch ($mode) {
	default:
		?>
		<div id="bar">
			<a onclick="if(confirm('Reset Game?')) var ifr=document.getElementsByName('game')[0]; ifr.src=ifr.src;" style="margin-left: 5px;"><img src="reset.svg" style="margin-bottom: 3px;"> Reset Game</a>
			<a onclick="$('#game').fullScreen(true)" style="margin-left: 660px;">Fullscreen <img src="fullscreen.svg" style="margin-bottom: 3px;"></a>
		</div>
		<div class="center">
			<iframe id="game" name="game" src="../game/" style="border: 4px ridge; border-color: grey; width: 934px; height: 525px;" seamless webkitAllowFullScreen mozAllowFullScreen allowFullScreen></iframe>
		</div>

		<!--<div class="div center">Match history<br>Show latest matches along with some info, such as mode, outcome, date. Should allow replay/share.</div>
		<div class="div center">Player stats and awards<br>Show number of won/draw/lost/surrendered games and the number of firt kills/denies/bloods/humiliations/annihilation/immortals/etc.</div>-->

		<?php
		// TODO: Show army power, stats, achievements, perks, latest matches, sponsor banner
		?>
		<!-- Game modes -->
		<div class="center" id="social">
			<div style="display: inline-block;" class="lighten">
				<a href="?mode=kingdom"><img src="../images/squares/kingdom.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Kingdom Wars</div></a>
			</div>
			<div style="display: inline-block;" class="lighten">
				<a href="?mode=duels"><img src="../images/squares/contribute.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Hardcore Duels</div></a>
			</div>
			<div style="display: inline-block;" class="lighten">
				<a href="?mode=tournament"><img src="../images/squares/deviantart.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png); ;">Monthly Tournament</div></a>
			</div>
		</div>
		</div>
		<?php
		break;

	case 'kingdom':
		?>
		<div class="center">
			<a href="?view=settings"><div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Check Ladder</div></a>
			<a href="?view=settings"><div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Combat Log</div></a>
			<a href="?view=settings"><div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">View Allies</div></a>
		</div>

		<img src='../images/realms/pride.jpg' width=942px; style="border-color: violet;" class="realm-image"><br><br>

		<?php
		// Display list of resources
		$sections = array(
			'gold',
			'wood',
			'ore',
			'gems',
			'mercury',
			'sulfur',
			'crystals'
		);
		echo '<nav class="div center"><ul class="sections">';
		foreach ($sections as &$sectionItem) {
			echo '<li style="display:inline;"><span id="' . $sectionItem . '" style="padding:1.5em;">' . rand(0, 50) . ' ' . ucfirst($sectionItem) . '</span></li>';
		}
		echo '</ul></nav>';
		?>

		<!-- Account info -->
		<!-- TODO: Only show this page when logged in -->
		<div class="div center">
			<!-- TODO: When clicking a bar, highlight it and toggle on a div with more info about it -->
			<div style="display: inline-block; float: left; margin-top: 10px; width: 220px;">
				<a href="" style="display: block;" title="Check Learned Skills"><progress value=".32" style="width: 220px;"></progress>
				<span style="position: absolute; margin-left: -35px; margin-top: -21px; color: black; text-shadow: none;">Level 11</span></a><br>
				<a href="" style="display: block;" title="Check Match History"><progress value=".30" style="width: 220px;"></progress>
				<span style="position: absolute; margin-left: -60px; margin-top: -21px; color: black; text-shadow: none;">30% Experience</span></a><br>
				<a href="" style="display: block;" title="Check Earned Trophyes"><progress value=".18" style="width: 220px;"></progress>
				<span style="position: absolute; margin-left: -70px; margin-top: -21px; color: black; text-shadow: none;">18% Achievements</span></a>
			</div>

			<!-- Account avatar / settings button -->
			<div style="display: inline-block; float: center;">
			<a href="<?php echo $site_url; ?>account" class="lighten" style="float:right;"><img src="<?php echo $grav_url; ?>" title="Change settings" alt="avatar" width=70px height=70px style="position: absolute; margin-top: 20px; margin-left: 165px;">
			<img src="<?php echo $site_root; ?>images/wings.png"><br><b><?php echo $username; ?></b></a>
			</div>

			<!-- TODO: When clicking a bar, highlight it and toggle on a div with more info about it -->
			<div style="display: inline-block; float: right; margin-top: 10px; width: 220px;"">
				<a href="" style="display: block;" title="Check Learned Skills"><progress value=".33" style="width: 220px;"></progress>
				<span style="position: absolute; margin-left: -40px; margin-top: -21px; color: black; text-shadow: none;">Plasma 33</span></a><br>
				<a href="" style="display: block;" title="Check Match History"><progress value=".65" style="width: 220px;"></progress>
				<span style="position: absolute; margin-left: -65px; margin-top: -21px; color: black; text-shadow: none;">65% Victory Rate</span></a><br>
				<a href="" style="display: block;" title="Check Earned Trophyes"><progress value=".40" style="width: 220px;"></progress>
				<span style="position: absolute; margin-left: -50px; margin-top: -21px; color: black; text-shadow: none;">Integrity 40%</span></a>
			</div>
		</div>

		<div class="div center">Show the town
		</div>

		<div class="div center"><h3>Skills & Perks</h3>

		</div>

		<?php
		break;

	case 'duels':
		?>
		<!-- TODO: explain how the duel / bet system works -->

		<div class="div" style="text-align: justify;">
		At some point in the future you and others who want to become professional players or simply make some pocket money will be able to battle for <a href="http://bitcoin.com" target="_blank"><b>Bitcoins</b></a> or bet on the outcome of upcoming matches for a small 1% fee. The game is free and you can spend as much time as you like improving your skills before trying your luck at it. It was carefully designed to allow anyone equal chances while avoiding any randomness, relying only on skills. Below I've included a fictional example table, meanwhile feel free to <a href="<?php echo $site_root; ?>contribute"><b>contribute</b></a> in order to get there a bit faster.
		</div>

		<div class="div">
		<table width=100%>
		<div class="center" style="font-size: 24px; font-weight: bold;">Upcoming Matches</div><br>
		<tr><th>Start</th><th>Type</th><th>Left Side</th><th>Right Side</th><th>Stake</th><th>Sponsor</th><th>Ratio</th><th>Your Bet</th><th>Potential</th></tr>
		<tr><td>12:00</td><td>1vs1</td><td>Dread Knight <span style="color: red;">●</span></td><td>Super Giani <span style="color: blue;">●</span></td><td>2 BTC</td><td>KFC</td><td>1 to 7</td><td>0.10 BTC</td><td>0.67 BTC</td></tr>
		<tr><td>14:00</td><td>1vs1</td><td>Scorpion Eater <span style="color: red;">●</span></td><td>Metal Shreder <span style="color: blue;">●</span></td><td>2 BTC</td><td>Razer</td><td>1 to 5</td><td>0.05 BTC</td><td>0.24 BTC</td></tr>
		</table>
		</div>

		<div class="div">
		<table width=100%>
		<div class="center" style="font-size: 24px; font-weight: bold;">Current Matches</div><br>
		<tr><th>Start</th><th>Type</th><th>Left Side</th><th>Right Side</th><th>Stake</th><th>Sponsor</th><th>Ratio</th><th>Your Bet</th><th>Potential</th></tr>
		<tr><td>10:00</td><td>1vs1</td><td>Dread Knight <span style="color: red;">●</span></td><td>Super Giani <span style="color: blue;">●</span></td><td>2 BTC</td><td>Alienware</td><td>1 to 7</td><td>0.10 BTC</td><td>0.67 BTC</td></tr>
		<tr><td>11:00</td><td>1vs1</td><td>Soul Eater <span style="color: red;">●</span></td><td>King Kong <span style="color: blue;">●</span></td><td>1 BTC</td><td>Intel</td><td>1 to 5</td><td>0.05 BTC</td><td>0.24 BTC</td></tr>
		</table>
		</div>

		<div class="div">
		<table width=100%>
		<div class="center" style="font-size: 24px; font-weight: bold;">Finished Matches</div><br>
		<tr><th>Start</th><th>Finish</th><th>Type</th><th>Left Side</th><th>Right Side</th><th>Stake</th><th>Sponsor</th><th>Ratio</th><th>Your Bet</th><th>Net Profit</th></tr>
		<tr><td>10:00</td><td>10:48</td><td>1vs1</td><td>Full Sonic <span style="color: red;">●</span></td><td><s>Noob Saibot <span style="color: blue;">●</span></s></td><td>4 BTC</td><td>Coca-Cola</td><td>1 to 5</td><td>0.05 BTC</td><td>0.24 BTC</td></tr>
		<tr><td>12:00</td><td>12:52</td><td>1vs1</td><td><s>Motaro Fan <span style="color: red;">●</s></span></td><td>Epic Grunt <span style="color: blue;">●</span></td><td>3 BTC</td><td>McDonalds</td><td>1 to 7</td><td>0.10 BTC</td><td>0 Bitcoins</td></tr>

		</table>
		</div>
		<?php
		break;

	case 'tournament':
		?>
		<div class="center">
			<a href="?view=settings"><div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Bitcoin Gambling</div></a>
			<a href="?view=settings"><div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Previous Champions</div></a>
			<a href="?view=settings"><div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Official Sponsors</div></a>
		</div>
		<div class="div center">display dates (countdown + spactate/play button), divisions, brackets, entry fee</div>
		<?php
		break;
}

include('../footer.php'); ?>

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

$style = '
a.FM:hover { text-shadow: black 0.1em 0.1em 0.2em, blue 0 0 10px; }
.image { cursor: pointer; display: inline-block; padding-left: 10px; }
.small { width: 128px; height: 128px; }';

require_once('header.php'); 
?>
<article>
<div class="div center">
	<!-- Featured News Article -->
	<div style="display: inline-block; cursor: pointer;" class="lighten">
		<a href="news/2013-06-15"><img src="news/2013-06-15/thumb.jpg"><br>
		<b>See Version 0.2 Changelog</b></a>
	</div>
	<div style="display: inline-block; cursor: pointer;" class="lighten">
		<a href="contribute"><img src="images/squares/contribute.jpg"><br>
		<b>Learn How to Contribute</b></a>
	</div>
	<div style="display: inline-block; cursor: pointer;" class="lighten">
		<a href="combat"><img src="images/squares/play.jpg"><br>
		<b>Play the Game for Free</b></a>
	</div>
</div>

<div class="div" id="intro">
<div style="width: 475px; text-align: justify; display:inline-block;">
<h3 class="indexheader"><a href="#intro">Intro</a></h3>
<p>
<b>Ancient Beast</b> is a turn based strategy indie game project, played against other people (or bots) in hotseat or online modes, featuring a wide variety of units to acquire and put to good use in order to defeat all your opponents in battle.<br>This project was carefully designed to be easy to learn, fun to play and hard to master. We hope you'll enjoy it as well!
</p><p>
Ancient Beast is <a href="http://www.wuala.com/AncientBeast" target="_blank">free</a>, <a href="https://github.com/FreezingMoon/AncientBeast" target="_blank">open source</a> and developed by <a href="http://www.FreezingMoon.org" target="_blank" class="FM"><b>Freezing Moon</b></a> (and community). It uses web languages such as HTML, PHP and JavaScript, so that it's playable from any modern browser without the need of any plugins.</p></div>
<div style="display: inline-block;" class="center lighten"><a href="media/?type=screenshots#id=0"><img src="images/screenshots.gif" class="image" width=400px height=225px><br><b>Check out some screenshots!</b></a></div>
</div>

<div class="div center">
<table width=100%;>
	<tr>
		<td width=25%;><img src="images/features/heart.png" class="small"><br>
				Fun Gameplay<br>
				Easy to Learn<br>
				Very Replayable<br>
				Hard to Master
		</td>
		<td width=25%;><img src="images/features/earth.png" class="small"><br>
				<b>Browser Based</b><br>
				<b>Optional Account</b><br>
				<b>Open Source</b><br>
				Translations
		</td>
		<td width=25%;><img src="images/features/power.png" class="small"><br>
				<b>Free to Play</b><br>
				Input Methods<br>
				<b>Light Weight</b><br>
				Low Latency
		</td>
		<td width=25%;><img src="images/features/chair.png" class="small"><br>
				Play-to-Win Prizes<br>
				Various Game Modes<br>
				Online Multiplayer<br>
				<b>Hotseat</b> and Bots
		</td>
	</tr>
</table>
</div>

</article>
<?php include('footer.php'); ?>
<script>
function toggleSound() {
	var audioElem = document.getElementById('narration');
	if (audioElem.paused) audioElem.play();
	else audioElem.pause();
}
</script>

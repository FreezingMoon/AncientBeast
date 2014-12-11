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
$style = '
.strike {
	text-decoration: line-through;
}
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
#bar a:hover {background: white; color: black;}
iframe.fullscreen {padding-top: 0;}
';

$page_title = "Ancient Beast - Game";
require_once('../header.php');
?>

<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js"></script>
<script src="launcher/jquery.fullscreen-min.js"></script>

<script type="text/javascript">
$(document).ready(function(){
	$(document).bind("fullscreenchange", function() {
		$('#game').toggleClass('fullscreen');
	});
});
</script>

<div id="bar">
	<a onclick="if(confirm('Reset Game?')) var ifr=document.getElementsByName('game')[0]; ifr.src=ifr.src;" style="margin-left: 15px;">Reset Game</a>
	<a onclick="$('#game').fullScreen(true)" style="margin-left: 682px;">Fullscreen</a>
</div>
<div class="center">
	<iframe id="game" name="game" src="../combat/" style="border: 4px ridge; border-color: grey; width: 934px; height: 525px;" seamless webkitAllowFullScreen mozAllowFullScreen allowFullScreen></iframe>
</div>

<div class="div" id="plot">
<div style="width: 475px; text-align: justify; display:inline-block;">
<h3 class="indexheader"><a href="#plot">Plot</a></h3>
<p>
It's the year 2653. In the last centuries, technology advanced exponentially and everyone had a fair chance of playing God. With help from the <a href="http://reprap.org/" target="_blank"><b>RepRap</b></a> project, a free desktop 3d printer, which gave anyone power to build their own weapon factory or genetic laboratory on their own property. Mechanic parts or genetic modifications turned from a fashion option into a requirement for daily survival.
</p><p>
Despite their combined efforts, the world's governments couldn't prevent the world from plunging into chaos. The Earth has become a battlefield, split between 7 factions fighting for dominion over the ravaged landscape. The apocalypse is here and only the strong ones will surpass it.
</p>
<div class="center"><audio id="narration" controls src="plot.ogg" style="width:475px;"></audio></div>
<br>
</div>

<img src="../images/hand.png" class="image lighten" width=400px height=387px onclick="toggleSound();" title="Click to play narrative"></div>
<audio id="narration" src="plot.ogg"></audio>

<?php
disqus();
include('../footer.php'); ?>

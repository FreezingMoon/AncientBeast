<!--//include copyright info
//include style as php variable
//include header
//content
//footer?
-->


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
.bigger {
	font-size: 28px;
}
.realms {
	height: 370px;
	text-align: center;
	padding-top: 10px;
	width: 890px;
	font-weight: bold;
}
.name_footer_realm {
	position: absolute;
	bottom: 20px;
	text-align: center;
	width: 127px;
	height:20px;
	font-size: 15px;
	z-index:999;
}
.name_bg {
	position: absolute;
	bottom: 21px;
	width: 127px;
	height:20px;
	background-color:#000;
	opacity:0.5;
}
.cut_hover {
	width:127px;
	height:400px;
}
a.FM:hover {
	text-shadow: black 0.1em 0.1em 0.2em, blue 0 0 10px;
}';
require_once('header.php'); 
?>
<script type="application/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.4/jquery.min.js"></script>
<script type="application/javascript" src="media/fancybox/jquery.fancybox-1.3.4.pack.js"></script>
<script type="application/javascript" src="media/fancybox/jquery.easing-1.3.pack.js"></script>
<script type="application/javascript" src="media/fancybox/jquery.mousewheel-3.0.4.pack.js"></script>
<link rel="stylesheet" href="media/fancybox/jquery.fancybox-1.3.4.css" type="text/css" media="screen">
<script type="application/javascript">
$(document).ready(function() {
	var basePage = window.location.href.replace(/#.*/, "");
	$("a[rel=pop]").fancybox({
		'overlayColor'  : 'black',
		'transitionIn'	: 'elastic',
		'transitionOut'	: 'elastic',
		'onComplete'	: function(array, index) {
			history.replaceState("", "", basePage + "#id=" + index);
		},
		'onClosed'		: function() {
			history.replaceState("", "", basePage);
		}
	});
	
	if (/[\#&]id=(\d+)/.test(location.hash))
		$("#img" + RegExp.$1).trigger("click");
});
</script>

<article>
<!--replace video with image that opens lightbox player on click, also include images (screenshots) on homepage along with features
WATCH TRAILER // + screenies
<div class="center"><iframe width="880" height="495" src="//www.youtube.com/embed/cAgf9hKGI3k?list=PLADfTwuzK0YQG6rKWImoeKlpVZy9dj_XI" frameborder="0" allowfullscreen></iframe></div>
-->
<div class="center">

<div style="width:55%; background: rgba(0, 0, 0, 0.8); border-radius: 15px; display: inline-block; padding: 20px; margin: 20px;">
<h3 class="indexheader"><a href="#gameplay">Intro</a></h3>
<p>
<b>Ancient Beast</b> is a turn based strategy indie game project, played online against other people, featuring a wide variety of creatures to aquire and items to equip onto, putting them to use in order to defeat your opponents.
<p>
Ancient Beast is <a href="http://www.wuala.com/AncientBeast" target="_blank">free</a>, <a href="https://github.com/FreezingMoon/AncientBeast" target="_blank">open source</a> and developed by <a href="http://www.FreezingMoon.org" target="_blank" class="FM"><b>Freezing Moon</b></a> (and community). It uses web languages such as HTML, PHP and JavaScript, so that it's playable from any modern browser without the need of plugins.<br>This project was carefully designed to be easy to learn, fun to play and hard to master. We hope you'll enjoy it!
</p>

<h3 class="indexheader"><a href="#gameplay">Gameplay</a></h3>
<p>
Fights take place between 2 - 4 players, on a variety of visual combat fields, the grid being 16x9 hexagons. Plasma is a vital resource during combat, keeping players away from harm while also allowing them to materialize units in order to defend themselves or vanquish foes. Winner of the match is usually the last player standing, but when time limits are involved, the played with highest score can win. Killing creatures results in score points, also each unit drops a specific power-up that can aid more or less when picked up.
</p>
<p>
Players are represented on the combat field by Dark Priests. All creature stats can be improved by purchasing items.
Players can level up by gaining experience on the combat field, gaining 1 more plasma point each level, being able to materialize more and/or better creatures. In order to materialize a creature you own, it takes a number of plasma points equal to the creature's level plus the number of hexagons it occupies. Any creature owned can be materialized once per combat, provided the player has enough plasma points to do so.<br>
When fighting players of lower levels, you will temporarely lose plasma points in order to balance the fight.
</p>
<h3 class="indexheader"><a href="#gameplay">Plot</a></h3>
<p>
It's the year 2653. In the last centuries, technology advanced exponentially and everyone had a fair chance of playing God. With help from the RepRap project, a free desktop 3d printer, which gave anyone power to build their own weapon factory or genetic laboratory on their own property. Mechanic parts or genetic modifications turned from a fashion option into a requirement for survival.

Despite their combined efforts, the world's governments couldn't prevent the world from plunging into chaos. The Earth has become a battlefield; split between 7 factions fighting for dominion over the ravaged landscape. The apocalypse is here, and only the strong will survive.
</p>
<?php
echo '<div class="center">';
$images = scandir('media/screenshots');
natsort($images);
$i = 0;
foreach($images as $image) {
	if($image == '.' || $image == '..') continue;
	$title = substr($image, 0, -4);
	$image = str_replace(' ', '%20', $image);
	echo '<a id="img' . $i . '" rel="pop" href="media/screenshots/' . $image . '" title="' . $title . '"><img class="shadow" style="width:280px; margin:5px;" src="media/screenshots/' . $image . '" title="' . $title . '" alt="' . $image . '"></a>';
	$i++;
} echo '</div>';?>
</div>

<!--second part-->

<div style="width:35%; display: inline-block; background: rgba(0, 0, 0, 0.8); border-radius: 15px; display: inline-block; padding: 20px; margin: 20px;">
<p>
After engaging in combat, players are taken to the battle field where both parties take turns to materialize and control creatures. Each player can materialize one or two creatures every round, which usually suffer from materialization sickness, meaning they won't be able to act in the current round.
</p>
<p>
<!-- show the icons + tooltips?-->
<b>Health:</b> A raw number representing the amount of damage a creature can take until it dies.<br>
<b>Regrowth:</b> Amount of health which gets restored to the creature every round.<br>
<b>Endurance:</b> If a creature takes over a certain amount of damage in a round, it becomes fatigued, unable to act.<br>
<b>Energy:</b> Doing any action, including moving, drains energy from the creature.<br>
<b>Meditation:</b> Creature gains back this amount of energy points every round.<br>
<b>Initiative:</b> Creatures with higher initiative get to act faster each round.<br>
<b>Offense:</b> Influences the damage output of attacks.<br>
<b>Defense:</b> Protects the creature by reducing incoming damage.<br>
<b>Movement:</b> Each creature can move up to a certain number of hexagons each turn.<br>
<b>Masteries</b> can have an impact on the effectiveness of the creature's abilities and can also help reduce incoming damage and even protect the creature from harmfull effects.
</p>

</div>
</div>
</article>
<?php end_page(); ?>

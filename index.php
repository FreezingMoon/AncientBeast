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
	height: 400px;
	text-align: center;
	padding-top: 10px;
	width: 890px;
	font-weight: bold;
}
.container > div {
    display: none
}
.container > div:first-child {
    display: block
}
.container > div:hover + div {
    display: block
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
<?php start_segment(); ?>
<nav><ul class="sections">
<?php
$sections = array(
	'intro',
	'plot',
	'gameplay',
	'realms',
	'tools',
	'contribute',
	'license'
);
foreach ($sections as &$sectionItem) {
	echo '<li style="display:inline;"><a href="#' . $sectionItem . '" style="padding:1.7em;">' . ucfirst($sectionItem) . '</a></li>';
}
?>
</ul></nav>
<?php end_segment(); ?>
<article>
<?php start_segment(); ?>
<div class="center"><iframe width="880" height="495" src="http://www.youtube.com/embed/videoseries?list=PLADfTwuzK0YQG6rKWImoeKlpVZy9dj_XI" frameborder="0" allowfullscreen></iframe></div>
<?php separate_segment("intro"); ?>
<h3 class="indexheader"><a href="#intro">Intro</a></h3>
<p>
<b>Ancient Beast</b> is a turn based strategy indie game project, played online against other people, featuring a wide variety of items and creatures to acquire and put to good use in order to defeat your opponents.
</p>
<p>
Ancient Beast is <a href="http://www.wuala.com/AncientBeast" target="_blank">free</a>, <a href="https://github.com/FreezingMoon/AncientBeast" target="_blank">open source</a> and developed by <a href="http://www.FreezingMoon.org" target="_blank" class="FM"><b>Freezing Moon</b></a> (and community). It uses technologies such as HTML, PHP, and JavaScript, so it is playable from any modern browser without the need of plugins.<br>This project was carefully designed to be easy to learn, fun to play and hard to master. We hope you'll enjoy it!
</p>
<?php separate_segment("plot"); ?>
<h3 class="indexheader"><a href="#plot">Plot</a></h3>
<p class="center">
<audio controls="controls">
	<source src="plot.ogg" type="audio/ogg">
Your browser does not support the audio element.
</audio>
</p>
<p>
It's the year 2653. In the last centuries, technology advanced exponentially and everyone had a fair chance of playing God. With help from the <a href="http://reprap.org/" target="_blank"><b>RepRap</b></a> project, a free desktop 3d printer, which gave anyone power to build their own weapon factory or genetic laboratory on their own property. Mechanic parts or genetic modifications turned from a fashion option into a requirement for survival.
</p>
<p>
Despite their combined efforts, the world's governments couldn't prevent the world from plunging into chaos. The Earth has become a battlefield; split between 7 factions fighting for dominion over the ravaged landscape. The apocalypse is here, and only the strong will survive.
</p>
<?php separate_segment("gameplay"); ?>
<h3 class="indexheader"><a href="#gameplay">Gameplay</a></h3>
<p>
In order to play Ancient Beast, you'll needed to register an account. After logging in, you'll be offered a level 1 creature to get you started. Fights take place between 2 - 4 players, on a variety of combat fields which are about 16x9 hexes. Based on the difficulty of the fight, you can win gold coins, which can be spent in the shop in order to purchase items or unlock more creatures.
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
<p>
Players are represented on the combat field by Dark Priests. All creature stats can be improved by purchasing items.
Players can level up by gaining experience on the combat field, gaining 1 more plasma point each level, being able to materialize more and/or better creatures. In order to materialize a creature you own, it takes a number of plasma points equal to the creature's level plus the number of hexagons it occupies. Any creature owned can be materialized once per combat, provided the player has enough plasma points to do so.<br>
When fighting players of lower levels, you will temporarely lose plasma points in order to balance the fight.
</p>
<p>
After engaging in combat, players are taken to the battle field where both parties take turns to materialize and control creatures. Each player can materialize one or two creatures every round, which usually suffer from materialization sickness, meaning they won't be able to act in the current round.
</p>
<p>
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
<?php separate_segment("realms"); ?>
<h3 class="indexheader"><a href="#realms">Realms</a></h3>
<p style="text-align:center;">The world has been divided into 7 regions, one for each of the deadly sins that suit it's inhabitants the most.</p>
<div style="width:889px; display:table; cursor:pointer;" class="center shadow">
	<div class="container" style="display:table-cell;"><div style="background:url('images/realms/avarice.jpg'); width:127px; height:400px;"></div>
	<div class="realms" style="background:url('images/realms/avarice.jpg') no-repeat; position:absolute; top:81px; left:31px;">
	<span class="bigger" style="text-shadow: black 0.1em 0.1em 0.2em, gold 0 0 10px; color: #e6e6e6;">Avarice</span>
	<p style="background:rgba(0,0,0,0.5); border-radius:15px; border:4px ridge gold; padding: 15px 0px;">They like to aquire all sorts of useless things and riches by all means possible.<br>
	Located in the middle, consists of old city scapes, with wrecked buildings and streets filled with anarchy.</p></div></div>

	<div class="container" style="display:table-cell;"><div style="background:url('images/realms/envy.jpg') -127px 0; width:127px; height:400px;"></div>
	<div class="realms" style="background:url('images/realms/envy.jpg') no-repeat; position:absolute; top:81px; left:31px;">
	<span class="bigger" style="text-shadow: black 0.1em 0.1em 0.2em, orange 0 0 10px; color: #e6e6e6;">Envy</span>
	<p style="background:rgba(0,0,0,0.5); border-radius:15px; border:4px ridge orange; padding: 15px 0px;">The creatures living in this realm always feel rather insecure about themselves and they hate it when others have more or are better in some ways.<br>It's located to the West side and it mainly consists of deserts and cannyons.</p></div></div>

	<div class="container" style="display:table-cell;"><div style="background:url('images/realms/gluttony.jpg') -254px 0; width:127px; height:400px;"></div>
	<div class="realms" style="background:url('images/realms/gluttony.jpg') no-repeat; position:absolute; top:81px; left:31px;">
	<span class="bigger" style="text-shadow: black 0.1em 0.1em 0.2em, green 0 0 10px; color: #e6e6e6;">Gluttony</span>
	<p style="background:rgba(0,0,0,0.5); border-radius:15px; border:4px ridge green; padding: 15px 0px;">Overcrowded place where all sorts of beasts and plants eat each other as soon as they get a chance.<br>In the east side, where the jungles are really tall and wilde, not even the sun's waves go through. Beware of the vegetation as well and don't pet any animals!</p></div></div>

	<div class="container" style="display:table-cell;"><div style="background:url('images/realms/lust.jpg') -381px 0; width:127px; height:400px;"></div>
	<div class="realms" style="background:url('images/realms/lust.jpg') no-repeat; position:absolute; top:81px; left:31px;">
	<span class="bigger" style="text-shadow: black 0.1em 0.1em 0.2em, red 0 0 10px; color: #e6e6e6;">Lust</span>
	<p style="background:rgba(0,0,0,0.5); border-radius:15px; border:4px ridge red; padding: 15px 0px;">The creatures around here have a burning lust for destruction, incinerating everything within reach.<br>North side. Volcanoes spread all across this land, which is usually covered by ashes or solid magma, while rivers of hot magma run by, so beware your step and keep in mind that the air rather toxic.</p></div></div>

	<div class="container" style="display:table-cell;"><div style="background:url('images/realms/pride.jpg') -508px 0; width:127px; height:400px;"></div>
	<div class="realms" style="background:url('images/realms/pride.jpg') no-repeat; position:absolute; top:81px; left:31px;">
	<span class="bigger" style="text-shadow: black 0.1em 0.1em 0.2em, violet 0 0 10px; color: #e6e6e6;">Pride</span>
	<p style="background:rgba(0,0,0,0.5); border-radius:15px; border:4px ridge violet; padding: 15px 0px;">They're above everyone else. Literally at least.<br>Hundreds of years ago, some of the population, mainly the rich, tried separating themselves from the rest, so they built floating fortresses.</p></div></div>

	<div class="container" style="display:table-cell;"><div style="background:url('images/realms/sloth.jpg') -635px 0; width:127px; height:400px;"></div>
	<div class="realms" style="background:url('images/realms/sloth.jpg') no-repeat; position:absolute; top:81px; left:31px;">
	<span class="bigger" style="text-shadow: black 0.1em 0.1em 0.2em, blue 0 0 10px; color: #e6e6e6;">Sloth</span>
	<p style="background:rgba(0,0,0,0.5); border-radius:15px; border:4px ridge blue; padding: 15px 0px;">They don't bother to do much except survive.<br>This Southern area is mainly water. The low temperature causes most of the water to freeze, providing a home for many of the creatures.</p></div></div>

	<div class="container" style="display:table-cell;"><div style="background:url('images/realms/wrath.jpg') -762px 0; width:127px; height:400px;"></div>
	<div class="realms" style="background:url('images/realms/wrath.jpg') no-repeat; position:absolute; top:81px; left:31px; width:889px;">
	<span class="bigger" style="text-shadow: black 0.1em 0.1em 0.2em, indigo 0 0 10px; color: #e6e6e6;">Wrath</span>	
	<p style="background:rgba(0,0,0,0.5); border-radius:15px; border:4px ridge indigo; padding: 15px 0px;">The beasts from this realm enjoy killing and inflicting suffering on others.<br>Underworld. Back in the day there used to be secret underground facilities that were used for God forbidden experiments regarding genetics and bio weapons.</p></div></div>
</div>
<br>
<?php separate_segment("tools"); ?>
<h3 class="indexheader"><a href="#tools">Tools</a></h3>
<p>The project is developed with the use of free open source cross platform applications and freeware services.
<a href="http://www.wuala.com/referral/CGN5J6GH3PBBBHCGKJ3P" target="_blank"><b>Wuala</b></a> comes in very handy when working with files collaboratively. You can find our group over <a href="http://wuala.com/AncientBeast" target="_blank"><b>here</b></a> which contains all the project's assets and sources, while <a href="https://github.com/FreezingMoon/AncientBeast" target="_blank"><b>Github</b></a> handles the code part and stores the final assets. Art contributions can be made as well in our <a href="http://Ancient-Beast.deviantart.com" target="_blank"><b>deviantArt</b></a> group. There is no centralized forum, but you can use the various <a href="http://disqus.com" target="_blank"><b>Disqus</b></a> widgets around the website, our <a href="https://github.com/FreezingMoon/AncientBeast/issues" target="_blank"><b>Github issue tracker</b></a> or our <a href="http://forum.freegamedev.net/viewforum.php?f=70" target="_blank"><b>FreeGameDev subforum</b></a>.<br>
<a href="http://blender.org" target="_blank"><b>Blender</b></a> is being used for creating most of the assets, such as combat locations, creatures and their animations, which are rendered into sprites that are usually made into sprite-sheets as well as for other tasks.<br>
<a href="http://krita.org" target="_blank"><b>Krita</b></a>, <a href="http://gimp.org" target="_blank"><b>Gimp</b></a> and <a href="http://mypaint.intilinux.com" target="_blank"><b>MyPaint</b></a> are useful for concept art, while <a href="http://inkscape.org" target="_blank"><b>Inkscape</b></a> is useful for creating vector ability icons.</p>
<table style="font-size:18px; font-weight:bold; margin:0; padding:0; margin-left:auto; margin-right:auto; text-align:center;"><tr>
<?php
$tools = array(
	'github'     => 'https://github.com/FreezingMoon/AncientBeast',
	'wuala'      => 'http://www.wuala.com/AncientBeast',
	'deviantart' => 'http://Ancient-Beast.deviantart.com',
	'blender'    => 'http://blender.org',
	'krita'      => 'http://krita.org',
	'gimp'       => 'http://gimp.org',
	'mypaint'    => 'http://mypaint.intilinux.com',
	'inkscape'   => 'http://inkscape.org'
);
foreach ($tools as $toolName => $toolLink) {
	echo '<td><a href="' . $toolLink . '" target="_blank" class="lighten"><img src="images/icons/' . $toolName . '.png" style="display:block; width:99px; height99px;" alt="' . $toolName . '">' . ucfirst($toolName) . '</a></td>';
}
?>
</tr></table>
<?php separate_segment("contribute"); ?>
<h3 class="indexheader"><a href="#contribute">Contribute</a></h3>
<p>
For putting creature sprites together into sprite sheets, you can use the <a href="http://wiki.blender.org/index.php/Extensions:2.6/Py/Scripts/Render/Spritify" target="_blank"><b>Spritify</b></a> blender addon.<br>
The game requires animations to be 30 frames per second. Sprite sheets must have transparent background and an offset of 3 pixels between frames. Creatures are rendered at a resolution based upon their size (number of hexagons occupied), with an 1:1 aspect ratio. By default, rendered creatures should usually be facing right.
</p>
<?php separate_segment("license"); ?>
<h3 class="indexheader"><a href="#license">License</a></h3>
<br>
<table border="1">
	<tr>
		<td><a href="http://www.FreezingMoon.org" target="_blank"><img src="images/FreezingMoon.png" alt="Freezing Moon"></a></td>
		<td>Ancient Beast name and logo are trademarks of Freezing Moon.<br>Respect the developers and their work!</td>
	</tr>
	<tr>
		<td><a href="http://creativecommons.org/licenses/by-sa/3.0/" target="_blank"><img src="images/cc-by-sa.png" alt="CC-BY-SA 3.0"></a></td>
		<td><a href="http://creativecommons.org/licenses/by-sa/3.0/" target="_blank">CC-BY-SA 3.0</a>: Artwork and audio can be remixed and shared under the same license, provided you credit and link the project, as well as the author(s) of the respective works.</td>
	</tr>
	<tr>
		<td><a href="http://www.gnu.org/licenses/agpl-3.0.html" target="_blank"><img src="images/agpl.png" alt="AGPL 3.0"></a></td>
		<td><a href="http://www.gnu.org/licenses/agpl-3.0.html" target="_blank">AGPL 3.0</a>: The codebase or parts of it can be remixed and shared under the same license, provided you credit and link the project.</td>
	</tr>
</table>
<?php end_segment(); ?>
</article>
<?php end_page(); ?>

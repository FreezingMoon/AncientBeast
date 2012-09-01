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
.iconz {
	width: 110px;
	height: 110px;
}
.bigger {
	font-size: 28px;
}
.realms {
	height: 400px;
	text-align: center;
	padding-top: 10px;
}
.contrast {
	background: rgba(0,0,0,0.5);
	padding: 15px 0px;
}';
require_once('header.php'); 
?>
<script type="application/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.4/jquery.min.js"></script>
<script type="application/javascript" src="gallery/fancybox/jquery.fancybox-1.3.4.pack.js"></script>
<script type="application/javascript" src="gallery/fancybox/jquery.easing-1.3.pack.js"></script>
<script type="application/javascript" src="gallery/fancybox/jquery.mousewheel-3.0.4.pack.js"></script>
<link rel="stylesheet" href="gallery/fancybox/jquery.fancybox-1.3.4.css" type="text/css" media="screen" />
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
<center><iframe width="880" height="495" src="http://www.youtube.com/embed/videoseries?list=PLC179DAED0274E304&amp;hl=ro_RO" frameborder="0" allowfullscreen></iframe></center>
<?php separate_segment(); ?>
<!-- TODO: use class, inline css is just wrong -->
<nav><table width=100% style="font-size:18px; font-weight:bold; margin:0; padding:0; margin-left:auto; margin-right:auto; text-align:center;"><tr>
<?php
$sections = array(
  'info',
  'plot', 
  'gameplay', 
  'realms', 
  'requirements', 
  'development', 
  'license'
);
foreach ($sections as &$sectionItem) {
	echo '<td><center><a href="#' . $sectionItem . '" class="lighten"><img src="images/icons/' . $sectionItem . '.png" width="120" height="120" style="display:block;">' . ucfirst($sectionItem) . '</a></center></td>';
}
?>
</tr></table></nav>
<?php end_segment(); ?>
<article>
<?php start_segment(); ?>
<h3 class="indexheader" id="info"><a href="#info">Info</a></h3>
<p>
<b>Ancient Beast</b> is a turn based strategy game played online against other people, featuring a wide variety of items and creatures to aquire and put to good use in order to defeat your opponents.
</p>
<p>
Ancient Beast is <a href="http://www.wuala.com/AncientBeast" target="_blank">free</a>, <a href="https://github.com/FreezingMoon/AncientBeast" target="_blank">open source</a> and developed by <a href="http://www.FreezingMoon.org" target="_blank"><b>Freezing Moon</b></a> (and community). It uses technologies such as HTML, PHP, and JavaScript, so it is playable from any modern browser without the need of plugins.<br>This project was carefuly designed to be easy to learn, fun to play and hard to master. We hope you'll enjoy it!
</p>
<?php separate_segment(); ?>
<h3 class="indexheader" id="plot"><a href="#plot">Plot</a></h3>
<p>
It's the year 2653. In the last centuries, technology advanced exponentially and everyone had a fair chance of playing God. With help from the <a href="http://reprap.org/" target="_blank"><b>RepRap</b></a> project, a free desktop 3d printer, which gave anyone power to build their own weapon factory or genetic laboratory on their own property. Mechanic parts or genetic modifications turned from a fashion option into a requirement for survival.
</p>
<p>
Despite their combined efforts, the world's governments couldn't prevent the world from plunging into chaos. The Earth has become a battlefield; split between 7 factions fighting for dominion over the ravaged landscape. The apocalypse is here, and only the strong will survive.
</p>
<br>
<center><p>
<audio controls="controls">
	<source src="plot.ogg" type="audio/ogg">
Your browser does not support the audio element.
</audio>
</p></center>
<?php separate_segment(); ?>
<h3 class="indexheader" id="gameplay"><a href="#gameplay">Gameplay</a></h3>
<p>
In order to play Ancient Beast, you'll needed to register an account. After logging in, you'll be offered a level 1 creature to get you started. Fights take place between 2 - 4 players, on a variety of combat fields which are 18x12 hexes. Based on the difficulty of the fight, you can win gold coins, which can be spent in the shop in order to purchase items or unlock more creatures.
</p>
<?php
echo '<center>';
$images = scandir('images/combat');
natsort($images);
$i = 0;
foreach($images as $image) {
	if($image == '.' || $image == '..') continue;
	$title = substr($image, 0, -4); 
	echo '<a id="img' . $i . '" style="text-align:center;" rel="pop" href="images/combat/' . $image . '" title="' . $title . '"><img style="width:280px; margin:5px;" src="images/combat/' . $image .'" title="' . $title . '"></a>';
	$i++;
} echo '</center>';?>
<p>
Players are represented on the combat field by Dark Priests. All creature stats can be improved by purchasing items.
Players can level up by gaining experience on the combat field, gaining 1 more plasma point each level, being able to materialize more and/or better creatures. In order to materialize a creature you own, it takes a number of plasma points equal to the creature's level plus the number of hexagons it occupies. Any creature owned can be materialized once per combat, provided the player has enough plasma points to do so.<br>
When fighting players of lower levels, you will temporarely lose plasma points in order to balance the fight.
</p>
<p>
After engaging in combat, players are taken to the battle field where both parties take turns to materialize and control creatures. Each player needs to have at least one creature on the battlefield at all times, otherwise he loses the fight. Each player can materialize a creature every round, which usually suffer from materialization sickness, meaning they won't be able to act in the current round.
</p>
<p>
After the first materialized creature, each aditional realm requires a plasma point just for being unlocked.
</p>
<p>
<b>Health:</b> A raw number representing the amount of damage a creature can take until it dies.<br>
<b>Regrowth:</b> Amount of health which gets restored to the creature every round.<br>
<b>Fatigue:</b> While a creature is below this amount of health, it becomes fatigued and unable to act.<br>
<b>Energy:</b> Doing any action, including moving, drains energy from the creature.<br>
<b>Meditation:</b> Creature gains back this amount of energy points every round.<br>
<b>Delay:</b> Creatures with smaller delay get to act first in a round.<br>
<b>Offense:</b> Influences the damage output of attacks.<br>
<b>Defense:</b> Protects the creature by reducing incoming damage.<br>
<b>Movement:</b> Each creature can move up to a certain number of hexagons each turn.<br>
<b>Masteries</b> can have an impact on the effectiveness of the creature's abilities and can also help reduce incoming damage and even protect the creature from harmfull effects.
</p>
<?php separate_segment(); ?>
<h3 class="indexheader" id="realms"><a href="#realms">Realms</a></h3>
<p style="text-align:center;">The world has been divided into 7 regions, one for each of the deadly sins that suit it's inhabitants the most.</p>
<div style="text-align:center; width:506px; margin-left:auto; margin-right:auto;">
<img id="_sins" src="<?php echo $site_root; ?>images/realms/index.png" usemap="#sins" width="506" height="527">
<map id="sins" name="sins">
<area shape="poly" coords="203,176,301,175,351,260,302,348,199,349,151,261" href="#Avarice" title="Avarice">
<area shape="poly" coords="354,88,453,86,505,175,454,261,355,258,304,173" href="#Envy" title="Envy">
<area shape="poly" coords="51,265,149,262,203,350,149,436,50,436,0,349" href="#Gluttony" title="Gluttony">
<area shape="poly" coords="353,261,454,262,505,350,453,435,352,440,304,349" href="#Lust" title="Lust">
<area shape="poly" coords="201,2,302,2,352,87,302,173,203,171,153,88" href="#Pride" title="Pride">
<area shape="poly" coords="50,89,152,90,202,174,150,258,51,262,0,175" href="#Sloth" title="Sloth">
<area shape="poly" coords="201,350,301,350,355,437,301,524,203,524,152,436" href="#Wrath" title="Wrath">
</map></div>
<br>
<div style="width:890px; font-weight:bold;">
<div class="realms" style="background:url('images/realms/avarice.jpg') no-repeat;"><a id="Avarice" class="bigger">Avarice</a><p class="contrast">They like to aquire all sorts of useless things and riches by all means possible.<br>Located in the middle, consists of old city scapes, with wrecked buildings and streets filled with anarchy.</p></div>
<div class="realms" style="background:url('images/realms/envy.jpg') no-repeat;"><a id="Envy" class="bigger">Envy</a><p class="contrast">The creatures living in this realm always feel rather insecure about themselves and they hate it when others have more or are better in some ways.<br>It's located to the West side and it mainly consists of deserts and cannyons.</p></div>
<div class="realms" style="background:url('images/realms/gluttony.jpg') no-repeat;"><a id="Gluttony" class="bigger">Gluttony</a><p class="contrast">Overcrowded place where all sorts of beasts and plants eat each other as soon as they get a chance.<br>In the east side, where the jungles are really tall and wilde, not even the sun's waves go through. Beware of the vegetation as well and don't pet any animals!</p></div>
<div class="realms" style="background:url('images/realms/lust.jpg') no-repeat;"><a id="Lust" class="bigger">Lust</a><p class="contrast">The creatures around here have a burning lust for destruction, incinerating everything within reach.<br>North side. Volcanoes spread all across this land, which is usually covered by ashes or solid magma, while rivers of hot magma run by, so beware your step and keep in mind that the air rather toxic.</p></div>
<div class="realms" style="background:url('images/realms/pride.jpg') no-repeat;"><a id="Pride" class="bigger">Pride</a><p class="contrast">They're above everyone else. Literally at least.<br>Hundreds of years ago, some of the population, mainly the rich, tried separating themselves from the rest, so they built floating fortresses.</p></div>
<div class="realms" style="background:url('images/realms/sloth.jpg') no-repeat;"><a id="Sloth" class="bigger">Sloth</a><p class="contrast">They don't bother to do much except survive.<br>This Southern area is mainly water. The low temperature causes most of the water to freeze, providing a home for many of the creatures.</p></div>
<div class="realms" style="background:url('images/realms/wrath.jpg') no-repeat;"><a id="Wrath" class="bigger">Wrath</a><p class="contrast">The beasts from this realm enjoy killing and inflicting suffering on others.<br>Underworld. Back in the day there used to be secret underground facilities that were used for God forbidden experiments regarding genetics and bio weapons.</p></div>
</div>
<?php separate_segment(); ?>
<h3 class="indexheader" id="requirements"><a href="#requirements">Requirements</a></h3>

<ul>
<li>internet connection</li>
<li>a <a href="http://www.google.com/chrome" target="_blank">modern browser</a> with HTML 5 support and JavaScript enabled</li>
<li>500 MHz Processor</li>
<li>256 MB RAM</li>
<li>200 MB HDD</li>
<li>64 MB Video Card</li>
<li>controller (keyboard, mouse, gamepad, touch screen, smartphone or tablet)</li>
</ul>
<p>Best played at Full HD resolution (1920x1080), with stereo speakers, using <a href="http://www.google.com/chrome" target="_blank">Google Chrome</a>.<br>
While playing on a smartphone, it is highly recommended using a stylus.</p>
<?php separate_segment(); ?>
<h3 class="indexheader" id="development"><a href="#development">Development</a></h3>
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
	echo '<td><a href="' . $toolLink . '" target="_blank" class="lighten"><img src="images/icons/' . $toolName . '.png" style="display:block; width:99px; height99px;">' . ucfirst($toolName) . '</a></td>';
}
?>
</tr></table>
<br>
<p>
For putting creature sprites together into sprite sheets, you can use the <a href="http://wiki.blender.org/index.php/Extensions:2.6/Py/Scripts/Render/Spritify" target="_blank"><b>Spritify</b></a> blender addon.<br>
The game requires animations to be 30 frames per second. Sprite sheets must have transparent background and an offset of 3 pixels between frames. Creatures are rendered at a resolution based upon their size (number of hexagons occupied), with an 1:1 aspect ratio. By default, rendered creatures should usually be facing right.
</p>
<?php separate_segment(); ?>
<h3 class="indexheader" id="license"><a href="#license">License</a></h3>
<table border="1"><tr>
<td><a href="http://www.FreezingMoon.org" target="_blank"><img src="images/FreezingMoon.png"></a></td><td>Ancient Beast name and logo are trademarks of Freezing Moon.<br>Respect the developers and their work!</td>
</tr><tr>
<td><a href="http://creativecommons.org/licenses/by-sa/3.0/" target="_blank"><img src="images/cc-by-sa.png"></a></td><td>Artwork and audio can be remixed and shared under the same license, provided you credit the project, foundation and/or author provided.</td>
</tr><tr>
<td><a href="http://www.gnu.org/licenses/agpl-3.0.html" target="_blank"><img src="images/agpl.png"></a></td><td>The codebase or parts of it can be remixed and shared under the same license, provided you credit the project and/or foundation.</td>
</tr></table>
<?php end_segment(); ?>
</article>
<?php end_page(); ?>

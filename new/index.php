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

require_once('header.php'); ?>
<script src="new/media/fancybox/jquery.fancybox-1.3.4.pack.js"></script>
<script src="new/media/fancybox/jquery.easing-1.3.pack.js"></script>
<script src="new/media/fancybox/jquery.mousewheel-3.0.4.pack.js"></script>
<link rel="stylesheet" href="new/media/fancybox/jquery.fancybox-1.3.4.css" type="text/css" media="screen">
<script>
	$("body").attr("id","home");
	$(document).attr('title', 'AncientBeast - Online PvP TBS Game');
	//TODO: review the need of the code below
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

<!--replace video with image that opens lightbox player on click, also include images (screenshots) on homepage along with features
WATCH TRAILER // + screenies
<div class="center"><iframe width="880" height="495" src="//www.youtube.com/embed/cAgf9hKGI3k?list=PLADfTwuzK0YQG6rKWImoeKlpVZy9dj_XI" frameborder="0" allowfullscreen></iframe></div>
-->

<main style="width:60%;" class="section">

<screenies class="center">
<?php
$images = scandir('media/screenshots');
natsort($images);
$i = 0;
foreach($images as $image) {
	if($image == '.' || $image == '..') continue;
	$title = substr($image, 0, -4);
	$image = str_replace(' ', '%20', $image);
	echo '<a id="img' . $i . '" rel="pop" href="media/screenshots/' . $image . '" title="' . $title . '"><img class="shadow" style="width:280px; margin:5px;" src="media/screenshots/' . $image . '" title="' . $title . '" alt="' . $image . '"></a>';
	$i++;
}?>
</screenies>

<p>
<b>Ancient Beast</b> is a turn based strategy indie game project, played online against other people, featuring a wide variety of creatures to aquire and items to equip onto, putting them to use in order to defeat your opponents.
</p>

<p>
Ancient Beast is <a href="http://www.wuala.com/AncientBeast" target="_blank">free</a>, <a href="https://github.com/FreezingMoon/AncientBeast" target="_blank">open source</a> and developed by <a href="http://www.FreezingMoon.org" target="_blank" class="FM"><b>Freezing Moon</b></a> (and community). It uses web languages such as HTML, PHP and JavaScript, so that it's playable from any modern browser without the need of plugins.<br>This project was carefully designed to be easy to learn, fun to play and hard to master. We hope you'll enjoy it!
</p>

<links>
<ul>
	<li><a href="https://github.com/FreezingMoon/AncientBeast" target="_blank">Github</a></li>
	<li><a href="https://wuala.com/AncientBeast" target="_blank">Wuala</a></li>
	<li><a href="https://ancient-beast.deviantart.com" target="_blank">deviantArt</a></li>
	<li><a href="https://www.facebook.com/AncientBeast" target="_blank">Facebook</a></li>
	<li><a href="https://twitter.com/AncientBeast" target="_blank">Twitter</a></li>
	<li><a href="https://plus.google.com/b/113034814032002995836" target="_blank">Google</a></li>
	<li><a href="https://www.youtube.com/user/AncientBeastGame" target="_blank">YouTube</a></li>
</ul>
</links>

<p>
Fights take place between 2 - 4 players, on a variety of visual combat fields, the grid being 16x9 hexagons. Plasma is a vital resource during combat, keeping players away from harm while also allowing them to materialize units in order to defend themselves or vanquish foes. Winner of the match is usually the last player standing, but when time limits are involved, the played with highest score can win. Killing creatures results in score points, also each unit drops a specific power-up that can aid more or less when picked up.
</p>
<p>
Players are represented on the combat field by Dark Priests. All creature stats can be improved by purchasing items.
Players can level up by gaining experience on the combat field, gaining 1 more plasma point each level, being able to materialize more and/or better creatures. In order to materialize a creature you own, it takes a number of plasma points equal to the creature's level plus the number of hexagons it occupies. Any creature owned can be materialized just once per combat, provided the player has enough plasma points to do so.<br>
When fighting players of lower levels, you will temporarely lose plasma points in order to balance the fight.
</p>
</main>

<right class="section" style="width:30%;">
<img src="images/ABlogo.png" width=400px>
</right>

</body></html>

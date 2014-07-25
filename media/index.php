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

$page_title = "Ancient Beast - Media";

$style = '
.bigger { font-size: 28px; color: #e6e6e6; }
.artwork { height: 200px; margin: 5px; }
.screenies { width: 285px; margin: 5px; }
.wallpapers { width: 435px; margin: 5px; }
';
require_once("../header.php"); ?>
<link rel="stylesheet" href="fancybox/jquery.fancybox-1.3.4.css" media="screen">
<script data-cfasync="false" type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.4/jquery.min.js"></script>

<nav class="div center"><ul class="sections">
<?php
$sections = array(
	'artwork',
	'fanart',
	'realms',
	'screenshots',
	'wallpapers',
	'videos',
	'music'
);
foreach ($sections as &$sectionItem) {
	echo '<li style="display:inline;"><a href="?type=' . $sectionItem . '" style="padding:1.7em;">' . ucfirst($sectionItem) . '</a></li>';
}
?>
</ul></nav>
<div class="div center">
<?php
@$type = $_GET['type'];
if (!isset($type)) $type = 'artwork';
switch($type) {
case 'artwork':
 ?>
	<?php
	$images = scandir("artwork");
	natsort($images);
	$i = 0;
	foreach($images as $image) {
		if($image == "." || $image == "..") continue;
		$title = substr($image, 0, -4);
		echo '<a id="img' . $i . '" rel="pop" href="artwork/' . $image . '" title="' . $title . '"><img class="shadow artwork" src="artwork/' . $image . '" title="' . $title . '" alt="' . $image . '"></a>';
		$i++;
	}
	break;

case 'fanart':
	echo 'Post your fan art in the <a href="#comments"><b>comments</b></a> section or upload it to the <a href="http://Ancient-Beast.deviantArt.com" target="_blank"><b>deviantArt</b></a> group. The best works will be featured!</div>';
	?>
	<div class="div center">
	<?php $images = scandir("fanart");
	natsort($images);
	$i = 0;
	foreach($images as $image) {
		if($image == "." || $image == "..") continue;
		$title = substr($image, 0, -4);
		echo '<a id="img' . $i . '" rel="pop" href="fanart/' . $image . '" title="' . $title . '"><img class="shadow artwork" src="fanart/' . $image . '" title="' . $title . '" alt="' . $image . '"></a>';
		$i++;
	}
	break;

case 'realms':
?>
<p style="text-align:center;">The world has been divided into 7 regions, one for each of the deadly sins that suit its inhabitants the most.</p></div></div>
	<a href="#avarice"><div id="avarice" class="center" style="border-radius: 15px 15px 0 0 ; background:rgba(30,30,30,0.8); border:4px ridge gold; padding: 15px 0px">
	<span class="bigger" style="text-shadow: black 0.1em 0.1em 0.2em, gold 0 0 10px;">Avarice</span></div>
	<img  src='realms/avarice.jpg' width=950px>
	<div class="center" style="background:rgba(30,30,30,0.8); border-radius: 0 0 15px 15px; border:4px ridge gold; padding: 15px 0px;">
	They like to aquire all sorts of useless things and riches by all means possible.<br>
	Located in the middle, consists of old city scapes, with wrecked buildings and streets filled with anarchy.</div></a><br>
	<a href="#envy"><div id="envy" class="center" style="border-radius: 15px 15px 0 0 ; background:rgba(30,30,30,0.8); border:4px ridge orange; padding: 15px 0px">
	<span class="bigger" style="text-shadow: black 0.1em 0.1em 0.2em, orange 0 0 10px;">Envy</span></div>
	<img  src='realms/envy.jpg' width=950px'>
	<div class="center" style="background:rgba(30,30,30,0.8); border-radius: 0 0 15px 15px; border:4px ridge orange; padding: 15px 0px;">
	The creatures living in this realm always feel rather insecure about themselves and they hate it when others have more or are better in some ways.<br>
	It's located to the West side and it mainly consists of deserts and cannyons.</div></a><br>
	<a href="#gluttony"><div id="gluttony" class="center" style="border-radius: 15px 15px 0 0 ; background:rgba(30,30,30,0.8); border:4px ridge green; padding: 15px 0px">
	<span class="bigger" style="text-shadow: black 0.1em 0.1em 0.2em, green 0 0 10px;">Gluttony</span></div>
	<img  src='realms/gluttony.jpg' width=950px'>
	<div class="center" style="background:rgba(30,30,30,0.8); border-radius: 0 0 15px 15px; border:4px ridge green; padding: 15px 0px;">
	Overcrowded place where all sorts of beasts and plants eat each other as soon as they get a chance.<br>
	In the east side, where the jungles are really tall and wilde, not even the sun's waves go through.<br>
	Beware of the vegetation as well and don't pet any animals!</div></a><br>
	<a href="#lust"><div id="lust" class="center" style="border-radius: 15px 15px 0 0 ; background:rgba(30,30,30,0.8); border:4px ridge red; padding: 15px 0px">
	<span class="bigger" style="text-shadow: black 0.1em 0.1em 0.2em, red 0 0 10px;">Lust</span></div>
	<img  src='realms/lust.jpg' width=950px'>
	<div class="center" style="background:rgba(30,30,30,0.8); border-radius: 0 0 15px 15px; border:4px ridge red; padding: 15px 0px;">
	The creatures around here have a burning lust for destruction, incinerating everything within reach.<br>
	North side. Volcanoes spread all across this land, which is usually covered by ashes,<br>
	while rivers of hot magma run by, so beware your step and keep in mind that the air rather toxic.</div></a><br>
	<a href="#pride"><div id="pride" class="center" style="border-radius: 15px 15px 0 0 ; background:rgba(30,30,30,0.8); border:4px ridge violet; padding: 15px 0px">
	<span class="bigger" style="text-shadow: black 0.1em 0.1em 0.2em, violet 0 0 10px;">Pride</span></div>
	<img  src='realms/pride.jpg'  width=950px'>
	<div class="center" style="background:rgba(30,30,30,0.8); border-radius: 0 0 15px 15px; border:4px ridge violet; padding: 15px 0px;">
	They're above everyone else. Literally at least.<br>
	Hundreds of years ago, some of the population, mainly the rich,<br>
	tried separating themselves from the rest, so they built floating fortresses.</div></a><br>
	<a href="#sloth"><div id="sloth" class="center" style="border-radius: 15px 15px 0 0 ; background:rgba(30,30,30,0.8); border:4px ridge blue; padding: 15px 0px">
	<span class="bigger" style="text-shadow: black 0.1em 0.1em 0.2em, blue 0 0 10px;">Sloth</span></div>
	<img  src='realms/sloth.jpg' width=950px'>
	<div class="center" style="background:rgba(30,30,30,0.8); border-radius: 0 0 15px 15px; border:4px ridge blue; padding: 15px 0px;">
	They don't bother to do much except survive.<br>
	This Southern area is mainly water. The low temperature causes most of the water to freeze,<br>
	providing a home for many of the creatures.</div></a><br>
	<a href="#wrath"><div id="wrath" class="center" style="border-radius: 15px 15px 0 0 ; background:rgba(30,30,30,0.8); border:4px ridge indigo; padding: 15px 0px">
	<span class="bigger" style="text-shadow: black 0.1em 0.1em 0.2em, indigo 0 0 10px;">Wrath</span></div>
	<img  src='realms/wrath.jpg' width=950px'>
	<div class="center" style="background:rgba(30,30,30,0.8); border-radius: 0 0 15px 15px; border:4px ridge indigo; padding: 15px 0px;">
	The beasts from this realm enjoy killing and inflicting suffering on others.<br>
	Underworld. Back in the day there used to be secret underground facilities that were used for<br>
	God forbidden experiments regarding genetics and bio weapons.</div></a><br>
	<div class="div center">Which are the deadly sins you think would describe you the best? Feel free to share your burden with us, sinner.</div>
<?php
	break;
case 'screenshots':
	$images = scandir("screenshots");
	natsort($images);
	$i = 0;
	foreach($images as $image) {
		if($image == "." || $image == "..") continue;
		$title = substr($image, 0, -4);
		echo '<a id="img' . $i . '" rel="pop" href="screenshots/' . $image . '" title="' . $title . '"><img class="shadow screenies" src="screenshots/' . $image . '" title="' . $title . '" alt="' . $image . '"></a>';
		$i++;
	}
	break;

case 'wallpapers':
	$images = scandir("../media/wallpapers");
	natsort($images);
	$i = 0;
	foreach($images as $image) {
		if($image == "." || $image == "..") continue;
		$title = substr($image, 0, -4);
		echo '<a id="img' . $i . '" rel="pop" href="wallpapers/' . $image . '" title="' . $title . '"><img class="shadow wallpapers" src="wallpapers/' . $image . '" title="' . $title . '" alt="' . $image . '"></a>';
		$i++;
	}
	break;

case 'videos':
	?>
	<iframe width="880" height="495" src="http://www.youtube.com/embed/videoseries?list=PLC179DAED0274E304" frameborder="0" allowfullscreen></iframe></div>
	<div class="div center" id="gameplay">
	<iframe width="880" height="495" src="http://www.youtube.com/embed/videoseries?list=PLADfTwuzK0YQG6rKWImoeKlpVZy9dj_XI" frameborder="0" allowfullscreen></iframe></div>
	<div class="div center" id="clips">
	<iframe width="880" height="495" src="//www.youtube.com/embed/videoseries?list=PLADfTwuzK0YR-qoT0Dy6o3AGAoNCq1Y3R" frameborder="0" allowfullscreen></iframe></div>
	<?php break;

case 'music':
	?><img src="band.jpg"><?php
	$folders = array('..', '.');
	$media = array_values(array_diff(scandir("music"), $folders));
	natsort($media);
	$i = 0;
	$error = 'Your browser does not support the audio element.';

	echo '<audio id="audio" preload="auto" controls="" style="width:890px;"><source src="' . $site_url . 'media/music/' . $media[0] . '"> '. $error
		.'</audio><a style="cursor: pointer;" id="mp_shuffle">Shuffle</a><ul id="playlist" style="list-style-type:none; padding-left:0px;">';

	foreach($media as $file){
		$title = substr($file, 0, -4);
		$file = str_replace(' ', '%20', $file);
		if($title!="") echo '<li class=""><a href="' . $site_url . 'media/music/' . $file . '">' . $title . '</a></li>';
		$i++;
	} ?>
	</ul>
	</div><div class="div center">Click on a track to start playing it. Let us know which are your favorite ones by leaving a comment bellow.</div>
	<script type="text/javascript" src="js/musicplayer.js"></script>
<?php
}
echo "</div></div>";
disqus();
include('../footer.php'); ?>
<script type="text/javascript" src="fancybox/jquery.fancybox-1.3.4.pack.js"></script>
<script defer type="text/javascript" src="fancybox/jquery.easing-1.3.pack.js"></script>
<script defer type="text/javascript" src="fancybox/jquery.mousewheel-3.0.4.pack.js"></script>

<script type="text/javascript">
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

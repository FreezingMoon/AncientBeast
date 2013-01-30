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
require_once("../header.php"); ?>
<script type="application/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.4/jquery.min.js"></script>
<script type="application/javascript" src="fancybox/jquery.fancybox-1.3.4.pack.js"></script>
<script type="application/javascript" src="fancybox/jquery.easing-1.3.pack.js"></script>
<script type="application/javascript" src="fancybox/jquery.mousewheel-3.0.4.pack.js"></script>
<link rel="stylesheet" href="fancybox/jquery.fancybox-1.3.4.css" type="text/css" media="screen">
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
	'artwork',
	'screenshots',
	'wallpapers',
	'fanart',
	'videos',
	'music'
);
foreach ($sections as &$sectionItem) {
	echo '<li style="display:inline;"><a href="?type=' . $sectionItem . '" style="padding:1.7em;">' . ucfirst($sectionItem) . '</a></li>';
}
?>
</ul></nav>
<?php separate_segment();
$type = $_GET['type'];
if (!isset($type)) $type = 'artwork';
switch($type)
{
case artwork:
	echo '<div class="center">';
	$images = scandir("../media/artwork");
	natsort($images);
	$i = 0;
	foreach($images as $image) {
		if($image == "." || $image == "..") continue;
		$title = substr($image, 0, -4);
		echo '<a id="img' . $i . '" rel="pop" href="artwork/' . $image . '" title="' . $title . '"><img class="shadow" style="height:200px; margin:5px;" src="artwork/' . $image . '" title="' . $title . '" alt="' . $image . '"></a>';
		$i++;
	} echo "</div>";
	break;

case screenshots:
	echo '<div class="center">';
	$images = scandir("../media/screenshots");
	natsort($images);
	$i = 0;
	foreach($images as $image) {
		if($image == "." || $image == "..") continue;
		$title = substr($image, 0, -4);
		echo '<a id="img' . $i . '" rel="pop" href="screenshots/' . $image . '" title="' . $title . '"><img class="shadow" style="height:200px; margin:5px;" src="screenshots/' . $image . '" title="' . $title . '" alt="' . $image . '"></a>';
		$i++;
	} echo "</div>";
	break;

case wallpapers:
	echo '<div class="center">';
	$images = scandir("../media/wallpapers");
	natsort($images);
	$i = 0;
	foreach($images as $image) {
		if($image == "." || $image == "..") continue;
		$title = substr($image, 0, -4);
		echo '<a id="img' . $i . '" rel="pop" href="wallpapers/' . $image . '" title="' . $title . '"><img class="shadow" style="height:200px; margin:5px;" src="wallpapers/' . $image . '" title="' . $title . '" alt="' . $image . '"></a>';
		$i++;
	} echo "</div>";
	break;

case fanart:
	echo '<div class="center">';
	$images = scandir("../media/fanart");
	natsort($images);
	$i = 0;
	foreach($images as $image) {
		if($image == "." || $image == "..") continue;
		$title = substr($image, 0, -4);
		echo '<a id="img' . $i . '" rel="pop" href="fanart/' . $image . '" title="' . $title . '"><img class="shadow" style="height:200px; margin:5px;" src="fanart/' . $image . '" title="' . $title . '" alt="' . $image . '"></a>';
		$i++;
	} echo "</div>";
	break;

case videos:
	echo '<div class="center"><iframe width="880" height="495" src="http://www.youtube.com/embed/videoseries?list=PLC179DAED0274E304" frameborder="0" allowfullscreen></iframe></div>';
	separate_segment();
	echo '<div class="center"><iframe width="880" height="495" src="http://www.youtube.com/embed/videoseries?list=PLADfTwuzK0YQG6rKWImoeKlpVZy9dj_XI" frameborder="0" allowfullscreen></iframe></div>';
	break;

case music:
	echo '<div class="center">';
	$media = scandir("../media/music");
	natsort($media);
	$i = 0;
	$error = 'Your browser does not support the audio element.';
	foreach($media as $file) {
		if($file == "." || $file == "..") continue;
		$title = substr($file, 0, -4);
		$file = str_replace(' ', '%20', $file);
		echo '<p><a href="music/' . $file . '" download>' . $title . '</a><br><audio controls="controls" preload="none"><source src="music/' . $file . '" type="audio/ogg">' . $error . '</audio></p>';
	} echo "</div>";
}

separate_segment();
include("../utils/disqus.php");
end_segment();
end_page(); ?>

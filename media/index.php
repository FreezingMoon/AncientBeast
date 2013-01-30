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
	echo '<li style="display:inline;"><a href="#' . $sectionItem . '" style="padding:1.7em;">' . ucfirst($sectionItem) . '</a></li>';
}
?>
</ul></nav>
<?php end_segment(); ?>
<?php
start_segment();
echo "<div class='center'>";
$images = scandir("../media/artwork");
natsort($images);
$i = 0;
foreach($images as $image) {
	if($image == "." || $image == "..") continue;
	$title = substr($image, 0, -4); 
	echo "<a id='img{$i}' rel='pop' href='artwork/$image' title='$title'><img class='shadow' style='height:200px; margin:5px;' src='artwork/$image' title='$title'></a>";
	$i++;
} echo "</div>";
separate_segment();
include("../utils/disqus.php");
end_segment();
end_page(); ?>

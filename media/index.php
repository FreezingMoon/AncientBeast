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

// Display default or selected page
$type = isset($_GET['type']) ? $_GET['type'] : 'Media';

$style = '
.bigger { font-size: 28px; color: #e6e6e6; }
.artwork { height: 200px; margin: 5px; }
.screenies { width: 285px; margin: 5px; }
.wallpapers { width: 435px; margin: 5px; }
';
require_once("../header.php");

// Display list of subpages
$sections = array(
	'artwork',
	'fanart',
	'screenshots',
	'wallpapers',
	'videos',
	'music'
);
echo '<nav class="div center" id="navigation"><ul class="sections">';
foreach ($sections as &$sectionItem) {
	echo '<li style="display: inline;"><a href="?type=' . $sectionItem . '"  id="' . $sectionItem . '" style="padding:2em;">' . ucfirst($sectionItem) . '</a></li>';
}
echo '</ul></nav>';
?>

<script>
// Set page title
document.title = "Ancient Beast - <?php echo ucfirst($type); ?>";

// Hightlight media page
document.getElementById("Media").className += " active";
</script>

<link rel="stylesheet" href="fancybox/jquery.fancybox-1.3.4.css" media="screen">
<script src="../jquery.min.js"></script>

<?php
// This div serves as an anchor
echo '<div id="focus"></div>';

switch($type) {
	default:
		?>
		<div class="center">
			<div style="display: inline-block;" class="lighten">
				<a href="?type=artwork"><img src="<?php echo $site_root; ?>images/squares/artwork.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Browse Official Artwork</div></a>
			</div>
			<div style="display: inline-block;" class="lighten">
				<a href="?type=fanart"><img src="<?php echo $site_root; ?>images/squares/fanart.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png); ;">View Selected Fanart</div></a>
			</div>
			<div style="display: inline-block;" class="lighten">
				<a href="?type=screenshots"><img src="<?php echo $site_root; ?>images/squares/screenshots.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Gameplay Screenshots</div></a>
			</div>
			<div style="display: inline-block;" class="lighten">
				<a href="?type=wallpapers"><img src="<?php echo $site_root; ?>images/squares/wallpapers.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png); ;">Pick Desktop Wallpaper</div></a>
			</div>
			<div style="display: inline-block;" class="lighten">
				<a href="?type=videos"><img src="<?php echo $site_root; ?>images/squares/videos.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Watch Project Videos</div></a>
			</div>
			<div style="display: inline-block;" class="lighten">
				<a href="?type=music"><img src="<?php echo $site_root; ?>images/squares/music.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Listen To Music</div></a>
			</div>
		</div>
		<?php
		break;

	case 'artwork':
		$images = scandir("artwork");
		natsort($images);
		$i = 0;
		echo '<div class="div center">';
		foreach($images as $image) {
			if($image == "." || $image == "..") continue;
			$title = substr($image, 0, -4);
			$title = str_replace('_', ' ', $title);
			echo '<a id="img' . $i . '" rel="pop" href="artwork/' . $image . '" title="' . $title . '"><img class="shadow artwork" src="artwork/' . $image . '" title="' . $title . '" alt="' . $image . '"></a>';
			$i++;
		}
		echo '</div>';
		disqus();
		break;

	case 'fanart':
		?>
		<div class="div center">
		<?php $images = scandir("fanart");
		natsort($images);
		$i = 0;
		foreach($images as $image) {
			if($image == "." || $image == "..") continue;
			$title = substr($image, 0, -4);
			$title = str_replace('_', ' ', $title);
			echo '<a id="img' . $i . '" rel="pop" href="fanart/' . $image . '" title="' . $title . '"><img class="shadow artwork" src="fanart/' . $image . '" title="' . $title . '" alt="' . $image . '"></a>';
			$i++;
		}
		echo '</div><div class="div center">Post your fan art in the <a href="#comments"><b>comments</b></a> section or upload it to the <a href="http://Ancient-Beast.deviantArt.com" target="_blank"><b>deviantArt</b></a> group. The best works will be featured!</div>';
		disqus();
		break;

	case 'screenshots':
		echo '<div class="div center">';
		$images = scandir("screenshots");
		natsort($images);
		$images = array_reverse($images);
		$i = 0;
		foreach($images as $image) {
			if($image == "." || $image == "..") continue;
			$title = substr($image, 0, -4);
			echo '<a id="img' . $i . '" rel="pop" href="screenshots/' . $image . '" title="' . $title . '"><img class="shadow screenies" src="screenshots/' . $image . '" title="' . $title . '" alt="' . $image . '"></a>';
			$i++;
		}
		echo '</div>';
		disqus();
		break;

	case 'wallpapers':
		echo '<div class="div center">';
		$images = scandir("../media/wallpapers");
		natsort($images);
		$i = 0;
		foreach($images as $image) {
			if($image == "." || $image == "..") continue;
			$title = substr($image, 0, -4);
			echo '<a id="img' . $i . '" rel="pop" href="wallpapers/' . $image . '" title="' . $title . '"><img class="shadow wallpapers" src="wallpapers/' . $image . '" title="' . $title . '" alt="' . $image . '"></a>';
			$i++;
		}
		echo '</div>';
		disqus();
		break;

	case 'videos':
		?>
		<div class="div center">
		<iframe width="880" height="495" src="http://www.youtube.com/embed/videoseries?list=PLC179DAED0274E304" frameborder="0" allowfullscreen></iframe></div>
		<div class="div center" id="gameplay">
		<iframe width="880" height="495" src="http://www.youtube.com/embed/videoseries?list=PLADfTwuzK0YQG6rKWImoeKlpVZy9dj_XI" frameborder="0" allowfullscreen></iframe></div>
		<div class="div center" id="clips">
		<iframe width="880" height="495" src="//www.youtube.com/embed/videoseries?list=PLADfTwuzK0YR-qoT0Dy6o3AGAoNCq1Y3R" frameborder="0" allowfullscreen></iframe></div>
		<?php break;

	case 'music':
		?><div class="div center"><img src="band.jpg"><?php
		$folders = array('..', '.');
		$media = array_values(array_diff(scandir("../game/deploy/music"), $folders));
		natsort($media);
		$i = 0;
		$error = 'Your browser does not support the audio element.';

		echo '<audio id="audio" preload="auto" controls="" style="width:890px;"><source src="' . $site_url . 'game/deploy/music/' . $media[0] . '"> '. $error
			.'</audio><a style="cursor: pointer;" id="mp_shuffle">Shuffle</a><ul id="playlist" style="list-style-type:none; padding-left:0px;">';

		foreach($media as $file){
			$title = substr($file, 0, -4);
			$file = str_replace(' ', '%20', $file);
			if($title!="") echo '<li class=""><a href="' . $site_url . 'game/deploy/music/' . $file . '">' . $title . '</a></li>';
			$i++;
		} ?>
		</ul>
		</div><div class="div center">Click on a track to start playing it. Let us know which are your favorite ones by leaving a comment bellow.</div>
		<?php disqus(); ?>
		<script type="text/javascript" src="../game/src/music.js"></script>
<?php
}
echo "</div></div>";
include('../footer.php'); ?>

<!-- Highlight active subpage -->
<script>document.getElementById("<?php echo $type; ?>").className += " active";</script>

<!-- Focus on content when clicking subpage again -->
<script>document.getElementById("<?php echo $type; ?>").href += "#focus";</script>

<script type="text/javascript" src="fancybox/jquery.fancybox-1.3.4.pack.js"></script>
<script defer type="text/javascript" src="fancybox/jquery.easing-1.3.pack.js"></script>
<script defer type="text/javascript" src="fancybox/jquery.mousewheel-3.0.4.pack.js"></script>

<script type="text/javascript">
// Change URL to viewed image
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

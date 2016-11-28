<script src="../jquery.min.js"></script>
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
$page_title = 'Units';
$stylesheet = '../game/deploy/css/grid.css';
$style = '
.bigger {
	color: #e6e6e6;
	font-size: 28px;
}
#statsTable { border-collapse: collapse; }
#statsTable td { cursor: none; }
#statsTable th { font-weight: 400; cursor: pointer; }
#statsTable tr:nth-child(even), #statsTable th { background: rgba(200, 200, 200, 0.2); }
#statsTable tr:hover, #statsTable col.hover { background: rgba(200, 200, 200, 0.4); }
#statsTable td:hover { color: white; }

';
require_once '../header.php';
require_once 'functions.php';

$creature_results = get_creatures();
$view = isset($_GET['view']) ? $_GET['view'] : 'Units';

// License 
$license = '<div class="div" id="license">All the characters are under the <a href="http://creativecommons.org/licenses/by-sa/3.0/" target="_blank"><b>CC-BY-SA 3.0</b></a> license. You can use them however you like, even for commercial projects, as long as you credit / link the project and mention the original artist(s), similar to the next example: <i>from Ancient Beast game project http://AncientBeast.com - character (or artwork) created by Awesome_Dude</i></div>';
?>

<!-- Hightlight active page -->
<script>document.getElementById("<?php echo $page_title; ?>").className += " active";</script>

<?php
// Display list of subpages
$sections = array(
	'viewer',
	'table',
	'sets',
	'widget',
	'dwellings',
	'metrics'
);
echo '<nav class="div center"><ul class="sections">';
foreach ($sections as &$sectionItem) {
	echo '<li style="display: inline;"><a href="?view=' . $sectionItem . '"  id="' . $sectionItem . '" style="padding: 2.5em;">' . ucfirst($sectionItem) . '</a></li>';
}
echo '</ul></nav>';

// This div serves as an anchor
echo '<div id="focus"></div>';

switch ($view) {
	default:
		?>
		<div class="center">
			<div style="display: inline-block;" class="lighten">
				<a href="?view=viewer"><img src="<?php echo $site_root; ?>images/squares/viewer<?php echo rand(1, 2); ?>.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Unit Cards Viewer</div></a>
			</div>
			<div style="display: inline-block;" class="lighten">
				<a href="?view=sets"><img src="<?php echo $site_root; ?>images/squares/sets.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Complete Grid Sets</div></a>
			</div>
			<div style="display: inline-block;" class="lighten">
				<a href="?view=table"><img src="<?php echo $site_root; ?>images/squares/table.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Stats Comparison Table</div></a>
			</div>
			<div style="display: inline-block;" class="lighten">
				<a href="?view=widget"><img src="<?php echo $site_root; ?>images/squares/widget.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">3D Models Widget</div></a>
			</div>
			<div style="display: inline-block;" class="lighten">
				<a href="?view=dwellings"><img src="<?php echo $site_root; ?>images/squares/dwellings.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Realms And Dwellings</div></a>
			</div>
			<div style="display: inline-block;" class="lighten">
				<a href="?view=metrics"><img src="<?php echo $site_root; ?>images/squares/metrics.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Online Usage Metrics</div></a>
			</div>
		</div>
		<?php
		break;

	case 'viewer':
		include 'viewer.php';
		break;

	case 'table':
		include 'table.php';
		break;

	case 'sets':
		include 'sets.php';
		break;

	case 'widget':
		include 'widget.php';
		break;

	case 'dwellings':
		include 'dwellings.php';
		break;

	case 'metrics':
		include 'metrics.php';
}

include('../footer.php'); ?>

<!-- Highlight active subpage -->
<script>document.getElementById("<?php echo $view; ?>").className += " active";</script>

<!-- Focus on content when clicking subpage again -->
<script>document.getElementById("<?php echo $view; ?>").href += "#focus";</script>

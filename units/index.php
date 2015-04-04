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
$stylesheet = '../game/css/grid.css';
require_once('../header.php');
require_once('functions.php');

$creature_results = get_creatures();
$view = isset($_GET['view']) ? $_GET['view'] : 'default';

// License 
$license = '<div class="div" id="license">All the characters are under the <a href="http://creativecommons.org/licenses/by-sa/3.0/" target="_blank"><b>CC-BY-SA 3.0</b></a> license. You can use them however you like, even for commercial projects, as long as you credit / link the project and mention the original artist(s), similar to the next example: <i>from Ancient Beast game project http://AncientBeast.com - character (or artwork) created by Awesome_Dude</i></div>';
?>

<!-- Hightlight active page -->
<script>document.getElementById("<?php echo $page_title; ?>").className += " active";</script>

<div class="center">
	<div style="display: inline-block;" class="lighten">
		<a href="?view=widget"><div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Unit Cards Widget</div></a>
	</div>
	<div style="display: inline-block;" class="lighten">
		<a href="?view=table"><div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Stats Comparison Table</div></a>
	</div>
	<div style="display: inline-block;" class="lighten">
		<a href="?view=sets"><div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Complete Grid Sets</div></a>
	</div>
</div>
<?php

switch ($view) {
	default:
		require_once('cards.php');
		?>
		<link rel="stylesheet" href="progress.css">

		<!-- Use unit name as page title -->
		<script>document.title = "Ancient Beast - Miss Creeper";</script>

		<!-- Carousel -->
		<script type="text/javascript" src="carousel.js"></script>
		<style type="text/css">
		#carousel {
			display: block;
			height: 128px;
			width: 896px;
			margin: 0px;
			line-height: 0px;
			background-image: url("../images/carousel.png"); 
			background-size: 100%; 
			padding: 27px;
			margin-bottom: 5px;
			/* Disable selection when double clicking last avatar */
			-webkit-touch-callout: none;
			-webkit-user-select: none;
			-khtml-user-select: none;
			-moz-user-select: none;
			-ms-user-select: none;
			user-select: none;
		}
		</style>

		<div id="carousel"></div>

		<div class="div center">
		<?php
		// Cards
		// TODO: Show a random unit at start if none defined via GET variable
		// TODO: Sort these by set / realm / level instead of id
		$i = 0;
		foreach ($creature_results as $r) {
			if ($r['id'] == 19) {
				$underscore = str_replace(' ', '_', $r['name']);
				cards($r);
				echo '<br>';
				progress($r['progress'],$r);
				// TODO: Add left and right arrow hotkeys
				// TODO: Add card flip eyecandy animation
				echo '</div>';
			}
		}
		?>
		</div>
		<!-- Sketchfab embedded folder -->
		<!-- TODO: Make it display on click -->
		<!--
		<div class="div center">
		<iframe width="890" height="995" src="https://sketchfab.com/playlists/embed?folder=3629b9ff802d45f09771ec13a7d25c75" frameborder="0" allowfullscreen mozallowfullscreen="true" webkitallowfullscreen="true" onmousewheel=""></iframe>
		</div>
		-->
		<?php
		echo $license;
		disqus('Ancient Beast - Miss Creeper');
		break;

	case 'table':
		require_once("../images/stats/index.php");
		// TODO: Show specific unit card when clicking a row
		?>
		<script>document.title = "Ancient Beast - Table";</script>
		<script type="text/javascript" src="jquery.tablesorter.min.js"></script>
		<script>$(function() {
			$("#unitsTable").tablesorter( {
				"paging": false,
				"search": false
			} );
		} );</script>
		<div class="div center">
		<style type="text/css">
		#unitsTable th { font-weight: 400; cursor: pointer; }
		#unitsTable tr:nth-child(even) { background: rgba(200, 200, 200, 0.2); }
		#unitsTable tr:hover { background: rgba(200, 200, 200, 0.4); }
		</style>
		<table id="unitsTable" class="tablesorter" width=100%>
			<thead>
				<tr style="background: none !important;">
					<th style="text-align: left;">Unit Name</th>
					<th class="center" title="Level" style="font-size: 32px;">&#8679;</th>
					<th class="center" title="Size" style="font-size: 32px;">&#11041;</th>
					<th class="center" title="Progress" style="font-size: 32px;">&#9719;</th>
					<th class="center" title="Health"><span class="icon health"></span></th>
					<th class="center" title="Regrowth"><span class="icon regrowth"></span></th>
					<th class="center" title="Endurance"><span class="icon endurance"></span></th>
					<th class="center" title="Energy"><span class="icon energy"></span></th>
					<th class="center" title="Meditation"><span class="icon meditation"></span></th>
					<th class="center" title="Initiative"><span class="icon initiative"></span></th>
					<th class="center" title="Offense"><span class="icon offense"></span></th>
					<th class="center" title="Defense"><span class="icon defense"></span></th>
					<th class="center" title="Movement"><span class="icon movement"></span></th>
					<th class="center" title="Pierce"><span class="icon pierce"></span></th>
					<th class="center" title="Slash"><span class="icon slash"></span></th>
					<th class="center" title="Crush"><span class="icon crush"></span></th>
					<th class="center" title="Shock"><span class="icon shock"></span></th>
					<th class="center" title="Burn"><span class="icon burn"></span></th>
					<th class="center" title="Frost"><span class="icon frost"></span></th>
					<th class="center" title="Poison"><span class="icon poison"></span></th>
					<th class="center" title="Sonic"><span class="icon sonic"></span></th>
					<th class="center" title="Mental"><span class="icon mental"></span></th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td>Dark Priest</td>
					<td class="center"></td>
					<td class="center">1</td>
					<td class="center">70</td>
					<td class="center">100</td>
					<td class="center">1</td>
					<td class="center">60</td>
					<td class="center">100</td>
					<td class="center">20</td>
					<td class="center">50</td>
					<td class="center">3</td>
					<td class="center">3</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">30</td>
				</tr>
				<tr>
					<td>Magma Spawn</td>
					<td class="center">2</td>
					<td class="center">3</td>
					<td class="center">89</td>
					<td class="center">100</td>
					<td class="center">1</td>
					<td class="center">60</td>
					<td class="center">100</td>
					<td class="center">20</td>
					<td class="center">50</td>
					<td class="center">3</td>
					<td class="center">3</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">30</td>
				</tr>
				<tr>
					<td>Uncle Fungus</td>
					<td class="center">3</td>
					<td class="center">2</td>
					<td class="center">90</td>
					<td class="center">100</td>
					<td class="center">2</td>
					<td class="center">62</td>
					<td class="center">120</td>
					<td class="center">23</td>
					<td class="center">54</td>
					<td class="center">5</td>
					<td class="center">3</td>
					<td class="center">6</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">30</td>
				</tr>
				<tr>
					<td>Abolished</td>
					<td class="center">3</td>
					<td class="center">2</td>
					<td class="center">88</td>
					<td class="center">100</td>
					<td class="center">2</td>
					<td class="center">62</td>
					<td class="center">120</td>
					<td class="center">23</td>
					<td class="center">54</td>
					<td class="center">5</td>
					<td class="center">3</td>
					<td class="center">6</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">2</td>
					<td class="center">30</td>
				</tr>
			</tbody>
		</table>
		</div>
		<?php
		disqus('Ancient Beast - Table');
		break;

	case 'sets':
		require_once('grid.php');
		require_once('cards.php'); ?>

		<!-- Grid Adjustments -->
		<style type="text/css">
		#creaturegrid .vignette,
		.vignette div.border,
		.vignette div.overlay {height: 128px; width: 128px;}
		#creaturegrid {width: 896px; height: 896px;}
		</style>
		<link rel="stylesheet" href="progress.css">
		<?php creatureGrid($creature_results); ?>
		<br>
		<?php
		// Cards
		$i = 0;
		foreach ($creature_results as $r) {
			$underscore = str_replace(' ', '_', $r['name']);
			echo "<div class='div center' id='$underscore'>";
			cards($r);
			echo '<br>';
			progress($r['progress'],$r);
			echo '</div>';
			$i++;
		}
		echo $license;
}

include('../footer.php'); ?>

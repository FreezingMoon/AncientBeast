<script src="//ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"></script>
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
$page_title = 'Ancient Beast - Units';
$stylesheet = '../combat/css/grid.css';
require_once('../header.php');
require_once('grid.php');
require_once('cards.php');
require_once('functions.php');

$creature_results = get_creatures();
// TODO: Navigation bar
//echo '<nav>Modes: Single | Multiple | List</nav>';
?>

<!-- License -->
<div class="div" id="license">All the characters are under the <a href="http://creativecommons.org/licenses/by-sa/3.0/" target="_blank"><b>CC-BY-SA 3.0</b></a> license. You can use them however you like, even for commercial projects, as long as you credit / link the project and mention the original artist(s), similar to the next example: <i>from Ancient Beast game project http://AncientBeast.com - character (or artwork) created by Awesome_Dude</i></div>

<!-- Grid view -->
<style type="text/css">
#creaturegrid .vignette,
.vignette div.border,
.vignette div.overlay {height: 128px; width: 128px;}
#creaturegrid {width: 896px; height: 896px;}

.progress-widget {background: url('../images/progress.png') no-repeat 0 -75px; width: 825px; height: 75px; margin-top: 10px;}
.common-values {
	background-image: url('../images/progress.png');
	width: 75px;
	height: 75px;
	display: inline-block;
}
.progress-0 {background-image: none;}
.progress-10 {background-position: -675px 0;}
.progress-20 {background-position: -600px 0;}
.progress-30 {background-position: -525px 0;}
.progress-40 {background-position: -450px 0;}
.progress-50 {background-position: -375px 0;}
.progress-60 {background-position: -300px 0;}
.progress-70 {background-position: -225px 0;}
.progress-80 {background-position: -150px 0;}
.progress-90 {background-position: -75px 0;}
.progress-100 {background-position: 0 0;}
</style>
<?php creatureGrid($creature_results); ?>
<br>
<?php
// Detailed view
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
disqus('Ancient Beast - Bestiary');
include('../footer.php'); ?>

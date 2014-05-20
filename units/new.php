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

$page_title = 'Ancient Beast - Units';
$stylesheet = '../combat/css/grid.css';
require_once('../header.php');
require_once('../global.php');
require_once('../images/stats/index.php');
require_once('functions.php');
require_once('cards.php');
require_once('grid.php');

$creature_results = get_creatures();
//navigation bar
//TODO
//echo '<nav>Modes: Normal | List | Versus - Log-in to purchase creatures. || You own x out of 50 creatures. - View: 2D/3D - SketchFab gallery</nav>';
//get link php variable
//if normal, list or versus...

//grid view
//TODO: show Shadow Leech avatar when Sarcophag is selected maybe
?>
<style type="text/css">
	#creaturegrid .vignette,
	.vignette div.border,
	.vignette div.overlay {
		height: 128px;
		width: 128px;
	}
	#creaturegrid {
		width: 896px;
		height: 896px;
	}
</style>
<?php creatureGrid($creature_results);

//detailed view
//TODO: code to open up to specific unit (based on link and array key)
//TODO: don't try to change elements one by one, but the whole div, might require AJAX and server side action
$type = $_GET['id'];
if (!isset($id)) $id = 0;
//$url = parse_url("http://localhost/AncientBeast/units/new.php# ");
//echo $url["fragment"]; //This variable contains the fragment

foreach ($creature_results as $r) {
	$underscore = str_replace(' ', '_', $r['name']);
	echo "<br><div class='div center' id='$underscore'>";
	cards($r);
	echo '<br>';
	progress($r['progress'],$r);
	echo '</div>';
}

//TODO: back-forward buttons for easier unit navigation
disqus('Ancient Beast - Bestiary');
include('../footer.php'); ?>
<script src="//ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"></script>

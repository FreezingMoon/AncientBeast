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

$page_title = 'Ancient Beast - Bestiary';
require_once('../header.php');
require_once('../global.php');
require_once('../images/stats/index.php');
require_once('cards.php');
require_once('grid.php');

$creatures = 'SELECT * FROM ab_creatures ORDER BY sin, lvl';
$creature_results = db_query($creatures);

function progress($id, $ab_name) {
	$ab_id = mysql_real_escape_string($id);
	$ab_progress = "SELECT * FROM ab_progress WHERE id = '$ab_id'";
	$rows = db_query($ab_progress);
	foreach ($rows as $r) {
		$sum = array_sum($r);
		$total = ($sum - $r['id']) / 10;
		$rounded_total = 10 * round ($total/10) ;
		echo "<center><div style='width:825px; background-image:url(../images/progress/widget.png);'><a href='http://www.wuala.com/AncientBeast/bestiary/$ab_name' target='_blank'>";
		foreach($r as $key => $value) {
			if($key == 'id') continue;
			$title = ucfirst($key) . ": $value% complete";
			echo "<img src='../images/progress/$value.png' title='$title'>";
		} echo "<img src='../images/progress/$rounded_total.png' title='Total: $total% completed'></a></div></center>";
	}
}

//grid view
echo '<style type="text/css">
		#creaturegrid .vignette:hover div.border{background-image: url("'.$site_root.'/images/frame_focused.png");}
		#creaturegrid .vignette,
		.vignette div.border,
		.vignette div.overlay{
			height: 128px;
			width: 128px;
		}
		#creaturegrid{
			width: 896px;
			height: 896px;
		}
	</style>';
creatureGrid($creature_results,false);

//detailed view
foreach ($creature_results as $r) {
	$spaceless = str_replace(' ', '_', $r['name']);
	start_segment($spaceless);
	cards($r['id']);
	echo '<br>';
	progress($r['id'], $r['name']);
	end_segment();
}

start_segment();
echo '<center>Please let us know your top 3 favorite creatures by commenting below. Any other feedback also welcomed!</center>';
separate_segment();
include('../utils/disqus.php');
end_segment();
end_page(); ?>

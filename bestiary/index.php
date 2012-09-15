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
require_once('../stats/index.php');
require_once('cards.php');
$spaceless = str_replace(' ', '_', $r['name']);

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

function call_creature($name) {
	$spaceless = str_replace(' ', '_', $name);
	echo '<br><div align=center><audio controls src="' . $name . '/' . $spaceless . '.ogg"></audio></div>';
}

//grid view
echo '<div style="text-align:center;"><a name="grid">';
foreach ($creature_results as $r) {
	if ($r['id'] == 0 || $r['id'] == 50) {
		continue;
	}
	$spaceless = str_replace(' ', '_', $r['name']);
	echo '<div class="lighten" style="background:url(\'' . $site_root . 'bestiary/' . $r['name'] . '/avatar.jpg\'); background-size: 100%; display: inline-block; margin-bottom:-3px; cursor: pointer;"><a href="#' . $spaceless . '"><img style="display: block;" src="' . $site_root . 'images/frame.png"></a></div>'; 
}
echo '</a></div>';

//detailed view
foreach ($creature_results as $r) {
	start_segment();
	cards($r['id']);
	echo '<br>';
	progress($r['id'], $r['name']);
	call_creature($r['name']);
	end_segment();
}

start_segment();
echo '<center>Please let us know your top 3 favorite creatures by commenting below. Any other feedback also welcomed!</center>';
separate_segment();
include('../utils/disqus.php');
end_segment();
end_page(); ?>

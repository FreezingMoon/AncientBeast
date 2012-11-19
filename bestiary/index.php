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

$creatures = "SELECT ab_creatures.*, ab_stats.*, ab_abilities.*, ab_progress.* FROM ab_creatures
				LEFT JOIN ab_stats ON ab_creatures.id = ab_stats.id
				LEFT JOIN ab_abilities ON ab_creatures.id = ab_abilities.id
				LEFT JOIN ab_progress ON ab_creatures.id = ab_progress.id
				ORDER BY ab_creatures.sin , ab_creatures.lvl";
$creature_results = db_query($creatures);

function progress($r) {
		$sum = 0;
		echo "

<div class='center' style='width:825px; background-image:url(../images/progress/widget.png);'>
		<a href='http://www.wuala.com/AncientBeast/bestiary/".$r["name"]."' target='_blank'>";
		$i = 0;
		foreach($r as $key => $value) {
			if($i++ < 32) continue; //Ignore Other keys
			$sum += $value;
			$title = ucfirst($key) . ": $value% complete";
			echo "<img src='../images/progress/$value.png' height='75' width='75' title='$title'>";
		}
		$total = $sum / 10;
		$rounded_total = 10 * round ($total/10) ;
		echo "<img src='../images/progress/$rounded_total.png' height='75' width='75' title='Total: $total% completed'>
	</a>
</div>";

}

//navigation bar
//TODO
//start_segment();
//echo '<nav>Modes: Normal | List | Versus - Log-in to purchase creatures. || You own x out of 50 creatures. - View: 2D/3D - SketchFab gallery</nav>';
//end_segment();
//get link php variable
//if normal, list or versus...

//grid view
echo '<style type="text/css">
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
	cards($r);
	echo '<br>';
	progress($r);
	end_segment();
}

start_segment();
echo '<div class="center">Please let us know your top 3 favorite creatures by commenting below. Any other feedback also welcomed!</div>';
separate_segment();
include('../utils/disqus.php');
end_segment();
end_page(); ?>

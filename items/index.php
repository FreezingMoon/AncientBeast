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

$page_title = "Ancient Beast - Items";
$style = "
.fix {
	margin-bottom: -15px;
}
.item {
	text-align: center;
	width: 14%;
	vertical-align: top;
}";
require_once("../header.php");
require_once("../global.php");
require_once("../stats/index.php");

//Sorts the arrays by absolute value
function magnitudesort($a, $b)
{
    if ($a == $b) {
        return 0;
    }
    return (abs($a) < abs($b)) ? -1 : 1;
}

//Get the SQL query order 
function getSQLorder() {
	global $stats;
	if(!isset($_GET['filter']) || !in_array($_GET['filter'], array_keys($stats), true))
		return 'ORDER BY type, value DESC';
	else {
		$f = mysql_real_escape_string($_GET['filter']);
		return "WHERE $f IS NOT NULL ORDER BY ABS($f) DESC";
	}
}

//Query MYSQL
$order = getSQLorder();
$items = 'SELECT id, name, value, type FROM ab_items '.$order;
$rows = db_query($items);
$statquery = 'SELECT '.implode(', ', array_keys($stats)).' FROM ab_items '.$order;
$itemstats = db_query($statquery);

//Sort stats and package items
for($r=0;$r<count($itemstats);$r++){
	uasort($itemstats[$r], "magnitudesort");
	$itemstats[$r] = array_reverse($itemstats[$r]);
	$keys[$r] = array_keys($itemstats[$r]);
	$rows[$r]['stats'] = $itemstats[$r];
	$rows[$r]['keys'] = $keys[$r];
}

//Show filters
start_segment();
echo "<table style='width: 100%;'><tr>";
foreach($stats as $k => $x) 
	echo "<th><a href='{$site_root}items/index.php?filter=$k'>$x</a></th>";
echo "</tr></table>";

separate_segment();

//print the main short list
echo '<a id="grid"></a><table style="width: 100%;"><tr>';
$i = 0;
foreach ($rows as $r) {
	$i++;
	echo "<td class=\"item\"><span style=\"cursor: pointer;\" class=\"lighten\"><a href=\"#{$r['id']}\"><center><img class=\"fix\" src=\"{$site_root}items/icons/" . rawurlencode($r['name']) . ".png\" style=\"display:block;\"></center><br>{$r['name']}</a></span></td>";
	if (($i % 6) == 0) echo '</tr><tr>';
}
echo "</tr></table></a>";
end_segment();

//print each item
foreach ($rows as $r) {
	start_segment();
	echo "<table style='width: 100%; text-align:center;'>";
	echo "<tr><td style=\"width: 132px;\"><a name=\"{$r['id']}\" href=\"#grid\"><img src=\"{$site_root}items/icons/" . rawurlencode($r['name']) . ".png\"></a></td>";
	echo "<td><table style='width: 100%; font-size:24px; text-align:left;'><tr>";
	echo "<td style='width: 40%;'><a href='#{$r['id']}'>{$r['name']}</a></td>";
	echo "<td style='width: 20%;'><a href='#'>{$r['value']}<img src='{$site_root}items/coins.png'></a></td>";
	echo "<td style='width: 20%;'><a href='#'>Gift<img src='{$site_root}items/gift.png'></a></td>";
	echo "<td style='width: 20%;'><a href='#'>Purchase<img src='{$site_root}items/purchase.png'></a></td>";
	echo "</tr></table><br><table style='text-align:center;'><tr>";

	//ICONS from $rows[$r]['keys']
 	for ($i=0; $i <count($r['keys']); $i++) {
		if($r['stats'][$r['keys'][$i]])
			echo "<th style='padding:4px;'>".$stats[$r['keys'][$i]]."</th>";
  }
  echo "</tr><tr>";

	//stats from $rows[$r]['keys']
 	for ($i=0; $i <count($r['stats']); $i++) {
		if($r['stats'][$r['keys'][$i]])
			echo "<td>".$r['stats'][$r['keys'][$i]]."</td>";
  }

	echo "</tr></table></td></tr></table>";
	end_segment();
}

start_segment();
include("../utils/disqus.php");
end_segment();
end_page();
?>

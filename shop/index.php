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

$page_title = "Ancient Beast - Shop";
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
require_once("../images/stats/index.php");


//Sorts the arrays by absolute value
function sortItems($a, $b)
{
	global $sortingArray;

	//For each critera
	for ($i=0; $i < count($sortingArray); $i++) {

		$sortIndex = $sortingArray[$i];

		if( $a[$sortIndex] == "" ){
			$a = $a["stats"];
			$b = $b["stats"];
		}

		//If same value continue to the next sorting critera
	    if ($a[$sortIndex] == $b[$sortIndex]) {
	        continue;
	    }

	    //Else determine what to do
	    return (abs($a[$sortIndex]) < abs($b[$sortIndex])) ? -1 : 1;
	}

    return 0;
}

function filterStat($var){
	global $statSelected;
	return ( $var["stats"][$statSelected] != "" );
}

//Get the SQL query order 
function getItems() {
	global $stats;
	global $statSelected;
	global $sortingArray;

	$data = json_decode(file_get_contents('../data/items.json'), true);
	if(!isset($_GET['filter']) || !in_array($_GET['filter'], array_keys($stats), true)) {
		$sortingArray = ["value","type"];
		uasort($data, "sortItems");
		$data = array_reverse($data);
	} else {
		$statSelected = $_GET['filter'];
		$sortingArray = [ $_GET['filter'] ];
		$data = array_filter($data,"filterStat");
		uasort($data, "sortItems");
		$data = array_reverse($data);
	}

	return $data;
}

//Gathering Data
$data = getItems();


//Show filters
start_segment();

echo "<table style='width: 100%;'><tr>";
foreach($stats as $k => $x)
	displayStat($k,$statCount[$k],"{$site_root}shop/index.php?filter=$k");
echo "</tr></table>";

separate_segment();


//grid view
echo '<table style="width: 100%;"><tr>';
$i = 0;
foreach ($data as $r) {
	$i++;
	echo "<td class=\"item\"><span style=\"cursor: pointer;\" class=\"lighten\"><a href=\"#{$r['id']}\"><center><img class=\"fix\" src=\"{$site_root}shop/items/" . rawurlencode($r['name']) . ".png\" style=\"display:block;\"></center><br>{$r['name']}</a></span></td>";
	if (($i % 6) == 0) echo '</tr><tr>';
}
echo "</tr></table></a>";
end_segment();


//detailed view
foreach ($data as $r) {
	start_segment($r['id']);
	echo "<table style='width: 100%; text-align:center;'>";
	echo "<tr><td style=\"width: 132px;\"><a href=\"#{$r['id']}\"><img src=\"{$site_root}shop/items/" . rawurlencode($r['name']) . ".png\"></a></td>";
	echo "<td><table style='width: 100%; font-size:24px; text-align:left;'><tr>";
	echo "<td style='width: 40%;'><a href='#{$r['id']}'>{$r['name']}</a></td>";
	echo "<td style='width: 20%;'><a href='#'>{$r['value']}<img src='{$site_root}shop/coins.png'></a></td>";
	echo "<td style='width: 20%;'><a href='#'>Gift<img src='{$site_root}shop/gift.png'></a></td>";
	echo "<td style='width: 20%;'><a href='#'>Purchase<img src='{$site_root}shop/purchase.png'></a></td>";
	echo "</tr></table><br><table style='text-align:center;'><tr>";

	foreach ($r['stats'] as $key => $value) {
		if($value) displayStat($key,$value);
	}

	echo "</tr></table></td></tr></table>";
	end_segment();
}

start_segment();
include("../utils/disqus.php");
end_segment();
end_page();
?>
<style type="text/css">
.stats{ padding: 0 4px; }
</style>

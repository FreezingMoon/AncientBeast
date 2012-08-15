<!--
 * Ancient Beast - Free Open Source Online PvP TBS: card game meets chess, with creatures.
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
-->

<style>
.card {
	width: 430px;
	height: 550px;
	background-repeat: no-repeat;
	cursor: default;
}
.beast {
	font-size: 24px;
	text-align: center;
}
.section {
	color: #fff;
	border-style: solid;
	border-color: transparent;
	width: 400px;
	text-shadow: black 0.1em 0.1em 0.2em;
	font-weight: bold;
	font-size: 16px;
}
.contrast {
	background: rgba(0,0,0,0.5);
}
.abilities {
	vertical-align: top;
	text-align: left;
}
.numbers {
	font-size: 12px;
	font-weight: bold;
	text-align: center;
}
</style>
<?php

function ability($x, &$y, $ab_name, $row) {
	global $site_root;
	echo "<td style=\"background-image: url('contour.png'), url('{$site_root}bestiary/$ab_name/$y.svg'), url('missing.png'); background-size: 100% 100%; width:99px; height:99px;\"></td>";
	$y++;
	echo "<td><u>{$row[$x]}</u><br>{$row["$x info"]}</td></tr>";
}

function cards($id) { //Print a card
	global $site_root;
	global $stats2;

	$ab_id = mysql_real_escape_string($id);
	$ab_creatures = "SELECT * FROM ab_creatures WHERE id = '$ab_id'";
	$ab_stats = "SELECT * FROM ab_stats WHERE id = '$ab_id'";
	$ab_abilities = "SELECT * FROM ab_abilities WHERE id = '$ab_id'";
  
	$ab_creatures_results = db_query($ab_creatures);
	$ab_abilities_results = db_query($ab_abilities);
 	$ab_stats_results = db_query($ab_stats);
		$counter = 0; //make it so $ab_stats_results[0][$i] works for the forloop to retrieve half
		foreach ($ab_stats_results[0] as $x) {
			$ab_stats_results[0][$counter] = $x;
			$counter++;
		}
	
	//Card entry
	foreach ($ab_creatures_results as $r) {
		$ab_name = $r['name'];
		$spaceless = str_replace(" ", "_", $ab_name);
		echo "<center><a name=\"$spaceless\"></a><table border=0><th class=\"card\" style=\"background-image: url('{$site_root}images/cards/margin.png'), url('{$site_root}bestiary/{$r['name']}/artwork.jpg'), url('{$site_root}images/cards/{$r['sin']}.png'); background-position:center;\">"; 
		echo "<a href=\"#{$spaceless}\"><div class=\"section\" style=\"border: 0px; width:430px; height:550px;\"><table class=\"section contrast\" style=\"border:3px solid black; position:relative; top:370px; left:15px;\"><tr class=\"beast\"><td width=\"20%\">{$r['sin']}{$r['lvl']}</td><td>{$r['name']}<td width=\"20%\">{$r['hex']}H</td></tr></table></div></a>";
	}
	
	//Display ICONS
	echo "</th><th class=\"card\" style=\"background-image: url('{$site_root}images/cards/margin.png'), url('{$site_root}images/cards/{$r['sin']}.png'); padding-left:15px;\"><table class=\"section\"><tr class=\"numbers\">";
	for($i = 0; $i<9; $i++) echo "<th>{$stats2[$i]}</th>";
	echo "</tr><tr class='numbers'>";
	
	//Display numbers
	for($i = 1; $i<10; $i++) {
		echo "<td>{$ab_stats_results[0][$i]}</td>";
	}
	echo "</tr></table>";

	//Display Abilities
	echo "<table style='margin-top:-10px; margin-bottom:-10px;' class='section abilities'><tr>";
	$abilities = array("passive", "weak", "medium", "strong");
	$y = 0;
	foreach ($ab_abilities_results as $r)
		foreach ($abilities as $x)
			ability($x, $y, $ab_name, $r);
	echo "</tr></table>";
	
	//Display ICONS
	echo "<table class='section'><tr class='numbers'>";
	for($i = 9; $i<18; $i++) echo "<th>{$stats2[$i]}</th>";
		echo "</tr><tr class='numbers'>";
	
	//Display Numbers
	for($i = 10; $i<19; $i++) {
		echo "<td>{$ab_stats_results[0][$i]}</td>";
	}
	echo "</tr></table>";
	echo "</th></table>";
	echo "</a></center>";
}
?>

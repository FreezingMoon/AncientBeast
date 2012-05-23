<style>
.card {
	width: 430px;
	height: 550px;
	background-image: url(card.png);
	background-repeat: no-repeat;
	padding: 15px;
	margin: 0px;
	vertical-align: top;
	cursor: default;
}
.beast {
	font-family: Lucida Grande;
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
	font-family: 'Lucida Grande', Verdana, Arial, Sans-Serif;
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
	echo "<table width=860px border=0><th class='card'>"; 
	foreach ($ab_creatures_results as $r) {
		$ab_name = $r['name'];
		$spaceless = str_replace(" ", "_", $ab_name);
		echo "<center><a name=\"$spaceless\">";
		echo "<table class='section'><tr class='beast'><td width='20%'>{$r['sin']}{$r['lvl']}</td><td><a href='#{$spaceless}'>".strtoupper($r['name'])."</a><td width='20%'>{$r['hex']}H</td></tr></table>";
		echo "<a href=\"#grid\"><div class=\"section\" style=\"border: 0px; background:url('{$site_root}bestiary/{$r['name']}/artwork.jpg'); width:400px; height:400px;\"><img src=\"AB.png\" style=\"position:relative; top:365px; left:180px;\"></div></a>";
		echo "<div class='section' style='text-align: center; width: 390px; padding: 5px 0px;'>{$r['description']}</div>";
	}
	
	//Display ICONS
	echo "</th><th class='card'><table class='section'><tr class='numbers'>";
	for($i = 0; $i<9; $i++) echo "<th>{$stats2[$i]}</th>";
	echo "</tr><tr class='numbers'>";
	
	//Display numbers
	for($i = 1; $i<10; $i++) {
		echo "<td>{$ab_stats_results[0][$i]}</td>";
	}
	echo "</tr></table>";

	//Print Abilities
	echo "<table style='margin-top:-10px; margin-bottom:-10px;' class='section abilities'><tr>";
	$abilities = array("passive", "weak", "medium", "strong");
	$y = 0;
	foreach ($ab_abilities_results as $r)
		foreach ($abilities as $x)
			ability($x, $y, $ab_name, $r);
	echo "</tr></table>";
	
	//ICONS
	echo "<table class='section'><tr class='numbers'>";
	for($i = 9; $i<18; $i++) echo "<th>{$stats2[$i]}</th>";
		echo "</tr><tr class='numbers'>";
	
	//Numbers
	for($i = 10; $i<19; $i++) {
		echo "<td>{$ab_stats_results[0][$i]}</td>";
	}
	echo "</tr></table>";
	echo "</th></table>";
	echo "</a></center>";
}
?>

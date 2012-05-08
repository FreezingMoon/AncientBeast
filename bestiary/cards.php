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
function ability($x, &$y, $ab_id, $row) {
	global $site_root;
	echo "<td style=\"background-image: url('contour.png'), url('{$site_root}creatures/$ab_id/$y.svg'), url('missing.png'); background-size: 100% 100%; width:99px; height:99px;\"></td>";
	$y++;
	echo "<td><u>{$row[$x]}</u><br>{$row["$x info"]}</td></tr>";
}
function cards($id) {
	global $site_root;
	$ICON_LIST = array(HEALTH_ICON, REGROWTH_ICON, FATIGUE_ICON, ENERGY_ICON, MEDITATION_ICON, DELAY_ICON, OFFENSE_ICON, DEFENSE_ICON, MOVEMENT_ICON, PIERCE_ICON, SLASH_ICON, CRUSH_ICON, SHOCK_ICON, BURN_ICON, FROST_ICON, POISON_ICON, SONIC_ICON, MENTAL_ICON);
	$ab_id = mysql_real_escape_string($id);
	$ab_creatures = "SELECT * FROM ab_creatures WHERE id = '$ab_id'";
	$ab_stats = "SELECT * FROM ab_stats WHERE id = '$ab_id'";
	$ab_abilities = "SELECT * FROM ab_abilities WHERE id = '$ab_id'";
	$rows = db_query($ab_creatures);
	echo "<table width=860px border=0><th class='card'>"; 
	foreach ($rows as $r) {
		echo "<table class='section'><tr class='beast'><td width='20%'>{$r['sin']}{$r['lvl']}</td><td><a href='#{$r['id']}'>".strtoupper($r['name'])."</a><td width='20%'>{$r['hex']}H</td></tr></table>";
		echo "<a href=\"#grid\"><div class=\"section\" style=\"border: 0px; background:url('{$site_root}creatures/$ab_id/artwork.jpg'); width:400px; height:400px;\"><img src=\"AB.png\" style=\"position:relative; top:365px; left:180px;\"></div></a>";
		echo "<div class='section' style='text-align: center; width: 390px; padding: 5px 0px;'>{$r['description']}</div>";
	}
	echo "</th><th class='card'><table class='section'><tr class='numbers'>";
	for($i = 0; $i<9; $i++) echo "<th>{$ICON_LIST[$i]}</th>";
	echo "</tr><tr class='numbers'>";
	$rows = db_query($ab_stats);
	foreach ($rows as $r) {
		foreach ($r as $key => $x) {
			if($key == 'id') continue;
			echo "<td>$x</td>";
		} echo "</tr></table>";
	}
	echo "<table style='margin-top:-10px; margin-bottom:-10px;' class='section abilities'><tr>";
	$abilities = array("passive", "weak", "medium", "strong");
	$y = 0;
	$rows = db_query($ab_abilities);
	foreach ($rows as $r)
		foreach ($abilities as $x)
			ability($x, $y, $ab_id, $r);
	echo "</tr></table>";
	echo "<table class='section'><tr class='numbers'>";
	for($i = 9; $i<18; $i++) echo "<th>{$ICON_LIST[$i]}</th>";
	echo "</tr><tr class='numbers'>";
	$rows = db_query($ab_stats);
	foreach ($rows as $r) {
		foreach ($r as $key => $x) {
			if($key == 'id') continue;
			echo "<td>$x</td>";
		} echo "</tr></table>";
	}
	echo "</th></table>";
}?>

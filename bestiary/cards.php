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
	global $WorkingDir;
	echo "<td style=\"background-image: url('contour.png'), url('{$WorkingDir}creatures/$ab_id/$y.svg'), url('missing.png'); background-size: 100% 100%; width:99px; height:99px;\"></td>";
	$y++;
	echo "<td><u>{$row[$x]}</u><br>{$row["$x info"]}</td></tr>";
}
function cards($id) {
	global $WorkingDir;
	$ab_id = mysql_real_escape_string($id);
	$ab_creatures = "SELECT * FROM ab_creatures WHERE id = '$ab_id'";
	$ab_stats = "SELECT * FROM ab_stats WHERE id = '$ab_id'";
	$ab_abilities = "SELECT * FROM ab_abilities WHERE id = '$ab_id'";
	$ab_masteries = "SELECT * FROM ab_masteries WHERE id = '$ab_id'";
	$result = mysql_query($ab_creatures);
	echo "<table width=860px border=0><th class='card'>"; 
	while ($row = mysql_fetch_assoc($result)) {
		echo "<table class='section'><tr class='beast'><td width='20%'>{$row['sin']}{$row['lvl']}</td><td><a href='#{$row['id']}'>".strtoupper($row['name'])."</a><td width='20%'>{$row['hex']}H</td></tr></table>";
		echo "<a href=\"#grid\"><div class=\"section\" style=\"border: 0px; background:url('{$WorkingDir}creatures/$ab_id/artwork.jpg'); width:400px; height:400px;\"><img src=\"AB.png\" style=\"position:relative; top:365px; left:180px;\"></div></a>";
		echo "<div class='section' style='text-align: center; width: 390px; padding: 5px 0px;'>{$row['description']}</div>";
	} mysql_free_result($result);
	echo "</th><th class='card'><table class='section'><tr class='numbers'><th>" . HEALTH_ICON .
	     "</th><th>" . REGROWTH_ICON . "</th><th>" . FATIGUE_ICON . "</th><th>" . ENERGY_ICON .
	     "</th><th>" . MEDITATION_ICON . "</th><th>" . DELAY_ICON . "</th><th>" . OFFENSE_ICON .
	     "</th><th>" . DEFENSE_ICON . "</th><th>" . MOVEMENT_ICON . "</th></tr><tr class='numbers'>";
	$result = mysql_query($ab_stats);
	while ($row = mysql_fetch_assoc($result)) {
		foreach ($row as $key => $x) {
			if($key == 'id') continue;
			echo "<td>$x</td>";
		} echo "</tr></table>";
	} mysql_free_result($result);
	$result = mysql_query($ab_abilities);
	$y = 0;
	echo "<table style='margin-top:-10px; margin-bottom:-10px;' class='section abilities'><tr>";
	$abilities = array("passive", "weak", "medium", "strong");
	while ($row = mysql_fetch_assoc($result)) foreach ($abilities as $x) ability($x, $y, $ab_id, $row);
	echo "</tr></table>";
	mysql_free_result($result);
	echo "<table class='section'><tr class='numbers'><th>" . PIERCE_ICON .
	     "</th><th>" . SLASH_ICON . "</th><th>" . CRUSH_ICON . "</th><th>" . SHOCK_ICON .
	     "</th><th>" . BURN_ICON . "</th><th>" . FROST_ICON . "</th><th>" . POISON_ICON .
	     "</th><th>" . MENTAL_ICON . "</th><th>" . SONIC_ICON . "</th></tr><tr class='numbers'>";
	$result = mysql_query($ab_masteries);
	while ($row = mysql_fetch_assoc($result)) {
		foreach ($row as $key => $x) {
			if($key == 'id') continue;
			echo "<td>$x</td>";
		} echo "</tr></table>";
	} mysql_free_result($result);
	echo "</th></table>";
}?>

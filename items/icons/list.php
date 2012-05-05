<?php $page_title = "Ancient Beast - Items";
require_once("../ico/script.php");
$style = "
.item {
	text-align: center;
	width: 14%;
	vertical-align: top;
}";
require_once("../header.php");
require_once("../config.php");
echo $start_div;
$items = "SELECT * FROM ab_items ORDER BY type, value";
$result = mysql_query($items) or die(mysql_error());
$stats = array('health', 'regrowth', 'fatigue', 'energy', 'meditation', 'delay', 'offense', 'defense', 'movement');
$masteries = array('pierce', 'slash', 'crush', 'shock', 'burn', 'frost', 'poison', 'mental', 'sonic');
echo "<table width=100% style=\"text-align: center;\">";
while ($row = mysql_fetch_assoc($result)) {
	echo "<tr><td style=\"width: 132px;\"><img src=\"" . $row['name'] . ".png\"><br><b>" . $row['name'] . "</b><br><br></td><td><center><table><tr>";
	echo "<td>" . HEALTH_ICON . "</td>";
	echo "<td>" . REGROWTH_ICON . "</td>";
	echo "<td>" . FATIGUE_ICON . "</td>";
	echo "<td>" . ENERGY_ICON . "</td>";
	echo "<td>" . MEDITATION_ICON . "</td>";
	echo "<td>" . DELAY_ICON . "</td>";
	echo "<td>" . OFFENSE_ICON . "</td>";
	echo "<td>" . DEFENSE_ICON . "</td>";
	echo "<td>" . MOVEMENT_ICON . "</td>";
	echo "</tr><tr>";
	foreach ($stats as $x) echo "<td>" . $row[$x] . "</td>";
	echo "</tr><tr>";
	echo "<td>" . PIERCE_ICON . "</td>";
	echo "<td>" . SLASH_ICON . "</td>";
	echo "<td>" . CRUSH_ICON . "</td>";
	echo "<td>" . SHOCK_ICON . "</td>";
	echo "<td>" . BURN_ICON . "</td>";
	echo "<td>" . FROST_ICON . "</td>";
	echo "<td>" . POISON_ICON . "</td>";
	echo "<td>" . MENTAL_ICON . "</td>";
	echo "<td>" . SONIC_ICON . "</td>";
	echo "</tr><tr>";
	foreach ($masteries as $x) echo "<td>" . $row[$x] . "</td>";
	echo "</tr></table></center></td><td><a href=\"#\"><img src=\"coins.png\"><br><b>x " . $row['value'] . "</b></a></td>";
//	echo "<td><a href=\"#\"><img src=\"gift.png\"><br><b>Gift</b></a></td>";
	echo "<td><a href=\"#\"><img src=\"purchase.png\"><br><b>Purchase</b></a></td></tr>";
}
//not logged; not enough gold (donate and get rewarded?); purchase; owned(purchase as gift for friend?); 
echo "</table>{$end_div}{$the_end}";
mysql_free_result($result); ?>

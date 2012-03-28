<?php
include("../config.php");
include("../ico/index.php");
$details = "SELECT * from ab_items WHERE id='" . $_POST['id'] . "'";
$result = mysql_query($details) or die(mysql_error());
$stats = array('health', 'regrowth', 'fatigue', 'energy', 'meditation', 'delay', 'offense', 'defense', 'inventory');
$masteries = array('pierce', 'slash', 'crush', 'shock', 'burn', 'frost', 'poison', 'mental', 'sonic');
while ($row = mysql_fetch_assoc($result)) {
	echo "<center><table style=\"text-align: center;\"><tr><td><img src=\"" . $row['name'] . ".png\"><br><strong>" . $row['name'] . "</strong></td><td>";
	echo "<table><tr>";
	echo "<td>" . HEALTH_ICON . "</td>";
	echo "<td>" . REGROWTH_ICON . "</td>";
	echo "<td>" . FATIGUE_ICON . "</td>";
	echo "<td>" . ENERGY_ICON . "</td>";
	echo "<td>" . MEDITATION_ICON . "</td>";
	echo "<td>" . DELAY_ICON . "</td>";
	echo "<td>" . OFFENSE_ICON . "</td>";
	echo "<td>" . DEFENSE_ICON . "</td>";
	echo "<td>" . INVENTORY_ICON . "</td>";
	echo "</tr><tr>";
	foreach ($stats as $x)
		echo "<td>" . $row[$x] . "</td>";
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
	foreach ($masteries as $x)
		echo "<td>" . $row[$x] . "</td>";
	echo "</tr></table><br>Worth " . $row['value'] . " <img src=\"../images/coins.png\"></td></tr></table></center>";
}
?>

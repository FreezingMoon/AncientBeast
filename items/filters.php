<?php require_once("../ico/script.php");

$ICON_LIST = array( HEALTH_ICON, REGROWTH_ICON, FATIGUE_ICON, ENERGY_ICON, MEDITATION_ICON, DELAY_ICON, OFFENSE_ICON, DEFENSE_ICON, MOVEMENT_ICON, PIERCE_ICON, SLASH_ICON, CRUSH_ICON, SHOCK_ICON, BURN_ICON, FROST_ICON, POISON_ICON, SONIC_ICON, MENTAL_ICON);

// To see that it prints out all of the values...
echo "<table width=100%><tr>";

for($i = 9; $i<count($ICON_LIST); $i++)
	{echo "<th>" . $ICON_LIST[$i] . "</th>";}
for($i = 0; $i<9; $i++)
	{echo "<th>" . $ICON_LIST[$i] . "</th>";}
echo "</tr></table>";
echo $separator; ?>


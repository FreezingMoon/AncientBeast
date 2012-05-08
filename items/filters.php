<?php require_once("../ico/index.php");
$ICON_LIST = array(HEALTH_ICON, REGROWTH_ICON, FATIGUE_ICON, ENERGY_ICON, MEDITATION_ICON, DELAY_ICON, OFFENSE_ICON, DEFENSE_ICON, MOVEMENT_ICON, PIERCE_ICON, SLASH_ICON, CRUSH_ICON, SHOCK_ICON, BURN_ICON, FROST_ICON, POISON_ICON, SONIC_ICON, MENTAL_ICON);
echo "<table width=100%><tr>";
foreach($ICON_LIST as $x) echo "<th>{$x}</th>";
echo "</tr></table>".$separator; ?>


<?php $page_title = "Ancient Beast - Items";
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
require_once("../config.php");
require_once("../ico/index.php");

$ICON_LIST = array(HEALTH_ICON, REGROWTH_ICON, FATIGUE_ICON, ENERGY_ICON, MEDITATION_ICON, DELAY_ICON, OFFENSE_ICON, DEFENSE_ICON, MOVEMENT_ICON, PIERCE_ICON, SLASH_ICON, CRUSH_ICON, SHOCK_ICON, BURN_ICON, FROST_ICON, POISON_ICON, SONIC_ICON, MENTAL_ICON);
$items = 'SELECT * FROM ab_items ORDER BY type, value';
$result = mysql_query($items) or die(mysql_error());

echo $start_div;
echo "<table width=100%><tr>";
foreach($ICON_LIST as $x) echo "<th>{$x}</th>";
echo "</tr></table>".$separator;

echo '<a name="grid"><table width=100%><tr>';
$i = 0;
while ($row = mysql_fetch_assoc($result)) {
	$i++;
	echo "<td class=\"item\"><span style=\"cursor: pointer;\" class=\"lighten\"><a href=\"#{$row['id']}\">
<img class=\"fix\" src=\"{$WorkingDir}items/icons/{$row['name']}.png\" style=\"display: block;\"><br>{$row['name']}</a></span></td>";
	if (($i % 6) == 0) echo '</tr><tr>';
}
echo '</tr></table></a>'.$end_div;

$result = mysql_query($items) or die(mysql_error());
while ($row = mysql_fetch_assoc($result)) {
	echo $start_div."<table width=100% style='text-align:center;'>";
	echo "<tr><td style=\"width: 132px;\"><a name=\"{$row['id']}\" href=\"#grid\"><img src=\"{$WorkingDir}items/icons/{$row['name']}.png\"></a></td>";
	echo "<td><table width=100% style='font-size:24px; text-align:left;'><tr>";
	echo "<td width=40%><a href='#{$row['id']}'>{$row['name']}</a></td>";
	echo "<td width=20%><a href='#'>{$row['value']}<img src='{$WorkingDir}items/coins.png'></a></td>";
	echo "<td width=20%><a href='#'>Gift<img src='{$WorkingDir}items/gift.png'></a></td>";
	echo "<td width=20%><a href='#'>Purchase<img src='{$WorkingDir}items/purchase.png'></a></td>";
	echo "</tr></table><br><table style='text-align:center;'><tr>";
	for($i = 0; $i<18; $i++) if($row[$stats[$i]]) echo "<th style='padding:4px;'>{$ICON_LIST[$i]}</th>";
	echo "</tr><tr>";
	foreach ($stats as $x) if($row[$x]) echo "<td>{$row[$x]}</td>";
	echo "</tr></table></td></tr></table></a>".$end_div;
}

echo $start_div;
mysql_free_result($result);
include("../utils/disqus.php");
echo $end_div.$the_end; 
?>

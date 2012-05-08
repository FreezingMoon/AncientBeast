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
require_once("../global.php");
require_once("../ico/index.php");

$ICON_LIST = array(HEALTH_ICON, REGROWTH_ICON, FATIGUE_ICON, ENERGY_ICON, MEDITATION_ICON, DELAY_ICON, OFFENSE_ICON, DEFENSE_ICON, MOVEMENT_ICON, PIERCE_ICON, SLASH_ICON, CRUSH_ICON, SHOCK_ICON, BURN_ICON, FROST_ICON, POISON_ICON, SONIC_ICON, MENTAL_ICON);
$items = 'SELECT * FROM ab_items ORDER BY type, value';
$rows = db_query($items);

start_segment();
echo "<table style='width: 100%;'><tr>";
foreach($ICON_LIST as $x) echo "<th>{$x}</th>";
echo "</tr></table>";
separate_segment();

echo '<a id="grid"></a><table style="width: 100%;"><tr>';
$i = 0;
foreach ($rows as $r) {
	$i++;
	echo "<td class=\"item\"><span style=\"cursor: pointer;\" class=\"lighten\"><a href=\"#{$r['id']}\"><img class=\"fix\" src=\"{$site_root}items/icons/" . rawurlencode($r['name']) . ".png\" style=\"display: block;\"><br>{$r['name']}</a></span></td>";
	if (($i % 6) == 0) echo '</tr><tr>';
}
echo "</tr></table></a>";
end_segment();

$rows = db_query($items);
foreach ($rows as $r) {
	start_segment();
	echo "<table style='width: 100%; text-align:center;'>";
	echo "<tr><td style=\"width: 132px;\"><a name=\"{$r['id']}\" href=\"#grid\"><img src=\"{$site_root}items/icons/" . rawurlencode($r['name']) . ".png\"></a></td>";
	echo "<td><table style='width: 100%; font-size:24px; text-align:left;'><tr>";
	echo "<td style='width: 40%;'><a href='#{$r['id']}'>{$r['name']}</a></td>";
	echo "<td style='width: 20%;'><a href='#'>{$r['value']}<img src='{$site_root}items/coins.png'></a></td>";
	echo "<td style='width: 20%;'><a href='#'>Gift<img src='{$site_root}items/gift.png'></a></td>";
	echo "<td style='width: 20%;'><a href='#'>Purchase<img src='{$site_root}items/purchase.png'></a></td>";
	echo "</tr></table><br><table style='text-align:center;'><tr>";
	for($i = 0; $i<18; $i++) if($r[$stats[$i]]) echo "<th style='padding:4px;'>{$ICON_LIST[$i]}</th>";
	echo "</tr><tr>";
	foreach ($stats as $x) if($r[$x]) echo "<td>{$r[$x]}</td>";
	echo "</tr></table></td></tr></table>";
	end_segment();
}

start_segment();
include("../utils/disqus.php");
end_segment();
end_page();
?>

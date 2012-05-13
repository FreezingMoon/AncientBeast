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

//Sorts the arrays by absolute value
function magnitudesort($a, $b)
{
    if ($a == $b) {
        return 0;
    }
    return (abs($a) < abs($b)) ? -1 : 1;
}

//Associated array to link to the array keys of the reordered columns
$ICON_LIST = array('health'=>HEALTH_ICON, 'regrowth'=>REGROWTH_ICON, 'fatigue'=>FATIGUE_ICON, 'energy'=>ENERGY_ICON, 'meditation'=>MEDITATION_ICON, 'delay'=>DELAY_ICON, 'offense'=>OFFENSE_ICON, 'defense'=>DEFENSE_ICON, 'movement'=>MOVEMENT_ICON, 'pierce'=>PIERCE_ICON, 'slash'=>SLASH_ICON, 'crush'=>CRUSH_ICON, 'shock'=>SHOCK_ICON, 'burn'=>BURN_ICON, 'frost'=>FROST_ICON, 'poison'=>POISON_ICON, 'sonic'=>SONIC_ICON, 'mental'=>MENTAL_ICON);

//Get the SQL query order 
function getSQLorder(){
//EXAMPLE: git/AncientBeast/items/index.php?filter=defense
	if($_GET['filter'])
		return "WHERE ".$_GET['filter']." IS NOT NULL ORDER BY ABS(".$_GET['filter'].") DESC";
	else
		return 'ORDER BY type, value DESC';
}

//Query MYSQL
$order = getSQLorder();
$items = 'SELECT id, name, value, type FROM ab_items '.$order;
$rows = db_query($items);
$statquery = 'SELECT '.join(', ', $stats).' FROM ab_items '.$order;
$itemstats = db_query($statquery);

//Sort stats and package items
for($r=0;$r<count($itemstats);$r++){
	uasort($itemstats[$r], "magnitudesort");
	$itemstats[$r] = array_reverse($itemstats[$r]);
	$keys[$r] = array_keys($itemstats[$r]);
	$rows[$r]['stats'] = $itemstats[$r];
	$rows[$r]['keys'] = $keys[$r];
}


//Print filters/icons
start_segment();
echo "<table style='width: 100%;'><tr>";
for($i=0; $i<count($ICON_LIST); $i++) 
	echo "<th><a href='{$site_root}items/index.php?filter={$stats[$i]}'>".$ICON_LIST[$stats[$i]]."</a></th>";
echo "</tr></table>";

separate_segment();

//print the main short list
echo '<a id="grid"></a><table style="width: 100%;"><tr>';
$i = 0;
foreach ($rows as $r) {
	$i++;
	echo "<td class=\"item\"><span style=\"cursor: pointer;\" class=\"lighten\"><a href=\"#{$r['id']}\"><img class=\"fix\" src=\"{$site_root}items/icons/" . rawurlencode($r['name']) . ".png\" style=\"display: block;\"><br>{$r['name']}</a></span></td>";
	if (($i % 6) == 0) echo '</tr><tr>';
}
echo "</tr></table></a>";
end_segment();

//print each item
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

	//ICONS from $rows[$r]['keys']
 	for ($i=0; $i <count($r['keys']); $i++) {
		if($r['stats'][$r['keys'][$i]])
			echo "<th style='padding:4px;'>".$ICON_LIST[$r['keys'][$i]]."</th>";
  }
  echo "</tr><tr>";

	//stats from $rows[$r]['keys']
 	for ($i=0; $i <count($r['stats']); $i++) {
		if($r['stats'][$r['keys'][$i]])
			echo "<td>".$r['stats'][$r['keys'][$i]]."</td>";
  }

	echo "</tr></table></td></tr></table>";
	end_segment();
}

start_segment();
include("../utils/disqus.php");
end_segment();
end_page();
?>

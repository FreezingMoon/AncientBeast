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

start_segment(); ?>
<table style='width: 100%;'><tr><?php
foreach($ICON_LIST as $x)
	echo "<th>{$x}</th>"; ?>
</tr></table><?php
separate_segment(); ?>

<a id="grid"></a>
<table style="width: 100%;">
<tr>
<?php
$i = 0;
foreach ($rows as $r) {
	$i++; ?>
	<td class="item">
		<span style="cursor: pointer;" class="lighten">
		<a href="#<?php echo $r['id']; ?>"><img class="fix" src="<?php echo "{$site_root}items/icons/" . rawurlencode($r['name']) . ".png"; ?>" style="display: block;"><br><?php echo $r['name'];?></a>
		</span>
	</td><?php
	if (($i % 6) == 0 && $i != count($rows)) echo "</tr><tr>";
} ?>
</tr>
</table><?php
end_segment();

$rows = db_query($items);
foreach ($rows as $r) {
	start_segment(); ?>
	<table style="width: 100%; text-align:center;">
	<tr><td style="width: 132px;"><a name="<?php echo $r['id']; ?>" href="#grid"><img src="<?php echo "{$site_root}items/icons/" . rawurlencode($r['name']) . ".png"; ?>"></a></td>
	<td><table style="width: 100%; font-size:24px; text-align:left;">
	<tr>
	<td style="width: 40%;"><a href="#<?php echo $r['id']; ?>"><?php echo $r['name']; ?></a></td>
	<td style="width: 20%;"><a href="#"><?php echo $r['value']; ?><img src="<?php echo "{$site_root}items/coins.png"; ?>"></a></td>
	<td style="width: 20%;"><a href="#">Gift<img src="<?php echo "{$site_root}items/gift.png"; ?>"></a></td>
	<td style="width: 20%;"><a href="#">Purchase<img src="<?php echo "{$site_root}items/purchase.png" ?>"></a></td>
	</tr>
	</table><br>
	<table style="text-align:center;">
	<tr><?php
	for($i = 0; $i<18; $i++)
		if($r[$stats[$i]])
			echo "<th style='padding:4px;'>{$ICON_LIST[$i]}</th>"; ?>
	</tr>
	<tr><?php
	foreach ($stats as $x) if($r[$x]) echo "<td>{$r[$x]}</td>"; ?>
	</tr>
	</table>
	</tr>
	</table><?php
	end_segment();
}

start_segment();
include("../utils/disqus.php");
end_segment();
end_page();
?>

<?php
$stats = array("health","regrowth","endurance","energy","meditation","initiative","offense","defense","movement","pierce","slash","crush","shock","burn","frost","poison","sonic","mental");

foreach ($stats as $key => $x) {
	$stats[$x] = '<img src="../images/stats/' . $x . '.png" class="icon" title="' . ucfirst($x) . '" onMouseOver="swap(this,\'mouseover_' . $x . '\')" onMouseOut="swap(this,\'normal_' . $x . '\')">'."\n";
	define(strtoupper($x) . '_ICON', $stats[$x]);
	unset($stats[$key]);
}

// Shows iconUsed by units/cards.php
function displayStat($type = "health", $value = null, $modifiers = false) {
	global $stats;
	echo '<div stat="' . $type . '" class="stat ' . $type . '">';
	echo '<div class="icon ' . $type . '"></div>';
	if($value !== null) echo '<br><span class="value">' . $value . '</span>';
	if($modifiers) echo '<div class="modifiers"><div>No active modifiers</div></div>';
	echo '</div>';
}
?>
<style type="text/css">
.icon { height: 32px; width: 32px; display: inline-block; }
.stat { text-align: center; display: table-cell; vertical-align: middle; }

<?php 
foreach ($stats as $key => $value) {
	echo '
	.icon.' . $key . ', .' . $key . ' .icon {background-image: url("' . $site_root . 'images/stats/' . $key . '.png");}'
	.'.icon.' . $key . ':hover, .' . $key . ':hover .icon {background-image: url("' . $site_root . 'images/stats/' . $key . '.gif");}
	';
}
?>
</style>

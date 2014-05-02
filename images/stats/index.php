<?php
//TODO: find out what the crap bellow does
function indexOf($needle, $haystack) {
    for($i = 0, $z = count($haystack); $i < $z; $i++){
            if ($haystack[$i] == $needle) {  //finds the needle
                    return $i;
            }
    }
    return false;
}

$stats = array("health","regrowth","endurance","energy","meditation","initiative","offense","defense","movement","pierce","slash","crush","shock","burn","frost","poison","sonic","mental");

foreach ($stats as $key => $x) {
	//foreach ($x as $v) $stats[$key] = $v;
	$stats[$stats[$key]] = '<img src="../images/stats/' . $stats[$key] . '.png" height="32" width="32" title="' . ucfirst($stats[$key]) . '" onMouseOver="swap(this,\'mouseover_' . $stats[$key] . '\')" onMouseOut="swap(this,\'normal_' . $stats[$key] . '\')">'."\n";
	define(strtoupper($stats[$key]) . '_ICON', $stats[$stats[$key]]);
	unset($stats[$key]);
}

function displayStat($type = "health", $value = 0, $link = "", $disp_info = false){
	global $stats;
	$index = indexOf($type,$stats);

	echo '<td stat="' . $type . '" class="stats ' . $type . '">';
	if($link != "") echo '<a href="' . $link . '">';
	echo '<div class="icon"></div><div class="value">' . $value . '</div>';
	if($link != "") echo '</a>';
	if($disp_info) echo '<div class="stats_infos"><div class="textcenter">This stat doesn\'t have any modifiers</div></div>';
	echo '</td>';
}
?>
<style type="text/css">
.icon{
	height: 32px;
	width: 32px;
	display: inline-block;
}

.small.icon{
	height: 22px;
	width: 22px;
	display: inline-block;
	background-size: 100% 100%;
}

.stats{ text-align: center;}

<?php 
foreach ($stats as $key => $value) {
	echo "
	.icon." .$key. ",." .$key. " .icon{ background-image: url('" .$site_root. "images/stats/" .$key. ".png'); }
	.icon." .$key. ":hover,." .$key. ":hover .icon{ background-image: url('" .$site_root. "images/stats/" .$key. ".gif'); }
	";
}
?>
</style>

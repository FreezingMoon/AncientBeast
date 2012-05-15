<?php
$stats = db_query("SELECT column_name FROM information_schema.columns WHERE table_name = 'ab_stats' AND column_name != 'id'");
foreach ($stats as $key => $x) {
	foreach ($x as $v) $stats[$key] = $v;
	$stats[$stats[$key]] = '<img src="../stats/' . $stats[$key] . '.png" title="' . ucfirst($stats[$key]) . '" onMouseOver="swap(this,\'mouseover_' . $stats[$key] . '\')" onMouseOut="swap(this,\'normal_' . $stats[$key] . '\')">'."\n";
	define(strtoupper($stats[$key]) . '_ICON', $stats[$stats[$key]]);
	unset($stats[$key]);
}

$counter = 0; //make it so $stats[0] = 'health'
foreach ($stats as $x) {
	$stats2[$counter] = $x;
	$counter++;
}

?>
<!--roll over image script-->
<script type="application/javascript">
var icons = new Array(
	"<?php echo implode(array_keys($stats), "\",\n\t\""); ?>"
);
for(var x in icons) {
	window["normal_" + icons[x]] = '../stats/' + icons[x] + '.png';
	window["mouseover_" + icons[x]] = '../stats/' + icons[x] + '.gif';
}
function swap(element, image) {$(element).attr('src', window[image]);} </script>

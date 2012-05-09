<?php
$stats = db_query("SELECT column_name FROM information_schema.columns WHERE table_name = 'ab_stats' AND column_name != 'id'");
foreach ($stats as $key => $x) {
	foreach ($x as $v) $stats[$key] = $v;
	define(strtoupper($stats[$key]) . '_ICON', '<img src="../ico/' . $stats[$key] . '.png" title="' . ucfirst($stats[$key]) . '" onMouseOver="swap(this,\'mouseover_' . $stats[$key] . '\')" onMouseOut="swap(this,\'normal_' . $stats[$key] . '\')">'."\n");
} ?>
<!--roll over image script-->
<script type="application/javascript">
var icons = new Array("<?php echo implode($stats, "\", \""); ?>");
for(var x in icons) {
	window["normal_" + icons[x]] = '../ico/' + icons[x] + '.png';
	window["mouseover_" + icons[x]] = '../ico/' + icons[x] + '.gif';
}
function swap(element, image) {$(element).attr('src', window[image]);} </script>

<?php
$stats = db_query("SELECT column_name FROM information_schema.columns WHERE table_name = 'ab_stats' AND column_name != 'id'");
foreach ($stats as $k => $s)
	foreach ($s as $v)
		$stats[$k] = $v;

foreach ($stats as $x) define(strtoupper($x) . '_ICON', '<img src="../ico/'.$x.'.png" title="'.ucfirst($x).'" onMouseOver="swap(this,\'mouseover_'.$x.'\')" onMouseOut="swap(this,\'normal_'.$x.'\')">'."\n"); ?>
<!--roll over image script-->
<script type="text/javascript">
var icons = new Array("<?php echo implode($stats, "\", \""); ?>");
for(var x in icons) {
	window["normal_" + icons[x]] = '../ico/' + icons[x] + '.png';
	window["mouseover_" + icons[x]] = '../ico/' + icons[x] + '.gif';
}
function swap(element, image) {$(element).attr('src', window[image]);} </script>

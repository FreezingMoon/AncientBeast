<?php
$icons = array('health','regrowth','fatigue','energy','meditation','delay','offense','defense','inventory','pierce','slash','crush','shock','burn','frost','poison','mental','sonic');

foreach ($icons as $x)
	define(strtoupper($x) . '_ICON', '<img src="../ico/'.$x.'.png" title="' . ucfirst($x) . '" id="' . $x . '" onMouseOver="swap(\'' . $x . '\',\'mouseover_' . $x . '\')" onMouseOut="swap(\'' . $x . '\',\'normal_' . $x . '\')">'."\n");
?>


<!--roll over image script-->
<script type="text/javascript">
var icons = new Array("<? echo implode($icons, "\", \""); ?>");
for(var x in icons) {
    window["normal_" + icons[x]] = '../ico/' + icons[x] + '.png';
    window["mouseover_" + icons[x]] = '../ico/' + icons[x] + '.gif';
}

function swap(element, image) {
	$('#' + element).attr('src', window[image]);
}
</script>

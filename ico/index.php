<?php
$icons = array('health','regrowth','fatigue','energy','meditation','delay','offense','defense','inventory','pierce','slash','crush','shock','burn','frost','poison','mental','sonic');

foreach ($icons as $x)
	define(strtoupper($x) . '_ICON', '<img src="../ico/'.$x.'.png" title="' . ucfirst($x) . '" onMouseOver="swap(this,\'mouseover_' . $x . '\')" onMouseOut="swap(this,\'normal_' . $x . '\')">'."\n");
?>

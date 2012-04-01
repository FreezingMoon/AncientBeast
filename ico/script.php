<?php
require_once(dirname(__FILE__) . "/index.php");
?>

<!--roll over image script-->
<script type="text/javascript">
var icons = new Array("<?php echo implode($icons, "\", \""); ?>");
for(var x in icons) {
	window["normal_" + icons[x]] = '../ico/' + icons[x] + '.png';
	window["mouseover_" + icons[x]] = '../ico/' + icons[x] + '.gif';
}

function swap(element, image) {
	$(element).attr('src', window[image]);
}
</script>

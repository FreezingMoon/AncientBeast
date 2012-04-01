<?php $page_title = "Ancient Beast - Bestiary";
require_once("../header.php");
require_once("../config.php");
require_once("../ico/script.php");
?>
<script type="text/javascript" src="<?php echo $WorkingDir; ?>utils/tinybox.js"></script>
<!--show details of the linked item-->
<script type="text/javascript">
var basePage = window.location.href.replace( /#.*/, "");
function showId(id) {
	TINY.box.show({url:'details.php',post:'id='+id,width:880,height:650,topsplit:2,close:true,callback:function(b){
		$(b).click(function() {
			history.replaceState("", "", basePage);
		});
	}});
	history.replaceState("", "", basePage + "#id=" + id);
}
window.onload = function() {
	if (/[\#&]id=(\d+)/.test(location.hash)) {
		var id = parseInt(RegExp.$1);
		showId(id);
	}
}
</script>

<?php
echo
"$start_div
<div style='text-align:center; margin-left:-6px;'>";
$creatures = "SELECT * FROM ab_creatures ORDER BY sin, lvl";
$result = mysql_query($creatures) or die(mysql_error());
while ($row = mysql_fetch_assoc($result)) {
	echo "
<div class=\"lighten\" style=\"background:url('{$WorkingDir}creatures/{$row["id"]}/avatar.jpg'); background-size: 100%; display: inline-block; margin-bottom:-3px; cursor: pointer;\" onclick=\"showId({$row['id']});\">
	<img style=\"display: block;\" src=\"{$WorkingDir}bestiary/frame.png\" alt=\"frame\">
</div>";
}
mysql_free_result($result);
echo "
</div>{$end_div}{$the_end}"; ?>

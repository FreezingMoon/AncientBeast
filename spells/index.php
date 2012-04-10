<?php $page_title = "Ancient Beast - Spells";
require_once("../header.php");
require_once("../config.php");
?>
<script type="text/javascript" src="<?php echo $WorkingDir; ?>utils/tinybox.js"></script>
<?php
echo "$start_div<div style='text-align:center; margin-left:-6px;'>";
$spells = "SELECT * FROM ab_spells";
$result = mysql_query($spells) or die(mysql_error());
while ($row = mysql_fetch_assoc($result)) {
	echo "<div style=\"display: inline-block;\" onclick=\"showId({$row['id']});\">
	<span style=\"cursor: pointer;\" class=\"lighten\"><img style=\"display: block; width:128px; height:128px;\" src=\"icons/{$row['id']}.svg\"></span>
</div>";
}
?>

<!--show details of the linked item-->
<script type="text/javascript">
var basePage = window.location.href.replace( /#.*/, "");
function showId(id) {
	TINY.box.show({url:'details.php',post:'id='+id,width:440,height:550,topsplit:2,close:true,callback:function(b){
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
mysql_free_result($result);
echo "
</div>{$end_div}{$the_end}"; ?>

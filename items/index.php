<?php
$page_title = "Ancient Beast - Items";
$style = "
.smaller {
	width: 115px;
	height: 115px;
	margin-bottom: -15px;
}
.item {
	text-align: center;
	width: 14%;
	vertical-align: top;
}";
include("../header.php");
include("../config.php");
echo $start_div;
include("filters.php");
?>
<script type="text/javascript" src="<?php echo $WorkingDir; ?>utils/tinybox.js"></script>
<!--show details of the linked item-->
<script type="text/javascript">
var basePage = window.location.href.replace( /#.*/, "");
function showId(id) {
	TINY.box.show({url:'details.php',post:'id='+id,width:500,height:180,topsplit:4,close:true,mask:false,callback:function(b){
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

$items = "SELECT * FROM ab_items ORDER BY type, value";
$result = mysql_query($items) or die(mysql_error());

echo "<table width=100%><tr>";
$i = 0;
while ($row = mysql_fetch_assoc($result)) {
	$i++;
	$location = "location.href= 'http://www.AncientBeast.com/items'";
	echo "<td class=\"item\"><span style=\"cursor: pointer;\" class=\"lighten\" onclick=\"showId(" . $row['id'] . ");\"><img class=\"smaller\" src=\"" . $row['name'] . ".png\" style=\"display: block;\"><br>" . $row['name'] . "</span></td>";
	//make new table rows
	if (($i % 7) == 0)
		echo "</tr><tr>";
}
//TODO: arrange icons on incomplete rows nicely
echo "</tr></table>";
mysql_free_result($result);
echo $end_div . $the_end; ?>
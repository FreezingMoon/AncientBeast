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
include("../connect.php");
echo $start_div;
include("filters.php");
?>
<script type="text/javascript" src="/utils/tinybox.js"></script>
<?php

$items = "SELECT * from ab_items ORDER BY type, value";
$result = mysql_query($items) or die(mysql_error());

echo "<table width=100%><tr>";
while ($row = mysql_fetch_assoc($result)) {
	$i++;
	$location = "location.href= 'http://www.AncientBeast.com/items'";
	echo "<td class=\"item\"><a href=\"#id=" . $row['id'] . "\" class=\"lighten\" onclick=\"TINY.box.show({url:'detail.php',post:'id=" . $row['id'] . "',width:500,height:180,topsplit:4,close:true,mask:false});\"><img src=\"" . $row['name'] . ".png\" class=\"smaller lighten\"><br>" . $row['name'] . "</a></td>";
	//make new table rows
	if (($i % 7) == 0)
		echo "</tr><tr>";
}
//TODO: arrange icons on incomplete rows nicely
echo "</tr></table>"; ?>

<!--show details of the linked item-->
<script type="text/javascript">
window.onload = function() {
    if (/[\#&]id=(\d+)/.test(location.hash)) {
        var id = parseInt(RegExp.$1);
	TINY.box.show({url:'detail.php',post:'id='+id,width:500,height:180,topsplit:4,close:true,mask:false});
    }
}
</script>

<?
mysql_free_result($result);
echo $end_div . $the_end; ?>

<?php $page_title = "Ancient Beast - Bestiary";
include("../header.php");
include("../global.php");
?>
<script type="text/javascript" src="<?php echo $WorkingDir; ?>utils/tinybox.js"></script>
<?php
echo "$start_div<div style='text-align:center; margin-left:-6px;'>";
$creatures = "SELECT * FROM ab_creatures ORDER BY sin, lvl";
$result = mysql_query($creatures) or die(mysql_error());
while ($row = mysql_fetch_assoc($result)) {
	echo "<div style=\"background:url('" . $WorkingDir . "creatures/" . $row["id"] . "/avatar.jpg'); background-size: 100%; display: inline-block; margin-bottom:-3px;\" onclick=\"TINY.box.show({url:'details.php',post:'id=" . $row['id'] . "',width:880,height:650,topsplit:2,close:true});\"><a href=\"#id=" . $row['id'] . "\" class=\"lighten\"><img class=\"img lighten\" src=\"frame.png\"></a></div>";
}
echo "</div>$end_div" . $the_end; ?>

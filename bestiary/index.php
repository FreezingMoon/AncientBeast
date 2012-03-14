<?php $page_title = "Ancient Beast - Bestiary";
include("../header.php");
include("../global.php");
?>
<script type="text/javascript" src="<?php echo $WorkingDir; ?>utils/tinybox.js"></script>
<?php
echo "$start_div<div style='text-align:center; position:absolute;'>";
$creatures = "SELECT * FROM ab_creatures ORDER BY sin";
$result = mysql_query($creatures) or die(mysql_error());
$i = 0;
while ($row = mysql_fetch_assoc($result)) {
	foreach(range(1, 7) as $x) {
			if ($row['lvl'] == $x) echo "<div style=\"background:url('" . $WorkingDir . "creatures/" . $row["id"] . "/avatar.jpg'); background-size: 100%; display: inline-block;\" onclick=\"TINY.box.show({url:'details.php',post:'id=" . $row['id'] . "',width:880,height:650,topsplit:2,close:true});\"><a href=\"#id=" . $row['id'] . "\" class=\"lighten\"><img class=\"img lighten\" src=\"frame.png\"></a></div>";
			else echo "<div style=\"display: inline-block;\"><img class=\"img lighten\" src=\"frame.png\"></a></div>";
	}
	$i++;
	if ($i % 7) echo "<br>";
}
echo "</div><div style='height:915px;'></div><center>";
//TODO: rename folders from "creature" directory from id to creature names
echo "</center>$end_div" . $the_end; ?>

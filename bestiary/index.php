<?php $page_title = "Ancient Beast - Bestiary";
require_once("../header.php");
require_once("../config.php");
require_once("../ico/index.php");
require_once("cards.php");
require_once("progress/index.php");
?>
<script type="text/javascript" src="<?php echo $WorkingDir; ?>utils/tinybox.js"></script>
<?php
echo "$start_div<div style='text-align:center; margin-left:-6px;'><a name='grid'>";
$creatures = "SELECT * FROM ab_creatures ORDER BY sin, lvl";
$result = mysql_query($creatures) or die(mysql_error());
while ($row = mysql_fetch_assoc($result)) {
	echo "<div class=\"lighten\" style=\"background:url('{$WorkingDir}creatures/{$row["id"]}/avatar.jpg'); background-size: 100%; display: inline-block; margin-bottom:-3px; cursor: pointer;\"><a href=\"#{$row["id"]}\"><img style=\"display: block;\" src=\"{$WorkingDir}bestiary/frame.png\" alt=\"frame\"></a></div>";
}
echo "</a></div>{$end_div}";
$result = mysql_query($creatures) or die(mysql_error());
while ($row = mysql_fetch_assoc($result)) {
	echo "$start_div<center><a name=\"{$row["id"]}\">";
	cards($row["id"]);
	progress($row["id"]);
	echo "</a></center>$end_div";
}
mysql_free_result($result);
echo $start_div;
include("../utils/disqus.php");
echo $end_div.$the_end; ?>

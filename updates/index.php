<?
include("../header.php");
include("../connect.php");
include_once("../utils/time_ago.php");
$updates = "SELECT * from ab_updates ORDER BY id DESC";
$result = mysql_query($updates) or die(mysql_error());
echo $start_div . "<table style='text-align: center; border:2px solid grey;' width=100%>";
$i = 0;
while ($row = mysql_fetch_assoc($result)) {
	if ($i % 2 == 0) {
		echo "<tr class='even highlight'>";
	}
	else {
		echo "<tr class='odd highlight'>";
	}
	echo "<td style='text-align:right; cursor:help;' title='Update #" . $row['id'] . "'>" . time_ago($row['added']) . "</td>";
	echo "<td style='width:10px; cursor:default;'>※</td>";
	echo "<td style='text-align:left; cursor:default;'>" . $row['change'] . "</a></td>";
	echo "</tr>";
	$i++;
}
mysql_free_result($result);
echo "</table>" . $end_div . $the_end;
?>

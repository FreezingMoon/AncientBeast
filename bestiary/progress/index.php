<? $ab_progress = "SELECT * FROM ab_progress WHERE id = $ab_id";
$result = mysql_query($ab_progress);
while ($row = mysql_fetch_assoc($result)) {
	$sum = array_sum($row);
	$total = ($sum - $row['id']) / 10;
	$rounded_total = 10 * round ($total/10) ;
	echo "<div style='width:825px; background-image:url(progress/widget.png);'>";
	foreach($row as $key => $value) { 
		if($key == 'id') continue;
		$title = ucfirst($key) . ": $value% complete";
		echo "<img src='progress/$value.png' title='$title'>";
	} echo "<img src='progress/$rounded_total.png' title='Total: $total% completed' border=0></div>";
} mysql_free_result($result); ?>

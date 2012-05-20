<?php
function progress($id) {
	$ab_id = mysql_real_escape_string($id);
	$ab_progress = "SELECT * FROM ab_progress WHERE id = '$ab_id'";
	$rows = db_query($ab_progress);
	foreach ($rows as $r) {
		$sum = array_sum($r);
		$total = ($sum - $r['id']) / 10;
		$rounded_total = 10 * round ($total/10) ;
		echo "<div style='width:825px; background-image:url(progress.png);'>";
		foreach($r as $key => $value) { 
			if($key == 'id') continue;
			$title = ucfirst($key) . ": $value% complete";
			echo "<img src='$value.png' title='$title'>";
		} echo "<img src='$rounded_total.png' title='Total: $total% completed'></div>";
	}
} ?>

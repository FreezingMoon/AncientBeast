<?php

function get_creatures(){
	$progress_json = json_decode(file_get_contents('../data/progress.json'), true);
	$creature_json = json_decode(file_get_contents('../data/creatures.json'), true);
	$creature_results = array();
	$i = 0;
	foreach($creature_json as &$creature){
		$creature["progress"] = $progress_json[$i];
		$creature_results[$creature["type"]] = $creature;
		$i++;
	}
	ksort($creature_results);
	return $creature_results;
}

function get_stats(){
	$creature_json = json_decode(file_get_contents('../data/creatures.json'), true);
	$stats_results = array();
	$i = 0;
	foreach($creature_json as &$creature){
		$stats_results[$i] = $creature["stats"];
		$i++;
	}
	return $stats_results;
}

function progress($r,$c) {
		$sum = 0;
		$spaceless = str_replace(' ', '%20', $c['name'] );
		echo "

		<div class='center' style='width:825px; background-image:url(../images/progress/widget.png); background-repeat:no-repeat;'>
		<a href='http://www.wuala.com/AncientBeast/bestiary/" . $spaceless . "' target='_blank'>";
		$i = 0;
		foreach($r as $key => $value) {
			if($i++ < 1) continue; //Ignore other keys
			$sum += $value;
			$title = ucfirst($key) . ": $value% complete";
			echo "<img src='../images/progress/$value.png' height='75' width='75' title='$title' alt='$title'>";
		}
		$total = $sum / 10;
		$rounded_total = 10 * round ($total/10) ;
		echo "<img src='../images/progress/$rounded_total.png' height='75' width='75' title='Total: $total% completed' alt='$rounded_total'>
	</a>
</div>";

}

?>

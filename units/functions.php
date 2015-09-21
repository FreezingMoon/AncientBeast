<?php
// Fetches all the unit data along with their progress status
function get_creatures() {
	$progress_json = json_decode(file_get_contents('../units/progress.json'), true);
	$creature_json = json_decode(file_get_contents('../units/data.json'), true);
	$creature_results = [];
	$i = 0;
	foreach($creature_json as &$creature) {
		$creature["progress"] = $progress_json[$i];
		$creature_results[$creature["type"]] = $creature;
		$i++;
	}
	ksort($creature_results);
	return $creature_results;
}

// Fetches all the unit stats
function get_stats() {
	$creature_json = json_decode(file_get_contents('../units/data.json'), true);
	$stats_results = [];
	$i = 0;
	foreach($creature_json as &$creature) {
		$stats_results[$i] = $creature["stats"];
		$i++;
	}
	return $stats_results;
}

// Creates the progress status graphic for a specific unit
function progress($category, $unit) {
	$sum = 0;
	$i = 0;
	echo '<div class="center progress-widget"><a href="https://mega.co.nz/#F!DYYxzIRa!FKOq62BWn1TpAUw9gKL0YQ" target="_blank">';
	foreach($category as $key => $value) {
		if ($i++ < 1) continue;
		$sum += $value;
		$title = ucfirst($key) . ': '. $value . '% complete';
		echo '<div class="progress-' . round($value) . ' common-values" title="' . $title . '"></div>';
	}
	$total = $sum / 10;
	$rounded_total = 10 * round($total/10);
	echo '<div class="progress-' . $rounded_total . ' common-values" title="Total: ' . $total . '% completed"></div></a></div>';
}
?>

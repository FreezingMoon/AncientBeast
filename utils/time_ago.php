<?php
function time_ago($date, $granularity=1) {
	$date = strtotime($date);
	$difference = time() - $date;
	$periods = array(
		'decade' => 315360000,
		'year' => 31536000,
		'month' => 2628000,
		'week' => 604800, 
		'day' => 86400,
		'hour' => 3600,
		'minute' => 60,
		'second' => 1);
	if ($difference < 5) { // less than 5 seconds ago, let's say "just now"
		$retval = "just now";
	return $retval;
	} else {                            
		foreach ($periods as $key => $value) {
			if ($difference >= $value) {
				$time = floor($difference/$value);
				$difference %= $value;
				$retval .= ($retval ? ' ' : '').$time.' ';
				$retval .= (($time > 1) ? $key.'s' : $key);
				$granularity--;
           		 }
		if ($granularity == '0') { break; }
		}
	return $retval . ' ago';      
	}
}
?>

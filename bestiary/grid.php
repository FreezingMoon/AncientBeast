<?php

function creatureGrid($creature_results=false,$locked=true)
{
	$locked = ($locked)? "locked" : "" ;

	//If result is empty do a query
	if( $creature_results == false ){
		$creatures = 'SELECT * FROM ab_creatures ORDER BY sin, lvl';
		$creature_results = db_query($creatures);
	}
	
	echo '<div id="creaturegrid">';

	foreach ($creature_results as $r) {
		if ($r['id'] == 0 || $r['id'] == 50) { //Ignore Darkpreist and shadow leech
			continue;
		}
		$spaceless = str_replace(' ', '_', $r['name']);
		echo '<a href="#'.$spaceless.'" title="'.$r['name'].'" class="vignette type'.$r['sin'].$r['lvl'].' '.$locked.'" creature="'.$r['sin'].$r['lvl'].'"><div class="overlay"></div><div class="border"></div></a>';
	} 

	echo '</div>';
}

?>
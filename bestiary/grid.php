<?php

function creatureGrid($creature_results=false)
{
	global $site_root; // from global.php
	
	//If result is empty do a query
	if( $creature_results == false ){
		$creatures = 'SELECT * FROM ab_creatures ORDER BY sin, lvl';
		$creature_results = db_query($creatures);
	}
	
echo '<style type="text/css">';

	foreach ($creature_results as $r) {
		if ($r['id'] == 0 ) { continue; } //Ignore Darkpreist
		echo '.vignette.type' .$r['sin'].$r['lvl']. '{background-image: url("' .$site_root. 'bestiary/' .$r["name"]. '/avatar.jpg");}';
	}

	echo '
	.vignette.type--.p0{background-image: url("' .$site_root. 'bestiary/Dark Priest/avatar-red.jpg");}
	.vignette.type--.p1{background-image: url("' .$site_root. 'bestiary/Dark Priest/avatar-blue.jpg");}
	.vignette.type--.p2{background-image: url("' .$site_root. 'bestiary/Dark Priest/avatar-orange.jpg");}
	.vignette.type--.p3{background-image: url("' .$site_root. 'bestiary/Dark Priest/avatar-green.jpg");}';

	echo '</style><div id="creaturegrid">';

	foreach ($creature_results as $r) {
		if ($r['id'] == 0 || $r['id'] == 50) { //Ignore Darkpreist and shadow leech
			continue;
		}
		$spaceless = str_replace(' ', '_', $r['name']);
		echo '<a href="#'.$spaceless.'" title="'.$r['name'].'" class="vignette type'.$r['sin'].$r['lvl'].'" creature="'.$r['sin'].$r['lvl'].'"><div class="overlay"></div><div class="border"></div></a>';
	} 

	echo '</div>';
}

?>
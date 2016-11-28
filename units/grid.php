<?php
function creatureGrid($creature_results = false) {
	global $site_root; // From config.php
	
	// If result is empty do a query
	if ($creature_results == false) {
		$creature_results = get_creatures();
	}
	
echo '<style type="text/css">';
	//TODO: Parse units in a better way, using set/realm/level data.json variables
	foreach ($creature_results as $r) {
		if ($r['id'] == 0 ) { continue; } // Ignore Dark Priest
		echo '.vignette.type' . $r['realm'] . $r['level'] . '{ background-image: url("' . $site_root . 'game/deploy/units/avatars/' . $r["name"] . '.jpg"); }';
	}

	echo '</style><div id="creaturegrid">';

	foreach ($creature_results as $r) {
		if ($r['id'] == 0 || $r['id'] == 50) { // Ignore Dark Priest and Shadow Leech
			continue;
		}
		$underscore = str_replace(' ', '_', $r['name']);
		echo '<a href="#' . $underscore . '" class="vignette realm' . $r['realm'] . ' type' . $r['realm'] . $r['level'] . '" creature="' . $r['realm'] . $r['level'] . '"><div class="tooltip"><div class="content">' . $r['name'] . '</div></div><div class="overlay"></div><div class="border"></div></a>';
	} 
	echo '</div>';
}
?>

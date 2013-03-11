<?php

// Utility
if(!file_exists(dirname(__FILE__) . "/../config.php"))
	die("Warning: config.php not found, please edit config.php.in to point to a database and save it as config.php<br>Disclaimer: Since this project is web based, you can use the code and assets along with database.sql to host Ancient Beast yourself for testing and development purposes only! Also, your version should not be indexable by search engines because that can cause harm to the project!");
require_once("../config.php");

// Database
$db_connection = NULL;
function db_connect() {
	global $db_connection, $db_info;
	if(!is_null($db_connection))
		return false;
	$db_connection = mysql_connect($db_info["host"], $db_info["username"], $db_info["password"]);
	if($db_connection === false) {
		// TODO: redirect/display to static error page
		die("Server connection issues...");
		return false;
	}
	mysql_select_db($db_info["database"]);
	mysql_query("SET NAMES 'utf8'");
	return true;
}
function db_execute($query) {
	global $db_connection;
	if($db_connection === false)
		return false;
	if(is_null($db_connection))
		if(!db_connect())
			return false;

	$r = mysql_query($query);
	if($r === false) return false;
	return true;
}
function db_query($query) {
	global $db_connection;
	if($db_connection === false)
		return false;
	if(is_null($db_connection))
		if(!db_connect())
			return false;

	$r = mysql_query($query);
	if($r === false) return false;
	if(mysql_num_rows($r) > 0) {
		$o = array();
		$i = 0;
		while ($row = @mysql_fetch_assoc($r)) {
			$o[$i] = array();
			foreach($row as $k => $v)
				$o[$i][$k] = $v;
			$i++;
		}
		return $o;
	}
	return true;
}

global $site_root; // from global.php



$ab_creatures = "SELECT * FROM ab_creatures";
$creatures = db_query($ab_creatures);

$ab_stats = "SELECT * FROM ab_stats";
$stats = db_query($ab_stats);

$ab_abilities = "SELECT * FROM ab_abilities";
$abilities = db_query($ab_abilities);

$i = 0;
foreach($creatures as &$creature){
	$creature["realm"] = $creature["sin"];
	unset($creature["sin"]);
	$creature["size"] = $creature["hex"];
	unset($creature["hex"]);
	$creature["type"] = $creature["realm"].$creature["lvl"];
	unset($stats[$i]["id"]);
	$creature["stats"] = $stats[$i];
	$creature["animation"] = array(
		'walk_speed' => "500"
	);
	$r = $abilities[$i];
	$creature["ability_info"] = array(
	array( 'title' => $r["passive"],	'desc' => $r["passive desc"],	'info' => $r["passive info"] ),
	array( 'title' => $r["weak"],		'desc' => $r["weak desc"],	'info' => $r["weak info"] ),
	array( 'title' => $r["medium"],	'desc' => $r["medium desc"],	'info' => $r["medium info"] ),
	array( 'title' => $r["strong"],	'desc' => $r["strong desc"],	'info' => $r["strong info"] )
	);
	$i++;
}

print_r(json_encode($creatures));

?>

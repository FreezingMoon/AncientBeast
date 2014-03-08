<?php
// Utility
if(!file_exists(dirname(__FILE__) . "/config.php"))
	die("Warning: config.php not found, please edit config.php.in to point to a database and save it as config.php<br>Disclaimer: Since this project is web based, you can use the code and assets along with database.sql to host Ancient Beast yourself for testing and development purposes only! Also, your version should not be indexable by search engines because that can cause harm to the project!");
require_once('config.php');

$site_url = 'http://'.$_SERVER['SERVER_NAME'].$site_root;
//sesson starting for login
session_start();
// Page generation
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
function disqus($x="") {
	global $page_title;
	if (!$x) { $x = $page_title; }
	echo "<div class='div'>";
	include('../disqus.php');
	echo "</div>";
}
?>

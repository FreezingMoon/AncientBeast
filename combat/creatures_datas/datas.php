<?php
/* Ancient Beast - Free Open Source Online PvP TBS: card game meets chess, with creatures.
 * Copyright (C) 2007-2012  Valentin Anastase (a.k.a. Dread Knight)
 *
 * This file is part of Ancient Beast.
 *
 * Ancient Beast is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Ancient Beast is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * http://www.AncientBeast.com
 * https://github.com/FreezingMoon/AncientBeast
 * DreadKnight@FreezingMoon.org
 */

// Utility
if(!file_exists(dirname(__FILE__) . "/../config.php"))
	die("Warning: config.php not found, please edit config.php.in to point to a database and save it as config.php<br>Disclaimer: Since this project is web based, you can use the code and assets along with database.sql to host Ancient Beast yourself for testing and development purposes only! Also, your version should not be indexable by search engines because that can cause harm to the project!");
require_once("../../config.php");

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

// $id = ((int)$_GET["id"] == 0)? "--" : (int)$_GET["id"] ;


// $ab_stats = "SELECT * FROM ab_stats WHERE id = '$id'";
// $ab_abilities_results = db_query($ab_abilities);

// print_r($ab_abilities_results);

?>
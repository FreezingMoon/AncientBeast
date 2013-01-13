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

$id = (int)$_GET["id"];

global $site_root; // from global.php

$ab_creatures = "SELECT ab_creatures.*, ab_stats.*, ab_abilities.* FROM ab_creatures
					LEFT JOIN ab_stats ON ab_creatures.id = ab_stats.id
					LEFT JOIN ab_abilities ON ab_creatures.id = ab_abilities.id
					WHERE ab_creatures.id = '$id' ";

$r = db_query($ab_creatures);
$r = $r[0];

$datas = array();

$datas["id"] = (int)$r["id"];
$datas["type"] = $r["sin"].$r["lvl"];
$datas["name"] = $r["name"];
$datas["lvl"] = $r["lvl"];;
$datas["realm"] = $r["sin"];;
$datas["size"] = (int)$r["hex"];
$datas["stats"] = array(
	'health' => (int)$r["health"],
	'regrowth' => (int)$r["regrowth"],
	'endurance' => (int)$r["endurance"],
	'energy' => (int)$r["energy"],
	'meditation' => (int)$r["meditation"],
	'initiative' => (int)$r["initiative"],
	'offense' => (int)$r["offense"],
	'defense' => (int)$r["defense"],
	'movement' => (int)$r["movement"],

	'pierce' => (int)$r["pierce"],
	'slash' => (int)$r["slash"],
	'crush' => (int)$r["crush"],
	'shock' => (int)$r["shock"],
	'burn' => (int)$r["burn"],
	'frost' => (int)$r["frost"],
	'poison' => (int)$r["poison"],
	'sonic' => (int)$r["sonic"],
	'mental' => (int)$r["mental"],);

$datas["abilities_infos"] = array(
	array( 'title' => $r["passive"], 'desc' => $r["passive info"]),
	array( 'title' => $r["weak"],	 'desc' => $r["weak info"]),
	array( 'title' => $r["medium"],	 'desc' => $r["medium info"]),
	array( 'title' => $r["strong"],	 'desc' => $r["strong info"]),
);

print_r(json_encode($datas));
?>

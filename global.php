<?php
/* Ancient Beast - Free Open Source Online PvP TBS: card game meets chess, with creatures.
 * Copyright (C) 2007-2014  Valentin Anastase (a.k.a. Dread Knight)
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

// Display error if no config file available
if(file_exists(dirname(__FILE__) . "/config.php")) require_once('config.php');
else require_once('config.php.in');

$site_url = 'http://' . $_SERVER['SERVER_NAME'] . $site_root;

// Session starting for login
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

// Display Disqus comments
function disqus($x='') {
	global $page_title;
	if (!$x) { $x = $page_title; }
	echo '<div class="div">';
	include('../disqus.php');
	echo '</div>';
}
?>

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
if(!file_exists(dirname(__FILE__) . "/config.php"))
	die("config.php not found, please edit config.php.in and save it as config.php");
require_once("config.php");

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

// Page generation
function start_segment() { ?>
	<div class="div_top"></div>
	<div class="div_center">
<?php
}
function end_segment() { ?>
	</div>
	<div class="div_bottom"></div>
<?php
}
function separate_segment() {
	end_segment();
	start_segment();
}
function end_page() {
	start_segment(); ?>
	<center><table><tr>
	<td><a href="/donate"><img src="<?php echo $site_root; ?>donate/paypal.gif"></a></td>
	<td><a href="bitcoin://1Gpa3NKn8nR9ipXPZbwkjYxqZX3cmz7q97"><img src="<?php echo $site_root; ?>donate/Bitcoin.png"></a></td>
	<td><a class="FlattrButton" style="display:none; margin-top:4px;" href="http://www.AncientBeast.com"></a></td>
	<td><p style="width:100%"></p></td>
	<td><a href="http://www.FreezingMoon.org" target="_blank"><img src="http://www.FreezingMoon.org/images/FreezingMoon.png" style="width:420px;"></a></td>
	<td><p style="width:100%"></p></td>
	<td><a href="http://www.facebook.com/AncientBeast" target="_blank" class="lighten"><img src="<?php echo $site_root; ?>images/facebook.png" class="lighten"></a></td>
	<td><a href="http://twitter.com/AncientBeast" target="_blank" class="lighten"><img src="<?php echo $site_root; ?>images/twitter.png" class="lighten"></a></td>
	<td><a href="http://feeds.feedburner.com/AncientBeast" target="_blank" class="lighten"><img src="<?php echo $site_root; ?>images/rss.png" class="lighten"></a></td>
	</tr></table></center>
	<?php end_segment(); ?>
	</div>
	</body>
	</html>
<?php
}
?>

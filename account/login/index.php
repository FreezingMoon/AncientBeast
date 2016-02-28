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
 * https://www.AncientBeast.com
 * https://github.com/FreezingMoon/AncientBeast
 * DreadKnight@FreezingMoon.org
 */

$page_title = "Login";
$style = '
.arranged { padding-right: 20px; float: right; }
.div td { padding-bottom: 15px; }
';
require_once('../../header.php');

if(isset($_POST['submit']) && $_POST['submit'] != "") {
	$username = $_POST["username"];
	$password = sha1($_POST["password"]);

	$result = mysqli_query($link, "SELECT * FROM `ab_users` WHERE `username`='$username'") or die ("<div class='warning center'>Name and password not found or not matched.</div>");
	$worked = mysqli_fetch_array($result);

	if($worked['password'] == $password) {
    	$_SESSION["id"] = $worked['id'];
		echo '<meta http-equiv="refresh" content="0; url=' . $site_url . 'account">';
		die();
	} else {
		echo "<div class='warning center'>Your username and password combination are invalid.</div>";
	}
}

// WIP Feature
$wip = 'onClick="alert(\'Please bear with us while we implement this feature!\');"	';
?>

<!-- Hightlight active page -->
<script>document.getElementById("<?php echo $page_title; ?>").className += " active";</script>

<div class="center warning">The user account system is currently in alpha stage, so it's very problematic and not required to play the game.</div>

<div class="center" id="options">
	<div style="display: inline-block;" class="lighten">
		<a href="<?php echo $site_root; ?>account/register"><div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Register New Account</div></a>
	</div>
	<div style="display: inline-block;" class="lighten">
		<a href="#" <?php echo $wip; ?>><div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Recover Your Password</div></a>
	</div>
	<div style="display: inline-block;" class="lighten">
		<a href="#" <?php echo $wip; ?>><div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png); ;">Recall Your Username</div></a>
	</div>
</div>

<div class="div center">
<img src="gumble.png" style="display: inline-block; float: left;">
<div style="display: inline-block;">
<form name="login" method="post" action="index.php">
<table width="25%" border=0 align=center cellpadding=0 cellspacing=0>
	<tr>
		<td class="arranged">Username</td>
		<td><input name="username" type="text" size=22 autofocus></td>
	</tr>
	<tr>
		<td class="arranged">Password</td>
		<td><input name="password" type="password" size=22></td>
	</tr>
</table>
<input type="submit" name="submit" value="Log Into Your Account" class="button">
</form>

<a href="#" <?php echo $wip; ?>><img src="<?php echo $site_root; ?>account/facebook.png" class="lighten"></a>
<a href="#" <?php echo $wip; ?>><img src="<?php echo $site_root; ?>account/google.png" class="lighten"></a>
<a href="#" <?php echo $wip; ?>><img src="<?php echo $site_root; ?>account/twitter.png" class="lighten"></a>
</div>
<img src="snowbunny.png" style="display: inline-block; float: right;">
</div>

<?php include('../../footer.php'); ?>

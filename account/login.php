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

$page_title = "Ancient Beast - Login";
require_once('../header.php');

if(isset($_POST['submit']) && $_POST['submit'] != ""){
	$username = $_POST["username"];
	$password = sha1($_POST["password"]);

	$result = mysql_query("SELECT * FROM `ab_users` WHERE `username`='$username'") or die ("<div class='div center'>Name and password not found or not matched.</div>");
	$worked = mysql_fetch_array($result);

	if($worked['password'] == $password) {
    	$_SESSION["id"] = $worked['id'];
		echo '<meta http-equiv="refresh" content="0; url=' . $site_url . '">';
		die();
	} else {
		echo "<div class='div center'>Sorry, your username and password combination are invalid.</div>";
	}
}
?>

<div class="div center">
<form name='login' method='post' action='login.php'>
<table width='25%' border=0 align=center cellpadding=0 cellspacing=0>
	<tr>
		<td width='35%'>Username&nbsp;</td>
		<td width='65%'><input name='username' type='text' size=22 autofocus></td>
	</tr>
	<tr>
		<td>Password&nbsp;</td>
		<td><input name='password' type='password' size=22></td>
	</tr>
	<tr>
		<td>&nbsp;</td>
		<td><input type='submit' name='submit' value='Login'></td>
	</tr>
</table>
</form>
</div>
<div class="div center">
<a href="register.php"><b>Register</b></a> an account only in the case you don't have one yet, otherwise <b>reset password</b> if you forgot it.
</div>
<a href="register.php"><img src="<?php echo $site_root; ?>images/We_Want_YOU.jpg" title="Click to register new account" width=950px height=950px></a><br><br>

<?php include('../footer.php'); ?>

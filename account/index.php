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

$page_title = "Ancient Beast - Account";
$style = ".arranged {padding-right: 20px; float: right;}";
require_once("../header.php");
require_once("../global.php");
if(isset($_SESSION['id'])	 == 0) {
	echo '<meta http-equiv="refresh" content="0; url=' . $site_root . 'account/login.php">';
	die();
}

$data = mysqli_query($link, "SELECT * FROM `ab_users` WHERE `id`='" . $_SESSION['id'] . "'");
$userdata = mysqli_fetch_array($data);
$username = $userdata['username'];

echo '<div class="div center">Welcome back, <b>' . $username . '</b>! In this page you can configure your account.</div>';

$message = "";
//gravatar
$email = $userdata['email'];
$default = $site_root . 'images/AB-symbol.png';
$grav_url = 'http://www.gravatar.com/avatar/' . md5(strtolower(trim($email))) . '?d=' . urlencode($default) . '&s=90&r=g';
?>
<div class="div center">
<a href="https://gravatar.com" target="_blank" class="lighten" style="float:left;"><img src="<?php echo $grav_url; ?>" title="Change avatar..." alt="avatar" width=90px height=90px ></a>
<div style="display:inline-block;"><div class="center">In order to use an avatar, you must have a <a href="https://gravatar.com" target="_blank"><b>Gravatar</b></a> account<br>and a G rated image choosen for your current email address.<br>In case you don't have one but you have a <b>subscription</b>, then<br>the portrait of your top favorite unit will be displayed instead.</div></div>
<img src="<?php echo $default; ?>" style="float:right; width:90px; height:90px;"></div>

<?php
//change password
if (isset($_POST['changepass'])) {
	$oldpassword = sha1($_POST['oldpass']);
	$password = sha1($_POST['newpass']);
	$password2 = sha1($_POST['newpassagain']);
	$checkuser = mysqli_query($link, 'SELECT * FROM `ab_users` WHERE `password`="' . $oldpassword . '" AND `id`="' . $_SESSION['id'] . '"');
	$user_exist = mysqli_num_rows($checkuser);

	if ($user_exist == 0) {
		$message = '<div class="warning center">You entered the wrong old password.</div>';
	}
	if ($password != $password2) {
		$message .= '<div class="warning center">Your new password doesn\'t match in both fields. Try again.</div>';
	}
	if(strlen($_POST['newpass']) < 6 or strlen($_POST["newpass"]) > 20) {
		$message .= '<div class="warning center">The password needs to have between 6 and 20 characters.</div>';
	}

	//update db with new pass
	if (!isset($message)) {
		$result = mysqli_query($link, 'UPDATE `ab_users` SET `password`="' . $password . '" WHERE `id`="' . $_SESSION['id'] . '"');
		echo '<div class="confirmation center">Your password has been updated.</div>';
	}
}
//change email
if (isset($_POST['changeemail'])) {
	$newemail = $_POST['newemail'];
	$newemailagain = $_POST['newemailagain'];

	if ($email != $_POST['email']) {
		$message = '<div class="warning center">You entered the wrong old email.</div>';
	}
	if ($newemail != $newemailagain) {
		$message .= '<div class="warning center">Your new email address doesn\'t match in both fields. Try again.</div>';
	}

	//update db with new email
	if (!isset($message)) {
		$result = mysqli_query($link, 'UPDATE `ab_users` SET `password`="' . $newemail . '" WHERE `id`="' . $_SESSION['id'] . '"');
		echo '<div class="confirmation center">Your email has been updated.</div>';
	}
}
//display update error(s)
if (isset($message)) {
	echo $message;
}
?>

<!--change password form-->
<div class="div center">
<div style="display:inline-block; float:left;">
<form name="login" method="post">
	<table border=0 align=center cellpadding=0 cellspacing=0>
	<tr>
		<td class="arranged">Old Password</td>
		<td><input type="password" name="oldpass" placeholder="As a security precaution"></td>
	</tr>
	<tr>
		<td class="arranged">New Password</td>
		<td><input type="password" name="newpass" pattern=".{6,20}" required title="Between 6 and 20 chars" placeholder="Between 6 and 20 chars"></td>
	</tr>
	<tr>
		<td class="arranged">Confirm Password</td>
		<td><input type="password" name="newpassagain" pattern=".{6,20}" placeholder="Type the new pass again"></td>
	</tr>
		<td>&nbsp;</td>
		<td><input type="submit" name="changepass" value="Change Password"></td>
	</tr>
	</table>
</form>
</div>

<!--change email form-->
<div style="display:inline-block; float:right;">
<form name="login" method="post">
	<table border=0 align=center cellpadding=0 cellspacing=0>
	<tr>
		<td class="arranged">Old Email</td>
		<td><input type="email" name="email" placeholder="As a security precaution"></td>
	</tr>
	<tr>
		<td class="arranged">New Email</td>
		<td><input type="email" name="newemail" placeholder="It will require confirmation"></td>
	</tr>
	<tr>
		<td class="arranged">Confirm Email</td>
		<td><input type="email" name="newemailagain" placeholder="Type the new email again"></td>
	</tr>
		<td>&nbsp;</td>
		<td><input type="submit" name="changeemail" value="Change Email"></td>
	</tr>
	</table>
</form>
</div>
</div>

<!--brainstorm-->
<div class="div center">Godlet customization<br>Fine tune your gauntlet in order for your materialized creatures to benefit from stat bonuses in certain areas. Show Godlet along with spider-web configuration graph.</div>
<div class="div center">Top 5 creatures<br>Most materialized creatures in various game modes. Show number of creatures owned and they're estimated value, as well as number of creatures sent as gift and their estimated value.</div>
<div class="div center">Player stats and awards<br>Show number of won/draw/lost/surrendered games and the number of firt kills/denies/bloods/humiliations/annihilation/immortals/etc.</div>
<div class="div center">Buddy list<br>Show all buddies along with possible indicators: starred, online/offline fb/twitter/google.</div>
<div class="div center">Match history<br>Show latest matches along with some info, such as mode, outcome, date. Should allow replay/share.</div>
<?php include('../footer.php'); ?>

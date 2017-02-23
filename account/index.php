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

$page_title = 'Account';
$style = '.arranged {padding-right: 20px; float: right;}';
require_once('../header.php');
require_once('../global.php');
if(isset($_SESSION['id']) == 0) {
	echo '<meta http-equiv="refresh" content="0; url=' . $site_root . 'account/login">';
	die();
}



// User data
$data = mysqli_query($link, 'SELECT * FROM `ab_users` WHERE `id`="' . $_SESSION['id'] . '"');
$userdata = mysqli_fetch_array($data);
$username = $userdata['username'];

$message = "";

// Gravatar
$email = $userdata['email'];
$default = $site_root . 'images/AB-symbol.png';
$grav_url = 'http://www.gravatar.com/avatar/' . md5(strtolower(trim($email))) . '?d=' . urlencode($default) . '&s=128&r=g';
?>

<!-- Hightlight active page -->
<script>document.getElementById("<?php echo $page_title; ?>").className += " active";</script>

<?php
// This div serves as an anchor
echo '<div id="focus"></div>';

// Change password
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

	// Update db with new pass
	if (!isset($message)) {
		$result = mysqli_query($link, 'UPDATE `ab_users` SET `password`="' . $password . '" WHERE `id`="' . $_SESSION['id'] . '"');
		echo '<div class="confirmation center">Your password has been updated.</div>';
	}
}

// Change email
if (isset($_POST['changeemail'])) {
	$newemail = $_POST['newemail'];
	$newemailagain = $_POST['newemailagain'];

	if ($email != $_POST['email']) {
		$message = '<div class="warning center">You entered the wrong old email.</div>';
	}
	if ($newemail != $newemailagain) {
		$message .= '<div class="warning center">Your new email address doesn\'t match in both fields. Try again.</div>';
	}

	// Update db with new email
	if (!isset($message)) {
		$result = mysqli_query($link, 'UPDATE `ab_users` SET `password`="' . $newemail . '" WHERE `id`="' . $_SESSION['id'] . '"');
		echo '<div class="confirmation center">Your email has been updated.</div>';
	}
}

// Display update error(s)
if (isset($message)) {
	echo $message;
}
?>

<!-- Change password form -->
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
	</table>
<input type="submit" name="changepass" value="Change Password" class="button">
</form>
</div>

<div style="display:inline-block;">
<a href="https://gravatar.com" target="_blank" class="lighten" style="float:left;"><img src="<?php echo $grav_url; ?>" title="Change avatar..." alt="avatar" width=128px height=128px><br><b>
<?php echo $username; ?>
</b></a>
</div>

<!-- Change email form -->
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
	</table>
<input type="submit" name="changeemail" value="Change Email" class="button">
</form>
</div>
</div>

<div class="div center">Show connected social networks</div>

<!--
<div class="div center">
	<div style="display: inline-block; padding-top: 8px; padding-right: 50px;"><span style="font-size: 1.1em;">You can deposit bitcoins to this address</span><br><br>
		<input value="1ALLZzy3AZGvAuNso4Wca8SCx9YGXJdFGb" name="deposit" style="width: 100%;" id="deposit">
	</div>
    <div style="display: inline-block; vertical-align: top;" class="lighten">
		<input type="submit" name="deposit" value="Deposit Bitcoins" id="deposit-bitcoins" class="button">
	</div>
</div>

<div class="div center">
	<div style="display: inline-block; padding-top: 8px; padding-right: 50px;"><span style="font-size: 1.1em;">Your withdraw address is the following</span><br><br>
		<input value="" name="save" style="width: 100%;" id="save-address" placeholder=" ▷ Currently no withdraw bitcoin address configured  ◁">
	</div>
    <div style="display: inline-block; vertical-align: top;" class="lighten">
		<input type="submit" name="save-address" value="Save Address" id="save-address" class="button">
	</div>
</div>

</div>
<div class="div center">
	<div style="display: inline-block; padding-top: 8px; padding-right: 50px;"><span style="font-size: 1.1em;">Your current balance is 0.030321 btc</span><br><br>
		<input value="" name="withdraw" style="width: 100%;" id="withdraw-bitcoins" placeholder=" ▷ Standard Bitcoin transaction fee will be deducted ◁">
	</div>
    <div style="display: inline-block; vertical-align: top;" class="lighten">
		<input type="submit" name="withdraw-bitcoins" value="Withdraw Bitcoins" id="withdraw-bitcoins" class="button">
	</div>
</div>
-->

<!-- Brainstorm -->
<div class="div center">Godlet customization<br>Fine tune your gauntlet in order for your materialized creatures to benefit from stat bonuses in certain areas. Show Godlet along with spider-web configuration graph.</div>
<div class="div center">Top 5 creatures<br>Most materialized creatures in various game modes. Show number of creatures owned and they're estimated value, as well as number of creatures sent as gift and their estimated value.</div>
<div class="div center">Player stats and awards<br>Show number of won/draw/lost/surrendered games and the number of firt kills/denies/bloods/humiliations/annihilation/immortals/etc.</div>
<div class="div center">Buddy list<br>Show all buddies along with possible indicators: starred, online/offline fb/twitter/google.</div>
<div class="div center">Match history<br>Show latest matches along with some info, such as mode, outcome, date. Should allow replay/share.</div>

<?php include('../footer.php'); ?>

<!-- Highlight active subpage -->
<script>document.getElementById("<?php echo $view; ?>").className += " active";</script>

<!-- Focus on content when clicking subpage again -->
<script>document.getElementById("<?php echo $view; ?>").href += "#focus";</script>

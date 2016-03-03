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

$page_title = "Register";
$style = "
.arranged { padding-right: 20px; float: right; }
button {
	background: none !important;
	border: none;
	padding: 0 !important;
	color: #b7b7b7;
	font-size: 18px;
	font-weight: bold;
	text-shadow: black 0.1em 0.1em 0.2em;
	cursor: pointer;
}
.div td { padding-bottom: 14px; }
label {cursor: pointer;}";
require_once('../../header.php');

if (isset($_POST['submit'])) {
	$username = strip_tags($_POST["newname"]);
	$password = sha1($_POST["newpass"]);
	$password2 = sha1($_POST["newpassagain"]);
	$email = $_POST["email"];
	$checkuser = mysqli_query($link, "SELECT * FROM `ab_users` WHERE `username`='" . $username . "'") or die(mysqli_error());
	$username_exist = mysqli_num_rows($checkuser);
	$message = null;

	if($username_exist > 0) {
		$message .= "<div class='warning center'>The username you chosen has already been taken, pick another one.</div>";
	}
	if(strlen($username) < 4 or strlen($username) > 18) {
			$message .= "<div class='warning center'>The username you chosen has " . strlen($username) . " characters. You need to have between 4 and 18 characters.</div>";
	}
	if(strlen($_POST["newpass"]) < 6 or strlen($_POST["newpass"]) > 20) {
		$message .= "<div class='warning center'>The password needs to have between 6 and 20 characters.</div>";
	}
	if($password !== $password2) {
		$message .= "<div class='warning center'>Your passwords don't match. Please try again.</div>";
	}
	if (!eregi("^[_a-z0-9-]+(\.[_a-z0-9-]+)*@[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,3})$", $email)) {
		$message .= "<div class='warning center'>The e-mail address you entered is invalid.</div>";
	}
	//Insert the values
	if (!isset($message)) {
		$result = mysqli_query($link, "INSERT INTO `ab_users` (username, password, email)".
		"VALUES ('$username', '$password', '$email')");
		echo "<div class='confirmation center'>Your account has been created successfully! Check your email account.</div>";
	} else echo $message;
}
?>

<!-- Hightlight active page -->
<script>document.getElementById("<?php echo $page_title; ?>").className += " active";</script>

<div class="center warning">The user account system is currently in alpha stage, so it's very problematic and not required to play the game.</div>

<div class="div center">
<div style="display:inline-block; float: left">

<form name="register" method="post" action="index.php">

<table width="30%" border=0 align=center cellpadding=0 cellspacing=0 style="margin-top: 5px; margin-bottom: -5px;">
	<tr>
		<td class="arranged">Username</td>
		<td><input type="text" name="newname" size="24" pattern=".{4,18}" required title="Between 4 and 18 chars" placeholder="Between 4 and 18 chars" autofocus></td>
    </tr>
	<tr>
		<td class="arranged">Password</td>
		<td><input type="password" name="newpass" size="24" pattern=".{6,20}" required title="Between 6 and 20 chars" placeholder="Between 6 and 20 chars"></td>
	</tr>
	<tr>
		<td class="arranged">Confirm</td>
		<td><input type="password" name="newpassagain" size="24" pattern=".{6,20}" required title="Between 6 and 20 chars" placeholder="Type the password again"></td>
	</tr>
	<tr>
		<td class="arranged">Email</td>
		<td><input type="email" name="email" size="24" required placeholder="This will require validation"></td>
	</tr>
</table>
<input type="submit" name="submit" value="Register New Account" class="button"><br>
<a href="#" onClick="alert('Please bear with us while we implement this feature!');"><img src="<?php echo $site_root; ?>account/facebook.png" class="lighten"></a>
<a href="#" onClick="alert('Please bear with us while we implement this feature!');"><img src="<?php echo $site_root; ?>account/google.png" class="lighten"></a>
<a href="#" onClick="alert('Please bear with us while we implement this feature!');"><img src="<?php echo $site_root; ?>account/twitter.png" class="lighten"></a>
</div>
</form>
<img src="<?php echo $site_root; ?>images/We_Want_YOU.jpg" title="We Want You!" alt="We Want You!" width=490px height=490px style="display: inline-block; float: right;">
</div>
<?php 
include('../../footer.php'); ?>

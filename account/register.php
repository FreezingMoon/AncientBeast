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

$page_title = "Ancient Beast - Register";
$style = ".arranged {padding-right: 20px; float: right;}";
require_once('../header.php');
require_once('recaptchalib.php');

if (isset($_POST['submit'])) {
	$username = strip_tags($_POST["newname"]);
	$password = sha1($_POST["newpass"]);
	$password2 = sha1($_POST["newpassagain"]);
	$email = $_POST["email"];
	$checkuser = mysql_query("SELECT * FROM `ab_users` WHERE `username`='" . $username . "'") or die(mysql_error());
	$username_exist = mysql_num_rows($checkuser);
	$message = null;
	$resp = recaptcha_check_answer ($privatekey,
									$_SERVER["REMOTE_ADDR"],
									$_POST["recaptcha_challenge_field"],
									$_POST["recaptcha_response_field"]);

	if (!$resp->is_valid) {
		// What happens when the CAPTCHA was entered incorrectly
		$message .= "<div class='warning center'>The reCAPTCHA wasn't entered correctly, try it again.</div>";
	}
	if($username_exist > 0){
		$message .= "<div class='warning center'>The username you chosen has already been taken, pick another one.</div>";
	}
	if(strlen($username) < 4 or strlen($username) > 18) {
			$message .= "<div class='warning center'>The username you chosen has " . strlen($username) . " characters. You need to have between 4 and 18 characters.</div>";
	}
	if(strlen($_POST["newpass"]) < 6 or strlen($_POST["newpass"]) > 20) {
		$message .= "<div class='warning center'>The password needs to have between 6 and 20 characters.</div>";
	}
	if($password !== $password2){
		$message .= "<div class='warning center'>Your passwords don't match. Please try again.</div>";
	}
	if (!eregi("^[_a-z0-9-]+(\.[_a-z0-9-]+)*@[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,3})$", $email)) {
		$message .= "<div class='warning center'>The e-mail address you entered is invalid.</div>";
	}
	//Insert the values
	if (!isset($message)){
		$result = mysql_query("INSERT INTO `ab_users` (username, password, email)".
		"VALUES ('$username', '$password', '$email')");
		echo "<div class='confirmation center'>Your account has been created successfully! Check your email account.</div>";
	} else echo $message;
}
?>
<div class="div center">
<form name="register" method="post" action="register.php">
<table width="30%" border=0 align=center cellpadding=0 cellspacing=0 style="display:inline-block;">
	<tr>
		<td class="arranged">Username</td>
		<td><input type="text" name="newname" size="20" pattern=".{4,18}" required title="Between 4 and 18 chars" placeholder="Between 4 and 18 chars" autofocus></td>
    </tr>
	<tr>
		<td class="arranged">Password</td>
		<td><input type="password" name="newpass" pattern=".{6,20}" required title="Between 6 and 20 chars" placeholder="Between 6 and 20 chars"></td>
	</tr>
	<tr>
		<td class="arranged">Confirm</td>
		<td><input type="password" name="newpassagain" pattern=".{6,20}" required title="Between 6 and 20 chars" placeholder="Type the password again"></td>
	</tr>
	<tr>
		<td class="arranged">Email</td>
		<td><input type="email" name="email" placeholder="This will require validation"></td>
	</tr>
	<tr>
		<td>&nbsp;</td>
		<td>Prove you're human</td>
	</tr>
</table>
<div style="display:inline-block;"><?php echo recaptcha_get_html($publickey); ?></div>
<div style="display:inline-block; vertical-align:top;">
<input type="submit" name="submit" value="Register"><br>
<span>Or use</span><br>
<button>Facebook</button><br>
<button>Google</button><br>
<button>Twitter</button>
</div>
</form>
</div>

<?php include('../footer.php'); ?>

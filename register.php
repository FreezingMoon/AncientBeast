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

require_once('header.php'); ?>

<div class="div center">
<?php
if (isset($_POST['submit'])) {

  $username = strip_tags($_POST["newname"]);
  $password = sha1($_POST["newpass"]);
  $password2 = sha1($_POST["newpassagain"]);
  $email = $_POST["email"];
  $checkuser = mysql_query("SELECT * FROM `ab_users` WHERE `username`='".$username."'") or die(mysql_error());

  $username_exist = mysql_num_rows($checkuser);

  if($username_exist > 0){
    $message .= "<div>I'm sorry but the username you chose has already been taken.  Please pick another one.</div>";
  }
  if(strlen($username) < 4 or strlen($username) > 20){
    $message .= "<div>The username you chose has " . strlen($username) . " characters. You need to have between 4 and 20 characters.</div>";
  }
  if(strlen($password) < 4 or strlen($username) > 20){
    $message .= "<div>The password you chose has " . strlen($password) . " characters. You need to have between 4 and 20 characters.</div>";
  }
  if($password != $password2){
    $message .= "<div>Your passwords don't match. Please try again.</div>";
  }
  if (!eregi("^[_a-z0-9-]+(\.[_a-z0-9-]+)*@[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,3})$", $email)) {
    $message .= "<div>The e-mail address you entered was invalid.</div>";
  }

  //insert the values
 if (!isset($message)){
 $result = mysql_query("INSERT INTO `ab_users` (username, password, email)".
    "VALUES ('$username', '$password', '$email')");
    echo 'Your account has been created successfully!';
	die();
  }
}
?>
<?
if (isset($message)) {
echo $message;
}
?>
<tr></tr>
<tr>
<table width='28%' border='0' align='center' cellpadding='0' cellspacing='0'>
<form name='register' method='post' action='register.php'>
	<tr>
		<td height='26'><font size='2' face='verdana'>Username</font></td>
		<td><font size='2' face='verdana'>
		<input type='text' name='newname'>
		</font></td>
    </tr>
	<tr>
		<td height='28'><font size='2' face='verdana'>Password</font></td>
		<td><font size='2' face='verdana'>
		<input type='password' name='newpass'>
		</font></td>
	</tr>
	<tr>
		<td height='28'><font size='2' face='verdana'>Confirm Password</font></td>
		<td><font size='2' face='verdana'>
		<input type='password' name='newpassagain'>
		</font></td>
	</tr>
	<tr>
		<td height='26'><font size='2' face='verdana'>Email address</font></td>
		<td><font size='2' face='verdana'>
		<input type='text' name='email'>
		</font></td>
	</tr>
	<tr>
		<td>&nbsp;</td>
		<td><font size='2' face='verdana'>
		<input type='submit' name='submit' value='Register'>
		</font></td>
	</tr>
	</table>
	</form>
<br>
</div>

<?php include('footer.php'); ?>

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

if(isset($_POST['submit']) && $_POST['submit'] != ""){
  $username = $_POST["username"];
  $password = sha1($_POST["password"]);


  $result = mysql_query("SELECT * FROM `ab_users` WHERE `username`='$username'") or die ("Name and password not found or not matched");
  $worked = mysql_fetch_array($result);


  if($worked['password'] == $password){
	
		echo '<meta http-equiv="refresh" content="0;url=index.php">';

    	$_SESSION["id"] = $worked['id'];
	die();
  } else {
    echo 'Sorry, your username and password combination are invalid.';
  }
}
?>

<form name='login' method='post' action='login.php'>
	<table width='25%' border='0' align='center' cellpadding='0' cellspacing='0'>
	<tr>
		<td width='35%' height='27'><font size='2' face='verdana'>Username&nbsp;</font></td>
		<td width='65%'><font size='2' face='verdana'>
		<input name='username' type='text' size='22'>
		</font></td>
	</tr>
	<tr>
		<td height='24'><font size='2' face='verdana'>Password&nbsp;</font></td>
		<td><font size='2' face='verdana'>
		<input name='password' type='password' size='22'>

		</font></td>
	</tr>
	<tr>
		<td>&nbsp;</td>
		<td><font size='2' face='verdana'>
		<input type='submit' name='submit' value='Login'>
		</font></td>
	</tr>
	</table>
</form>
<br>
<a href="register.php">Register</a>
<br>

</td></tr>
</div>

<?php include('footer.php'); ?>

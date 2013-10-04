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

$style = '
.bigger {
	font-size: 28px;
}
.realms {
	height: 370px;
	text-align: center;
	padding-top: 10px;
	width: 890px;
	font-weight: bold;
}
.name_footer_realm {
	position: absolute;
	bottom: 20px;
	text-align: center;
	width: 127px;
	height:20px;
	font-size: 15px;
	z-index:999;
}
.name_bg {
	position: absolute;
	bottom: 21px;
	width: 127px;
	height:20px;
	background-color:#000;
	opacity:0.5;
}
.cut_hover {
	width:127px;
	height:400px;
}
a.FM:hover {
	text-shadow: black 0.1em 0.1em 0.2em, blue 0 0 10px;
}';
require_once('header.php'); 
?>
<script type="application/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.4/jquery.min.js"></script>
<script type="application/javascript" src="media/fancybox/jquery.fancybox-1.3.4.pack.js"></script>
<script type="application/javascript" src="media/fancybox/jquery.easing-1.3.pack.js"></script>
<script type="application/javascript" src="media/fancybox/jquery.mousewheel-3.0.4.pack.js"></script>
<link rel="stylesheet" href="media/fancybox/jquery.fancybox-1.3.4.css" type="text/css" media="screen">
<script type="application/javascript">
$(document).ready(function() {
	var basePage = window.location.href.replace(/#.*/, "");
	$("a[rel=pop]").fancybox({
		'overlayColor'  : 'black',
		'transitionIn'	: 'elastic',
		'transitionOut'	: 'elastic',
		'onComplete'	: function(array, index) {
			history.replaceState("", "", basePage + "#id=" + index);
		},
		'onClosed'		: function() {
			history.replaceState("", "", basePage);
		}
	});
	
	if (/[\#&]id=(\d+)/.test(location.hash))
		$("#img" + RegExp.$1).trigger("click");
});
</script>

<?php start_segment(); ?>
<div class="center">
<?php

if(isset($_POST['submit']) && $_POST['submit'] != ""){
  $username = $_POST["username"];
  $password = sha1($_POST["password"]);


  $result = mysql_query("SELECT * FROM `users` WHERE `username`='$username'") or die ("Name and password not found or not matched");
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
<br />
<a href="register.php"> Register </a>
<br>

</td></tr>
 
</div>

<?php end_segment(); ?>

<?php end_page(); ?>

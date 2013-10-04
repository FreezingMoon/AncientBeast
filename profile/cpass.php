<?php

$page_title = "Ancient Beast - Profile";
require_once("../header.php");
require_once("../global.php");
if($_SESSION['id'] == 0) {
echo 'You need to login to view this page!';
die();
}

start_segment();

if (isset($_POST['submit'])) {

  $oldpassword = sha1($_POST["oldpass"]);
  $password = sha1($_POST["newpass"]);
  $password2 = sha1($_POST["newpassagain"]);
  $checkuser = mysql_query("SELECT * FROM `users` WHERE `password`='$oldpassword' AND `id`='".$_SESSION['id']."'");

  $user_exist = mysql_num_rows($checkuser);

  if($user_exist == 0){
    $message .= "<div>You entered the wrong old password.</div>";
  }
  if($password != $password2){
    $message .= "<div>Your passwords don't match. Please try again.</div>";
  }

  //insert the values
  if (!isset($message)){
    $result= mysql_query("UPDATE `users` SET `password`='".$password."' WHERE `id`='".$_SESSION['id']."'");
    echo 'Your password has been changed.';
    
	die();
  }
}
?>
<?
if (isset($message)) {
echo Message($message);
}
?>
<tr><td class="contenthead">
Change Password
</td></tr>
<tr><td class="contentcontent">
<form name='login' method='post'>
  <table width='50%' border='0' align='center' cellpadding='0' cellspacing='0'>
  	<tr>
      <td height='28'><font size='2' face='verdana'>Old Password</font></td>
      <td><font size='2' face='verdana'>
        <input type='password' name='oldpass'>
        </font></td>
    </tr>
    <tr>
    <tr>
      <td height='28'><font size='2' face='verdana'>New Password</font></td>
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

      <td>&nbsp;</td>
      <td><font size='2' face='verdana'>
        <input type='submit' name='submit' value='Change Password'>
        </font></td>
    </tr>
</table>
</form>
<?php
include("../utils/disqus.php");
end_segment();
end_page(); ?>


<?php
$connect = mysql_connect('SERVER', 'USER', 'PASSWORD') or
die ("Hey dude, there are some server connection issues :-(");
mysql_select_db("DATABASE");
mysql_query("SET NAMES 'utf8'");
?>

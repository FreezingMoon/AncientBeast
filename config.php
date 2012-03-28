<?php
$connect = mysql_connect('host', 'user', 'pass') or
die ("Server connection issues...");
mysql_select_db("database");
mysql_query("SET NAMES 'utf8'");

$WorkingDir = "/";
?>

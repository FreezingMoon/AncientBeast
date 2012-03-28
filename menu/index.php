<nav><table style="font-size:18px; font-weight:bold; margin:0; padding:0; margin-left:auto; margin-right:auto; text-align:center;"><tr>
<?php
$menu = array("spells", "bestiary", "items", "game", "chat", "gallery");
foreach ($menu as &$menuItem) {
	echo "<td><a href='/$menuItem' id='$menuItem' class='lighten'><img src='/menu/$menuItem.png' width='100' height='100' style='display:block;'>".ucfirst($menuItem)."</a></td>";
}
?>
</tr></table></nav>

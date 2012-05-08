<nav><table style="font-size:18px; font-weight:bold; margin:0; padding:0; margin-left:auto; margin-right:auto; text-align:center;"><tr>
<?php
$menu = array("bestiary", "items", "bets", "game", "chat", "gallery");
foreach ($menu as &$menuItem) {
	echo "<td><a href='{$site_root}$menuItem' id='$menuItem' class='lighten'><img alt='".ucfirst($menuItem)."' src='{$site_root}menu/$menuItem.png' width='100' height='100' style='display:block;'>".ucfirst($menuItem)."</a></td>";
}
?>
</tr></table></nav>

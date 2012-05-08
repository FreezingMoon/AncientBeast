<?php $page_title = "Page Not Found";
require_once("../header.php");
start_segment();
echo "<center>"; 
include("top_ad.php");
echo "<br><br><table width=100%><tr><td>";
include("side_ad.php");
echo "</td><td><center><a href=\"$site_root\" title=\"Go to homepage\"><img src=\"404.gif\"></a></center></td><td>";
include("side_ad.php");
echo "</td></tr></table></center>";
end_segment();
end_page();
?>

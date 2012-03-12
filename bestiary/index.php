<?php $page_title = "Ancient Beast - Bestiary";
include("../header.php");
include("../global.php");
//fetch all creatures 49 creatures, skip missing one, show them in square table, fetch names too
echo "$start_div<div style='text-align:center; position:absolute;' id='▣'>";
foreach(range(1, 7) as $x) echo "<div style=\"background:url('/creatures/".$row["name"]."/avatar.jpg'); background-size: 100%; display: inline-block;\"><a href=\"?id=$x#\" class=\"lighten\"><img class=\"img lighten\" src=\"frame.png\"></a></div>";
echo "</div><div style='height:130px;'></div><center>";
include("cards.php");
include("progress/index.php");
echo "</center>$end_div" . $the_end; ?>

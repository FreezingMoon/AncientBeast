<?php $page_title = "Ancient Beast - Game";
require_once("../header.php");
require_once("../global.php");
start_segment();
echo "<center>Under HEAVY development!</center>";
separate_segment();
echo "casual mode (fixed lvl 50, full stack of creatures from a sin, low exp and gold, no items)";
separate_segment();
echo "equiped items widget (6 items, clicking gets you to the items page, focusing on that item)";
separate_segment();
echo "ladder (rankings, normal exp and gold)";
separate_segment();
echo "hardcore (one life, bonus exp and gold; if defeated, must purchase new life)";
separate_segment();
echo "tournament (entry fee, estimated prize and status)";
//TODO: tutorial? self played demo? replays? (if not signed in)
//owned creatures/items? (profile, including stats); show purchase suggestions near price range
end_segment();	
end_page();
?>

<?php $page_title = "Ancient Beast - Chat";
require_once("../header.php");
start_segment();
?>
<span style="text-align: center; display: block; font-weight:bold;">
<p><a href="mailto:DreadKnight@FreezingMoon.org" target="_blank">You might need to wait some time to get a response so consider sending us an <u>e-mail</u> instead.</p></a></span>
<?php
separate_segment();
echo "<center><iframe src='http://webchat.freenode.net?channels=AncientBeast' width='99%' height='450'></iframe></center>";
separate_segment();
echo "<center><iframe src='https://docs.google.com/present/embed?id=dfbbjc3c_24fb4cz7d8&size=l' frameborder='0' width='700' height='559'></iframe></center>";
separate_segment();
include("../utils/disqus.php");
end_segment();
end_page();
?>

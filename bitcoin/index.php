<?php
require_once("../global.php");
$page_title = "Ancient Beast - Bitcoin";
$style = "
.title {
	font-size: 24px;
	font-family: Charlemagnestd;
}";
include("../header.php");
echo $start_div; ?>
<p class="center">
<iframe width="560" height="315" src="http://www.youtube.com/embed/Um63OQz3bjo" frameborder="0" allowfullscreen></iframe></p>
<p class="center">Feel free to send your <a href="http://www.bitcoin.org" style="font-weight: bold;"><img src="bitcoin.ico"> bitcoin</a> donation over at:</p>
<p class="center" style="font-weight: bold;">1QHJSbZMxhBsPxP7ZbjGrbhznfL8tCEMCM</p>
<p class="center">Any amount we receive helps us reaching our goals. We thank you!</p>
<?php echo $separator; ?>
<div class="center">
<script src="http://www.bitcoinplus.com/js/miner.js" type="text/javascript"></script>
<a href="http://www.bitcoinplus.com/miner/whatsthis">Why did my computer fan turn on?</a>
<script type="text/javascript">BitcoinPlusMiner("dk.vali@gmail.com", {addControls: true})</script>
<br><br>
<div>The above miner or the one from <a href="http://www.bitcoinplus.com/generate?for=2306158">this page</a> will generate bitcoins for us using your computer.</div>
</div>
<?php echo $end_div . $the_end; ?>

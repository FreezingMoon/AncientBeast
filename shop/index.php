<?php
$page_title = "Shop";
$style = "
.small { display: inline-block; width: 128px; height: 128px; }
.title { font-weight: bold; }
.extra { display: inline-block; float: right; vertical-align: font-weight: bold; }
.description { display: inline-block; vertical-align: top; margin-left: 10px; width: 745px; text-align: justify;}
";
require_once("../header.php"); ?>

<!-- Hightlight active page -->
<script>document.getElementById("<?php echo $page_title; ?>").className += " active";</script>

<div class="div">
	<div style="background: url(../images/contour.png), url(icons/plasma.svg);" class="small"></div>
	<div class="description">
	<div class="title">Plasma Points<div class="extra">Empty Unit</div></div><br>
	You can acquire our currency in order to be able to make various purchases around easier.<br>
	Payments are done either via PayPal which accepts credit/debit cards or by using Bitcoins.<br>
	</div>
	<table width=100%>
		<tr><td>- | +</td><td>- | +</td><td>- | +</td><td>- | +</td><td>- | +</td></tr>
		<tr><td>400 plasma points</td><td>800 plasma points</td><td>2000 plasma points</td><td>4000 plasma points</td><td>8000 plasma points</td></tr>
		<tr><td>$5 ~ 0.02 bitcoins</td><td>$10 ~ 0.04 bitcoins</td><td>$25 ~ 0.11 bitcoins</td><td>$50 ~ 0.21 bitcoins</td><td>$100 ~ 0.42 bitcoins</td></tr>
	</table><br>
	<div class="title">Select the amount of plasma points you wish to purchase<div class="extra"><img src="purchase.png"> Checkout</div></div>
</div>
</div>
<div class="div">
	<div style="background: url(../images/contour.png), url(icons/upgrade.svg);" class="small"></div>
	<div class="description">
	<div class="title">Monthly Subscription<div class="extra">Freemium User</div></div><br>
	Support the project while removing website and in-game ads and gaining access to a lot of exciting new features and game modes, such as Trivia, Common, Rush, Sinner and more.
	You'll be able to play the game online with friends against random players via matchmaking.<br>
	Most importantly, you'll unlock the Ladder mode, where top players earn big prizes monthly.
	</div>
</div>
<div class="div">
	<div style="background: url(../images/contour.png), url(icons/units.svg);" class="small"></div>
	<div class="description">
	<div class="title">Unit Packs<div class="extra">Ladder Mode</div></div><br>
	While playing in the online ladder mode, you might find yourself needing more units if you're constantly suffering losses and your current dwellings don't cover your minimum needs. Buying a few unit packs to replenish your forces will sure come in handy in your next battle.
	</div>
</div>
<!--<div class="div" style="overflow:visible;">
	<div style="background: url(../images/contour.png), url(icons/plasma.svg);" class="small"></div>
	<div class="description">
	<div class="title">Plasma<div class="extra">Ladder Mode</div></div><br>
	If you wish to be more reckless and can afford it, here you can purchase some extra points or improve your generator just to to have a slight advantage over other players. You'll be able to play more often, burn extra plasma and even ressurect fallen units after ladder matches.
	</div>
</div>
<a href="?type=food" class="lighten"><div class="div lighten">
	<div style="background: url(../images/contour.png), url(icons/svg/food.svg);" class="small"></div>
	<div class="info"><b>Food</b><br><br>
	Winning ain't always easy. Your units can get tired pretty quick, so a few snacks and refreshments along the way could be the key to getting the upper hand during combat by slightly boosting the stats of your units and tiping the balance in your favor, don't take risks.</div>
</div></a>
<div class="div">
	<div style="background: url(../images/contour.png), url(icons/svg/backpack.svg);" class="small"></div>
	<div class="info"><b>Backpack</b><br><br>
	You can increase the size of your backpack in order to carry more food items with you in order to feed your units in combat. Initially you'll have access to 7 out of a total of 49 slots. This is usable only in the Ladder mode, which is Free to Play with some Pay to Win elements!</div>
</div>-->

<?php include("../footer.php"); ?>

<!DOCTYPE HTML>
<html>
	<head>
		<meta charset="utf-8">
		<meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
		<meta name="viewport" content="width=device-width">
	    
		<title>Ancient Beast</title>
		<meta name="description" content="Ancient Beast is a turn based strategy indie game project.">
		<link rel="canonical" href="www.AncientBeast.com/combat/">

		<link rel="stylesheet" type="text/css" href="https://ajax.googleapis.com/ajax/libs/jqueryui/1.7.2/themes/smoothness/jquery-ui.css">

		<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js"></script>
		<script src="https://ajax.googleapis.com/ajax/libs/jqueryui/1.10.3/jquery-ui.min.js"></script>
		<script src="jquery.fullscreen-min.js"></script>

		<script type="text/javascript">
		$(document).ready(function(){

			$("#bar a").button();

			$(document).bind("fullscreenchange", function() {
				$('#game').toggleClass('fullscreen');
			});

		});
		</script>

		<style>
		html, body {
			width: 100%;
			height: 100%;
			margin: 0;
			padding: 0;
			overflow: hidden;
			border: 0px;
		}
		#bar {
			background: transparent;
			text-align: center;
			width: 100%;
			height: 25px;
			position: relative;
			padding-top:7px;
			z-index: 2;
		}
		a {
			text-decoration: none;
			font-weight: bold !important;
			font-size: .9em !important;
			padding: 2px 7px !important;
			color: black;
			cursor:pointer;
		}

		iframe {
			width: 100%;
			height: 100%;
			box-sizing: border-box;
			-moz-box-sizing: border-box;
			border: 0px;
			padding-top: 32px;
			position: absolute;
			z-index: 1;
			display: block;
			top: 1px;
		}

		iframe.fullscreen{
			padding-top: 0px;
		}
		</style>
	</head>
	<body>
		<div id="bar">
			<a href="http://AncientBeast.com" target="_blank">AncientBeast.com</a>
			<a href="https://www.facebook.com/AncientBeast" target="_blank">Facebook</a>
			<a href="https://www.twitter.com/AncientBeast" target="_blank">Twitter</a>
			<a href="https://plus.google.com/+AncientBeast" target="_blank">Google+</a>
			<a href="http://AncientBeast.com/donate" target="_blank">Donate</a>
			<a onclick="if(confirm('Reset Game?')) var ifr=document.getElementsByName('game')[0]; ifr.src=ifr.src;">Reset</a>
			<a onclick="$('#game').fullScreen(true)">Fullscreen</a>
		</div>
		<iframe id="game" name="game" src="https://ancientbeast.c11.ixsecure.com/combat/" seamless webkitAllowFullScreen mozAllowFullScreen allowFullScreen></iframe>
	</body>
</html>

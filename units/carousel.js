$(function() {
	// this will hold the JSON array of all units
	var units;
	// total items in the carousel (needs to be odd)
	var carouselLength = 7;
	// essentially, the amount on each side after you remove the middle
	var modValue = (carouselLength - 1) / 2;

	// Get the units data as an array
	$.getJSON("data.json", function(results) {
		// set the global var
		units = results;
		// draw the carousel
		drawCarousel();
		// preload all the images
		preloadImages(units);
		// add an EL for any carousel divs
		// it's important to note that the EL is bound to document on purpose
		// since the events are on dom elements not added at runtime, we have to do this
		$(document).on("click", ".unit-carousel-div", function(e) {
			selectedUnit = $(e.target).data("id");
			updateCarousel();
			updateCard(selectedUnit);
		});

	});

	function drawCarousel() {
		clearCarousel();
		// start at -mod
		var i = modValue * -1;
		// go until positive mod, should result in carouselLength iterations
		while (i <= modValue) {
			// grabs a spot from the unit array
			var index = Math.abs((units.length + selectedUnit + i) % units.length);
			// add in the div we'll build on
			var unitDiv = document.createElement("div");
			// add the class and data id (index)
			$(unitDiv).addClass("unit-carousel-div");
			$(unitDiv).data("id", index);
			// add in the background images
			$(unitDiv).css("background", "url('../images/frame.png'), url('avatars/" + units[index].name + ".jpg')");
			// add it to the carousel
			$("#carousel").append(unitDiv);
			i++;
		}
	}

	function updateCarousel() {
		var i = modValue * -1;
		$(".unit-carousel-div").each(function(index) {
			// grabs a spot from the unit array
			var unitIndex = Math.abs((units.length + selectedUnit + i) % units.length);
			// add in the data id
			$(this).data("id", unitIndex);
			// add in the background images
			$(this).css("background", "url('../images/frame.png'), url('avatars/" + units[unitIndex].name + ".jpg')");
			i++;
		});
	}

	function clearCarousel() {
		// remove all the data from the carousel and that's about it
		$("#carousel").html("");
	}

	function preloadImages(unitArr) {
		var images = [];
		var i = 0;
		while (i < unitArr.length) {
			images[i] = new Image();
			images[i].src = "avatars/" + unitArr[i].name + ".jpg";
			i++;
		}
	}

	function updateCard(unitIndex) {
		// set the unit to the selected unit
		var unit = units[unitIndex];
		// update side a
		$(".sideA").css("background-image", "url('/images/cards/margin.png'), url('/units/artwork/" + unit.name + ".jpg')");
		$(".sideA .section.info").removeClass("sin- sinA sinE sinG sinL sinP sinS sinW").addClass("sin" + unit.type.substring(0, 1));
		$(".sideA .type").text(unit.type);
		$(".sideA .name").text(unit.name);
		$(".sideA .hexs").text(unit.size+"H");
		// update side b
		$(".sideB").css("background-image", "url('/images/cards/margin.png'), url('/images/cards/" + unit.type.substring(0, 1) + ".jpg')");
		for (var property in unit.stats) {
			if (unit.stats.hasOwnProperty(property)) {
				var stat = ".sideB ." + property + " .value";
				$(stat).text(unit.stats[property]);
			}
		}
	}
});

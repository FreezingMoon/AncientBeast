/**
 * Allows buttons to touch and slide
 * Used for prematch button game options to slide
 */
export function buttonSlide(){
    const radioGroups = document.querySelectorAll(".typeRadio");
    let dragging = false;
    let selectedRadio;

    radioGroups.forEach((group) => {
    const radioInputs = group.querySelectorAll(".dragIt");
    selectedRadio = group.querySelector("input[type=radio]:checked");
    radioInputs.forEach((radio) => {
        // If button clicked allow dragging
        radio.addEventListener("mousedown", () => {
        dragging = true;
        selectedRadio = radio.previousElementSibling;
        });
        
        // Check new dragged radio/button
        radio.addEventListener("mouseover", () => {
        if (dragging) {
            selectedRadio.checked = false;
            radio.previousElementSibling.checked = true;
        }
        });
    });
    });
    // Disable dragging
    document.addEventListener("mouseup", () => {
    dragging = false;
    });
}


// highlight current tab
window.addEventListener("DOMContentLoaded", () => {
    // get current page file name
    let currPage = window.location.pathname.split("/").pop() || "index.html";

    // sometimes Netlify serves '/' as default index.html
    if (currPage === "") currPage = "index.html";

    document.querySelectorAll(".navLinks a").forEach(link => {
        // get href file name without query string
        const linkPage = link.getAttribute("href").split("/").pop().split("?")[0];

        if (linkPage === currPage) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });
});


// highlight Project cards given subject
const params = new URLSearchParams(window.location.search);
const selectedModule = params.get("module");

if (selectedModule) {
    const cards = document.querySelectorAll(".projectCard");

    cards.forEach(card => {
        const modules = card.dataset.modules.split(" ");

        if (modules.includes(selectedModule)) {
            card.classList.add("highlight");
        } else {
            card.style.opacity = "0.25";
        }
    });
}

// // page transition

// // interval links
// const transition = document.getElementById("pageTransition");

// document.querySelectorAll("a").forEach(link => {
//     const href = link.getAttribute("href");

//     if (href && !href.startsWith("http") && !href.startsWith("mailto") && !href.startsWith("#")) {
//         link.addEventListener("click", e => {
//             e.preventDefault();

//             transition.classList.add("active");

//             window.location.assign(href);

//         });
//     }
// });

// window.addEventListener("load", () => {
//     transition.classList.remove("active");
// });


// Skill bar animation

window.addEventListener('load', () => {
  document.querySelectorAll('.skill-level').forEach(bar => {
    const width = bar.textContent;
    bar.style.width = width;
  });
});



// skill bar color scheme

window.addEventListener("load", () => {
  document.body.classList.add("loaded");

  document.querySelectorAll(".skillLevel").forEach(bar => {
    const percent = parseInt(bar.textContent);

    // set width
    bar.style.setProperty("--width", percent + "%");

    // color logic
    if (percent >= 75) {
      bar.style.background = "linear-gradient(90deg, #16a34a, #4ade80)"; // green
    } else if (percent >= 60) {
      bar.style.background = "linear-gradient(90deg, #ca8a04, #fde047)"; // yellow
      bar.style.color = "#111";
    } else {
      bar.style.background = "linear-gradient(90deg, #dc2626, #f87171)"; // red
    }
  });
});


// back button

function safeBack(){
    if(window.history.length > 1){
        window.history.back(); 
    } else {
        window.location.assign("/index.html");
    }
}
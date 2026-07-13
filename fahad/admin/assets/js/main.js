
const sidebar = document.getElementById("sidebar");

const overlay = document.getElementById("overlay");

document.getElementById("openSidebar").onclick = () => {

    sidebar.classList.add("show");

    overlay.classList.add("show");

};

document.getElementById("closeSidebar").onclick = closeSidebar;

overlay.onclick = closeSidebar;

function closeSidebar(){

    sidebar.classList.remove("show");

    overlay.classList.remove("show");

}

// Close sidebar when clicking a menu item on mobile

document.querySelectorAll(".sidebar-menu a").forEach(link=>{

    link.addEventListener("click",()=>{

        if(window.innerWidth<992){

            closeSidebar();

        }

    });

});
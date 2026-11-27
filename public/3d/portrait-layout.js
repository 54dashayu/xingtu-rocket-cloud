// Move the existing task card, retaining the same nodes and event state.
const portrait=matchMedia('(max-width:850px) and (orientation:portrait)');
const main=document.querySelector('main'),sidebar=main.querySelector('aside');
const mission=document.getElementById('missionContext'),workspace=main.querySelector('.workspace');
function arrange(){
 if(portrait.matches){
  main.prepend(mission);
  main.append(sidebar);
 }else{
  sidebar.prepend(mission);
  main.prepend(sidebar);
 }
}
portrait.addEventListener('change',arrange);
arrange();

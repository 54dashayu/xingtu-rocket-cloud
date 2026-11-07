// URLs are constructed at click time, so switching tasks in 3D preserves context.
const root=new URL('./',import.meta.url);
for(const link of document.querySelectorAll('.shared-mobile-nav [data-page]')){
 const destination=()=>{
  const page=link.dataset.page,params=new URL(location.href).searchParams;
  const url=new URL(page==='3d'?'3d/index.html':'map.html',root);
  for(const key of ['launch','range'])if(params.has(key))url.searchParams.set(key,params.get(key));
  if(page!=='3d')url.searchParams.set('view',page);
  return url;
 };
 link.href=destination();link.addEventListener('click',()=>{link.href=destination();});
}

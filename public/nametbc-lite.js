/* Wigglekit LITE FX — loaded only on secondary pages (not the home page).
   Cursor-follow glow + gentle scroll-reveal + card hover-lift. Self-contained, no deps. */
(function(){
  document.body.classList.add('litefx');

  /* cursor-follow glow */
  var spot=document.createElement('div');spot.className='litespot';document.body.appendChild(spot);
  var sx=window.innerWidth/2,sy=window.innerHeight/2,tx=sx,ty=sy,shown=false;
  window.addEventListener('pointermove',function(e){tx=e.clientX;ty=e.clientY;if(!shown){shown=true;spot.style.opacity='1';}},{passive:true});
  (function loop(){sx+=(tx-sx)*.12;sy+=(ty-sy)*.12;spot.style.transform='translate('+sx.toFixed(1)+'px,'+sy.toFixed(1)+'px) translate(-50%,-50%)';requestAnimationFrame(loop);})();

  /* soft scroll-reveal */
  var rev=[],seen=[];
  function add(el){if(seen.indexOf(el)<0){seen.push(el);el.setAttribute('data-lr','');rev.push(el);}}
  ['.sec-head','.fcard','.savecard','.pcard','.save-banner','.final','.cmp','.fgrid>*','.pgrid>*','.tcards>*','.measures>*','.wk-gallery>*','.wk-img'].forEach(function(s){
    [].slice.call(document.querySelectorAll(s)).forEach(add);
  });
  [].slice.call(document.querySelectorAll('.fgrid,.pgrid')).forEach(function(g){
    [].slice.call(g.children).forEach(function(c,i){c.classList.add('l'+((i%3)+1));});
  });
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.1,rootMargin:'0px 0px -6% 0px'});
    rev.forEach(function(el){io.observe(el);});
  } else rev.forEach(function(el){el.classList.add('in');});
})();

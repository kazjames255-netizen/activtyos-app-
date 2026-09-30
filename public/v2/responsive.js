/* Activly v2 responsive shim: burger drawer + tap-to-toggle dropdowns. No deps. */
(function(){
  var hdr=document.querySelector('header.nav'); if(!hdr) return;
  var inner=hdr.querySelector('.nav-in'); if(!inner) return;
  var root=document.documentElement;
  var mq=window.matchMedia('(max-width:959.98px)');
  var btn=document.createElement('button');
  btn.type='button'; btn.className='rsp-burger'; btn.setAttribute('aria-label','Menu');
  btn.setAttribute('aria-expanded','false'); btn.innerHTML='<span></span>';
  inner.appendChild(btn);
  var links=hdr.querySelector('.nav-links');
  if(links){ if(!links.id) links.id='rsp-nav'; btn.setAttribute('aria-controls',links.id); }

  function closeDrops(except){
    [].forEach.call(hdr.querySelectorAll('.navdrop.rsp-open'),function(d){
      if(d!==except){ d.classList.remove('rsp-open'); var b=d.querySelector('.navdrop-btn'); if(b) b.setAttribute('aria-expanded','false'); }
    });
  }
  function setOpen(o){
    hdr.classList.toggle('rsp-open',o); root.classList.toggle('rsp-lock',o&&mq.matches);
    btn.setAttribute('aria-expanded',o?'true':'false'); if(!o) closeDrops();
  }
  btn.addEventListener('click',function(){ setOpen(!hdr.classList.contains('rsp-open')); });
  [].forEach.call(hdr.querySelectorAll('.navdrop-btn'),function(b){
    b.setAttribute('aria-expanded','false');
    b.addEventListener('click',function(e){
      var d=b.parentElement, o=!d.classList.contains('rsp-open');
      if(!mq.matches && !window.matchMedia('(hover:none)').matches) return; // desktop mouse: CSS hover handles it
      e.preventDefault(); closeDrops(d); d.classList.toggle('rsp-open',o); b.setAttribute('aria-expanded',o?'true':'false');
      if(b.blur && !o) b.blur();
    });
  });
  hdr.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a[href]');
    if(a && hdr.classList.contains('rsp-open')) setOpen(false);
  });
  document.addEventListener('click',function(e){ if(!hdr.contains(e.target)){ closeDrops(); if(mq.matches) setOpen(false); } });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){ var was=hdr.classList.contains('rsp-open')||hdr.querySelector('.navdrop.rsp-open'); setOpen(false); closeDrops(); if(was&&mq.matches) btn.focus(); }
  });
  function onChange(){ if(!mq.matches){ setOpen(false); } }
  if(mq.addEventListener) mq.addEventListener('change',onChange); else mq.addListener(onChange);
})();

/* swipe support for the transform-based hero slider (.hs-view / #hsDots): it was mouse-only */
(function(){
  var view=document.querySelector('.hs-view'), dots=document.getElementById('hsDots');
  if(!view||!dots) return;
  var x0=null,y0=null;
  view.addEventListener('touchstart',function(e){ var t=e.touches[0]; x0=t.clientX; y0=t.clientY; },{passive:true});
  view.addEventListener('touchend',function(e){
    if(x0===null) return; var t=e.changedTouches[0], dx=t.clientX-x0, dy=t.clientY-y0; x0=null;
    if(Math.abs(dx)<44||Math.abs(dx)<Math.abs(dy)*1.3) return;
    var b=[].slice.call(dots.children), at=0; b.forEach(function(d,i){ if(d.className==='on') at=i; });
    b[(at+(dx<0?1:-1)+b.length)%b.length].click();
  },{passive:true});
})();
/* minimum legible text on touch/small screens: lifts <12px text (mock-up UI micro-copy) to 12px.
   Laptops (>1024px, mouse) are never touched, and everything is restored if the window grows. */
(function(){
  var mq=window.matchMedia('(max-width:1024px), (hover:none) and (pointer:coarse)');
  var FLOOR=12, bumped=[];
  function inSvg(el){ return el.closest && el.closest('svg'); }
  function apply(){
    [].forEach.call(document.body.querySelectorAll('*'),function(el){
      if(inSvg(el)||/^(SCRIPT|STYLE|SVG)$/i.test(el.tagName)) return;
      var own=false; for(var n=el.firstChild;n;n=n.nextSibling){ if(n.nodeType===3&&n.nodeValue.trim()){own=true;break;} }
      if(!own) return;
      var fs=parseFloat(getComputedStyle(el).fontSize);
      if(fs<FLOOR){ el.setAttribute('data-rsp-fs',el.style.fontSize||'-'); el.style.setProperty('font-size',FLOOR+'px','important'); bumped.push(el); }
    });
  }
  function undo(){
    bumped.forEach(function(el){ var o=el.getAttribute('data-rsp-fs'); el.style.removeProperty('font-size'); if(o&&o!=='-') el.style.fontSize=o; el.removeAttribute('data-rsp-fs'); });
    bumped=[];
  }
  function sync(){ undo(); if(mq.matches) apply(); }
  if(document.readyState==='complete') sync(); else window.addEventListener('load',sync);
  if(mq.addEventListener) mq.addEventListener('change',sync); else mq.addListener(sync);
})();
/* @@JSEND@@ */

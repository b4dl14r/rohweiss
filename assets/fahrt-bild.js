// Ein-Bild-Variante der Hero-Fahrt: ein Foto plus Tiefenkarte, in WebGL als 2.5D-Kamerafahrt gerendert.
import{a as MARK_FILL,c as smooth,i as MARK_PIN,l as timeline,t as MARK_END}from"./fahrt-Bbbismjj.js";

const BASE=`/rohweiss/hero/`;
const IMG_ASPECT=2000/1116;
const EYE=[.6305,.3328];         // dunkles Pupillenloch (Bild-UV, y nach unten): die Fahrt endet im Dunkeln
const HEAD=[.612,.37];           // Bildmitte der Kopf-Einstellung
const HEAD_ZOOM=2.15;
const EYE_ZOOM=46;               // Endzoom ins Auge (relativ zur Kopf-Einstellung)
const BG=[239/255,235/255,226/255];
const FG=[11/255,11/255,10/255];

// Shader für WebGL2 und WebGL1 aus einer Quelle; GL2 wählt die Mipmap über die Kamera statt über die Verschiebung (keine Nahtlinien)
function shaders(gl2){
  const v=gl2?`#version 300 es
#define attribute in
#define varying out
`:``;
  const f=gl2?`#version 300 es
precision highp float;
#define varying in
#define DEP(uv) textureLod(uDep,uv,0.)
#define IMG(uv) textureGrad(uImg,uv,dx,dy)
out vec4 fragOut;
#define gl_FragColor fragOut
`:`#extension GL_OES_standard_derivatives : enable
#define DEP(uv) texture2D(uDep,uv)
#define IMG(uv) texture2D(uImg,uv)
`;
  return[v+`attribute vec2 p;varying vec2 vS;void main(){vS=p*.5+.5;vS.y=1.-vS.y;gl_Position=vec4(p,0.,1.);}`,
f+`precision highp float;
varying vec2 vS;
uniform sampler2D uImg,uDep;
uniform vec2 uSpan,uC,uPar,uPx;
uniform float uZ,uRoll,uFocus,uDark,uVig,uTime,uBlur,uGrain,uTun;
uniform vec3 uBg,uFg;
float dep(vec2 uv){return DEP(clamp(uv,0.,1.)).r;}
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec2 s=vS-.5;
  float cr=cos(uRoll),sr=sin(uRoll);
  s=vec2(cr*s.x-sr*s.y,sr*s.x+cr*s.y);
  vec2 base=uC+s*uSpan/uZ;
  vec2 dx=dFdx(base),dy=dFdy(base);
  // Parallax-Occlusion: von nah (t=1) nach fern (t=0) die erste getroffene Fläche suchen.
  // Faltet nicht an steilen Tiefenkanten, nahe Flächen verdecken ferne sauber.
  float tP=1.,hP=dep(base-uPar*(1.-uFocus))-1.,hit=step(0.,hP);
  vec2 uv=base-uPar*(1.-uFocus);
  for(int i=1;i<=24;i++){
    float t=1.-float(i)/24.;
    float h=dep(base-uPar*(t-uFocus))-t;
    if(hit<.5&&h>=0.){
      float tt=mix(tP,t,hP/(hP-h));
      uv=base-uPar*(tt-uFocus);hit=1.;
    }
    tP=t;hP=h;
  }
  vec4 t=IMG(clamp(uv,0.,1.));
  // Zoom-Blur zur Bildmitte: bei starker Vergrößerung liest sich die Unschärfe als Tempo statt als fehlende Auflösung
  if(uBlur>0.){
    vec2 d=(base-uC)*uBlur;
    for(int j=1;j<8;j++)t+=IMG(clamp(uv-d*float(j)/7.,0.,1.));
    t/=8.;
  }
  t*=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y);
  vec3 col=uBg*(1.-t.a)+t.rgb;
  // weiches Abdunkeln zum Rand, wächst mit der Fahrt ins Auge
  float r=length((vS-.5)*vec2(uPx.x/uPx.y,1.));
  float vig=smoothstep(.15,.95,r)*uVig;
  // Tunnel: bei sehr starker Vergrößerung bleibt nur ein weicher Lichtkreis um die Pupille, der Rest sinkt ins Schwarz
  float tun=smoothstep(.62-.5*uTun,1.05-.55*uTun,r)*uTun+.3*uTun*uTun;
  col=mix(col,uFg,clamp(vig+uDark+tun,0.,1.));
  col+=(hash(vS*uPx+fract(uTime))-.5)*uGrain;
  gl_FragColor=vec4(col,1.);
}`];
}

function loadImage(src){return new Promise((ok,no)=>{const i=new Image;i.decoding=`async`;i.onload=()=>ok(i);i.onerror=no;i.src=src;});}
function pot(img,w,h){const c=document.createElement(`canvas`);c.width=w;c.height=h;c.getContext(`2d`).drawImage(img,0,0,w,h);return c;}
function damp(a,b,k,dt){return a+(b-a)*(1-Math.exp(-k*dt));}
function easeInOut(x){x=Math.min(Math.max(x,0),1);return x*x*x*(x*(x*6-15)+10);}

function createScene(host){
  const canvas=document.createElement(`canvas`);
  canvas.className=`hero__canvas`;
  host.append(canvas);
  const opts={antialias:!1,alpha:!1,premultipliedAlpha:!1};
  let gl=canvas.getContext(`webgl2`,opts);const gl2=!!gl;
  if(!gl){gl=canvas.getContext(`webgl`,opts);gl&&gl.getExtension(`OES_standard_derivatives`);}
  if(!gl)return{ready:Promise.reject(Error(`webgl`))};
  const[VS,FS]=shaders(gl2);
  const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const prog=gl.createProgram();
  gl.attachShader(prog,sh(gl.VERTEX_SHADER,VS));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);gl.useProgram(prog);
  const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(prog,`p`);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,!1,0,0);
  const U={};for(const n of[`uImg`,`uDep`,`uSpan`,`uC`,`uPar`,`uPx`,`uZ`,`uRoll`,`uFocus`,`uDark`,`uVig`,`uTime`,`uBlur`,`uGrain`,`uTun`,`uBg`,`uFg`])U[n]=gl.getUniformLocation(prog,n);
  function tex(unit,src){
    const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!0);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const ext=gl.getExtension(`EXT_texture_filter_anisotropic`);
    if(ext)gl.texParameterf(gl.TEXTURE_2D,ext.TEXTURE_MAX_ANISOTROPY_EXT,8);
  }
  gl.uniform3fv(U.uBg,BG);gl.uniform3fv(U.uFg,FG);
  const coarse=window.matchMedia(`(pointer: coarse)`).matches;
  const ready=Promise.all([loadImage(`${BASE}bild.webp`),loadImage(`${BASE}bild_tiefe.png`)]).then(([img,dep])=>{
    // WebGL2 kann Mipmaps in Originalgröße, WebGL1 braucht Zweierpotenzen
    tex(0,gl2?img:pot(img,2048,1024));tex(1,gl2?dep:pot(dep,1024,512));
    gl.uniform1i(U.uImg,0);gl.uniform1i(U.uDep,1);
  });
  let W=1,H=1;
  return{canvas,ready,
    resize(w,h){const dpr=Math.min(window.devicePixelRatio||1,coarse?1.5:2);W=Math.max(1,w);H=Math.max(1,h);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(U.uPx,canvas.width,canvas.height);},
    size:()=>[W,H],
    draw(c){
      const A=W/H,span=A>IMG_ASPECT?[1,IMG_ASPECT/A]:[A/IMG_ASPECT,1];
      gl.uniform2fv(U.uSpan,span);gl.uniform2fv(U.uC,c.c);gl.uniform2fv(U.uPar,c.par);
      gl.uniform1f(U.uZ,c.z);gl.uniform1f(U.uRoll,c.roll);gl.uniform1f(U.uFocus,c.focus);
      gl.uniform1f(U.uDark,c.dark);gl.uniform1f(U.uVig,c.vig);gl.uniform1f(U.uTime,c.time);
      // Fotopixel quer über den Bildschirm: unter ~600 wird das Foto weich, dann Blur, Korn und Tunnel hochfahren (geräteunabhängig)
      const vis=span[0]*2000/c.z;
      gl.uniform1f(U.uBlur,.18*smooth((600-vis)/480));gl.uniform1f(U.uGrain,.018+.05*smooth((600-vis)/500));gl.uniform1f(U.uTun,smooth((250-vis)/190));
      gl.drawArrays(gl.TRIANGLES,0,3);
    }};
}

// Kamera für Scroll-Fortschritt e, ohne Glättung
function shot(e,[W,H],time){
  const{a,b,dark}=timeline(e);
  const A=W/H,span=A>IMG_ASPECT?[1,IMG_ASPECT/A]:[A/IMG_ASPECT,1];
  const k=easeInOut(a);
  // Startbild: Kopf so weit wie möglich mittig, ohne den Bildrand zu zeigen
  // Hochkant zeigt rund ein Drittel der Bildbreite (Kopf und Schultern, unten bündig), quer füllt es
  const z0=Math.min(1.04,span[0]/.3),hx=span[0]/2/z0;
  const c0=[Math.min(Math.max(.66,hx),1-hx),.5];
  const zA=z0*(HEAD_ZOOM/z0)**k;
  // Bogen statt Gerade: Kamera schwingt leicht über den Kopf
  const arc=Math.sin(Math.PI*k);
  let c=[c0[0]+(HEAD[0]-c0[0])*k+.018*arc,c0[1]+(HEAD[1]-c0[1])*k-.03*arc];
  let z=zA;
  if(b>0){
    const kb=b*b*(3-2*b)*.35+b*.65;
    const zb=EYE_ZOOM**kb;
    z=HEAD_ZOOM*zb;
    c=[EYE[0]+(c[0]-EYE[0])/zb,EYE[1]+(c[1]-EYE[1])/zb];
  }
  // Seitwärtsfahrt der Kamera: erzeugt die Tiefenparallaxe; beim Eintauchen ins Auge ganz aus,
  // sonst verziehen Maus und Leerlauf das stark vergrößerte Gesicht (Morphen)
  const sway=Math.min(1,1/Math.sqrt(z))*(1-smooth(b/.3));
  const idle=[Math.sin(time*.37)*.0015+Math.sin(time*.13)*.001,Math.cos(time*.29)*.001];
  // bewusst klein: vor einfarbigem Grund zeigt sich Parallaxe nur als Verformung des Gesichts
  const par=[(.009*(1-k)-.005*arc+idle[0])*sway,(.003*(1-k)+.004*arc+idle[1])*sway];
  const roll=(.012*(1-k)-.018*arc)*(1-b)+Math.sin(time*.21)*.002;
  // Unterkante des Fotos (Büste abgeschnitten) nie ins Bild lassen, inkl. Drehung und Parallaxe
  const hy=span[1]/2/z+Math.abs(roll)*span[0]/2/z;
  c[1]=Math.min(c[1],1-hy-Math.abs(par[1])-.004);
  return{c,z,par,roll,focus:.55+.3*k,dark,vig:.08*k+.75*smooth(b/.7),time};
}

function initFahrt(hero,ctl){
  const stage=hero.querySelector(`.hero__stage`)??hero;
  const host=document.createElement(`div`);
  host.className=`hero__scene`;host.setAttribute(`aria-hidden`,`true`);
  stage.prepend(host);
  const scene=createScene(host);
  const darkEl=document.createElement(`div`);darkEl.className=`hero__dark`;host.append(darkEl);

  // Wortmarke, Titel und Fuß wie in der 3D-Fahrt
  const fade=[...stage.querySelectorAll(`.hero__title, .hero__foot`)],mark=stage.querySelector(`.hero__mark`),wide=window.matchMedia(`(min-width: 60em)`),m={x:0,y:0,scale:1};
  function measure(){if(!mark)return;mark.style.transform=``;const r=mark.getBoundingClientRect(),s=stage.getBoundingClientRect();m.x=s.left+s.width/2-(r.left+r.width*MARK_PIN[0]);m.y=s.top+s.height/2-(r.top+r.height*MARK_PIN[1]);m.scale=1.25*Math.hypot(s.width/2/(r.width*MARK_FILL[0]),s.height/2/(r.height*MARK_FILL[1]));}
  ctl.register({render(e){const n=Math.min(Math.max(e/MARK_END,0),1),o=1-smooth(n/.55);for(const el of fade){el.style.opacity=String(o);el.style.visibility=o>0?`visible`:`hidden`;}if(!mark)return;if(!wide.matches){mark.style.transform=``;mark.style.opacity=String(o);mark.style.visibility=o>0?`visible`:`hidden`;return;}const i=1-(1-n)*(1-n),s=m.scale**n;mark.style.transform=n>0?`translate(${(m.x*i).toFixed(1)}px, ${(m.y*i).toFixed(1)}px) scale(${s.toFixed(4)})`:``;mark.style.opacity=String(1-smooth((n-.88)/.12));mark.style.visibility=n<1?`visible`:`hidden`;},resize(){measure();}});

  const ready=scene.ready.then(()=>{
    let progress=0,soft=0,last=performance.now(),visible=!0,raf=0,first=!0;
    function frame(now){
      raf=0;
      const dt=Math.min(.1,(now-last)/1e3);last=now;
      // etwas Trägheit über dem Lenis-Scroll, damit die Kamera nachschwingt statt zu kleben
      soft=first?progress:damp(soft,progress,6,dt);first=!1;
      const cam=shot(soft,scene.size(),now/1e3);
      scene.draw(cam);
      darkEl.style.opacity=String(cam.dark);
      if(visible&&cam.dark<1)raf=requestAnimationFrame(frame);
    }
    const kick=()=>{if(!raf&&visible){last=performance.now();raf=requestAnimationFrame(frame);}};
    new IntersectionObserver(([en])=>{visible=en.isIntersecting;kick();}).observe(hero);
    hero.dataset.scene=`ready`;
    ctl.register({render(e){progress=e;kick();},resize(w,h){scene.resize(w,h);kick();}});
    document.dispatchEvent(new CustomEvent(`rw:hero-ready`));
  });
  ready.catch(()=>{hero.dataset.scene=`failed`;});
  return{ready};
}
export{initFahrt};

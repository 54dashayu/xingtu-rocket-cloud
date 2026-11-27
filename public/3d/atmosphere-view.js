// Display-only atmosphere and Earth-shadow overlay. No visibility/index inputs.
// Twilight scattering is qualitative; these colors/opacities are not radiance.
export const EARTH_SURFACE_FRAGMENT=`
varying vec3 p; uniform vec3 sun;
void main(){
 float d=dot(normalize(p),sun);
 float day=smoothstep(-0.025,0.06,d);
 float twilight=smoothstep(-0.105,0.015,d)*(1.0-smoothstep(0.015,0.12,d));
 vec3 night=vec3(0.065,0.052,0.040);
 vec3 lit=vec3(0.76,0.62,0.37)*(0.78+0.22*max(d,0.0));
 vec3 color=mix(night,lit,day)+vec3(0.10,0.055,0.015)*twilight;
 gl_FragColor=vec4(color,1.0);
}`;
export const ATMOSPHERE_FRAGMENT=`
varying vec3 p; uniform vec3 sun; uniform vec3 cameraLocal;
void main(){
 vec3 n=normalize(p),eye=normalize(cameraLocal-p);
 float d=dot(n,sun);
 float rim=pow(1.0-abs(dot(n,eye)),3.0);
 // Thin limb layer, diminishing into the deep night hemisphere.
 float daylight=smoothstep(-0.14,0.04,d);
 float twilight=smoothstep(-0.14,-0.015,d)*(1.0-smoothstep(0.015,0.18,d));
 vec3 color=mix(vec3(0.62,0.40,0.17),vec3(1.0,0.81,0.44),daylight);
 float alpha=rim*(0.09*daylight+0.17*twilight);
 gl_FragColor=vec4(color,alpha);
}`;
export const SHADOW_VOLUME_FRAGMENT=`
varying vec3 p; uniform vec3 cameraLocal;
void main(){
 vec3 ro=cameraLocal,rd=normalize(p-ro);
 float a=dot(rd.xz,rd.xz),b=dot(ro.xz,rd.xz);
 float c=dot(ro.xz,ro.xz)-1.025*1.025;
 float enter=-10000.0,leave=10000.0;
 if(a<0.000001){if(c>0.0)discard;}
 else{
  float disc=b*b-a*c;if(disc<=0.0)discard;
  float root=sqrt(disc);enter=(-b-root)/a;leave=(-b+root)/a;
 }
 if(abs(rd.y)<0.000001){if(abs(ro.y)>2.0)discard;}
 else{
  float y0=(-2.0-ro.y)/rd.y,y1=(2.0-ro.y)/rd.y;
  enter=max(enter,min(y0,y1));leave=min(leave,max(y0,y1));
 }
 enter=max(enter,0.0);if(leave<=enter)discard;
 float stepSize=(leave-enter)/16.0,depth=0.0;
 for(int i=0;i<16;i++){
  vec3 q=ro+rd*(enter+(float(i)+0.5)*stepSize);
  float radius=length(q.xz),axial=q.y+2.0;
  // Soft overlay boundary, not an atmospheric transmission calculation.
  float density=1.0-smoothstep(0.985,1.025,radius);
  float endFade=1.0-smoothstep(3.3,4.0,axial);
  depth+=density*endFade*stepSize;
 }
 gl_FragColor=vec4(vec3(0.30,0.25,0.18),1.0-exp(-0.075*depth));
}`;

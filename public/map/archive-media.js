// Curated public imagery is separate from user-submitted observations.
// Only assets with recorded reuse terms are hosted; other photographs link to their publisher.
const nasaTerms='https://www.nasa.gov/nasa-brand-center/images-and-media/';
const dvidsTerms='https://www.dvidshub.net/about/copyright';
export const archiveMedia=[
 {launchId:'bf2c3027-a314-403e-a416-2bfd5d165ad1',date:'2026-10-13',photos:[
  {originalFile:'crs35-john-kraus.jpg',file:'crs35-john-kraus-credited.jpg',caption:'晨光照亮 CRS-35 发射留下的水母状尾迹',credit:'NASA / John Kraus',source:'NASA',url:'https://www.nasa.gov/image-article/nasas-space-x-crs-35-launch-jellyfish/',original:'https://www.nasa.gov/wp-content/uploads/2026/10/nhq20261013-admin-0005orig.jpg',terms:nasaTerms,rights:'按 NASA 媒体使用规则作资料展示',width:853,height:1280},
  {originalFile:'crs35-bill-white.jpg',file:'crs35-bill-white-credited.jpg',caption:'CRS-35 发射后的发光尾迹',credit:'NASA / Bill White',source:'NASA 图片库',url:'https://images.nasa.gov/details/KSC-20261013-PH-BWW01_0001',original:'https://images-assets.nasa.gov/image/KSC-20261013-PH-BWW01_0001/KSC-20261013-PH-BWW01_0001~medium.jpg',terms:nasaTerms,rights:'按 NASA 媒体使用规则作资料展示',width:960,height:1280}
 ]},
 {launchId:'5d5e17f4-292b-45f6-ab53-05437cf63ce0',date:'2026-03-04',photos:[
  {originalFile:'sl1040-9548695.jpg',file:'sl1040-9548695-credited.jpg',caption:'星链 10-40 发射后的水母状尾迹',credit:'U.S. Space Force / Gwendolyn Kurzen',source:'DVIDS',url:'https://www.dvidshub.net/image/9548695/falcon-9-starlink-10-40-launch',original:'https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/2603/9548695/1000w_q95.jpg',terms:dvidsTerms,rights:'原站标注 Public Domain；遵循 DVIDS 使用规则',width:999,height:665},
  {originalFile:'sl1040-9548691.jpg',file:'sl1040-9548691-credited.jpg',caption:'日出前天空中的星链 10-40 火箭云',credit:'U.S. Space Force / Gwendolyn Kurzen',source:'DVIDS',url:'https://www.dvidshub.net/image/9548691/falcon-9-starlink-10-40-launch',original:'https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/2603/9548691/1000w_q95.jpg',terms:dvidsTerms,rights:'原站标注 Public Domain；遵循 DVIDS 使用规则',width:999,height:665}
 ]},
 {launchId:'9648124f-8568-46d2-86d7-4b4d6f12187f',date:'2026-10-23',photos:[
  {caption:'长征六号甲火箭云 · 钟瑞摄',credit:'钟瑞',source:'北京日报客户端',url:'https://xinwen.bjd.com.cn/content/s6adc18fee4b0e42f8f01fef2.html',rights:'版权归原作者；本站仅提供原报道入口'},
  {caption:'长征六号甲火箭云 · 高源摄',credit:'高源',source:'北京日报客户端',url:'https://xinwen.bjd.com.cn/content/s6adc18fee4b0e42f8f01fef2.html',rights:'版权归原作者；本站仅提供原报道入口'}
 ]},
 {launchId:'d50ae620-be2f-4690-9f86-fbc2a194bf29',date:'2026-05-12',photos:[
  {caption:'青岛午山拍到的火箭云与平流雾',credit:'原报道受访者提供',source:'青岛早报 / 观海新闻',url:'https://epaper.qingdaonews.com/qdzb/h5/html5/2026-05/14/content_144792_3430601.htm',rights:'版权归原作者；本站仅提供原报道入口'}
 ]}
];
export function mediaForTask(item){
 const time=Date.parse(item.time);
 if(!item.confirmed||!Number.isFinite(time))return [];
 return archiveMedia.find(record=>record.launchId===item.id&&record.date===new Date(time).toISOString().slice(0,10))?.photos||[];
}
export function appendArchiveMedia(card,item){
 const photos=mediaForTask(item);if(!photos.length)return;
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
 const section=node('section','','archive-media');section.setAttribute('aria-label','本次任务报道图片');
 section.append(node('h4','报道图片'));
 const grid=node('div','','archive-media-grid');section.append(grid);
 for(const photo of photos){
  const figure=node('figure','',photo.file?'archive-media-photo':'archive-media-source');
  if(photo.file){
   const link=node('a','','archive-media-image');link.href=new URL('./media/'+photo.file,import.meta.url).href;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','放大图片：'+photo.caption);
   const img=node('img');img.src=link.href;img.alt=photo.caption;img.loading='lazy';img.decoding='async';img.width=photo.width;
   img.onerror=()=>link.replaceWith(node('p','图片暂未加载，可打开下方来源查看。','archive-media-error'));link.append(img);figure.append(link);
  }
  const caption=node('figcaption');caption.append(node('strong',photo.caption),node('span','摄影 / 署名：'+photo.credit));
  const source=node('a',photo.file?'来源：'+photo.source:'查看原报道照片 · '+photo.source);source.href=photo.url;source.target='_blank';source.rel='noopener noreferrer';caption.append(source);
  const rights=node('small',photo.rights);caption.append(rights);
  if(photo.terms){const terms=node('a','图片使用规则','archive-media-terms');terms.href=photo.terms;terms.target='_blank';terms.rel='noopener noreferrer';caption.append(terms);}
  figure.append(caption);grid.append(figure);
 }
 if(photos.some(p=>p.terms===dvidsTerms))section.append(node('small','The appearance of U.S. Department of War (DoW) visual information does not imply or constitute DoW endorsement.','archive-media-notice'));
 card.append(section);
}
